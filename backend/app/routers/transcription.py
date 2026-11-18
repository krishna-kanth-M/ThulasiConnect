"""Live In-Memory Speech Transcription WebSocket & Local Ollama AI Extraction endpoints.

CRITICAL PRIVACY ARCHITECTURE:
- Audio bytes received over WebSocket remain strictly in an ephemeral RAM bytearray.
- Processed in ~4-second chunks by local Faster-Whisper (CPU INT8) in a worker thread.
- Ephemeral PCM buffer is cleared immediately after each chunk and on disconnect/stop.
- ZERO audio files, ZERO audio blobs, ZERO external AI APIs.
"""

import asyncio
import json
from typing import Any

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    WebSocket,
    WebSocketDisconnect,
    status,
)

from app.core.database import SessionLocal
from app.core.rbac import (
    AuthContext,
    authenticate_token,
    get_current_user,
    require_permissions,
)
from app.schemas.operations import AIExtractRequestIn, AIExtractResponseOut
from app.services.ai_extraction_service import (
    check_ollama_health,
    extract_call_requirements,
)
from app.services.transcription_service import transcription_service

router = APIRouter(tags=["Transcription & AI"])

# 4 seconds of 16 kHz mono int16 PCM = 4 * 16000 * 2 = 128,000 bytes (~125 KB in RAM)
CHUNK_THRESHOLD_BYTES = 16000 * 2 * 4
MAX_BUFFER_BYTES = 16000 * 2 * 12  # hard cap: never retain > 12s in memory


@router.get("/api/transcription/status")
def get_transcription_and_ai_status(
    _ctx: AuthContext = Depends(get_current_user),
) -> dict[str, Any]:
    return {
        "speech_to_text": transcription_service.get_status(),
        "local_llm": check_ollama_health(),
        "privacy_mode": {
            "audio_recording_storage": False,
            "audio_playback_available": False,
            "processing_mode": "in_memory_ephemeral_only",
        },
    }


@router.post("/api/transcription/extract", response_model=AIExtractResponseOut)
async def extract_requirements_from_transcript(
    payload: AIExtractRequestIn,
    _ctx: AuthContext = Depends(require_permissions("live_call:use", "calls:create", "requests:create")),
) -> AIExtractResponseOut:
    """Run local Ollama Qwen 2.5 1.5B on transcript text ONLY (never audio)."""
    result = await asyncio.to_thread(
        extract_call_requirements,
        payload.transcript_text,
        payload.language_hint,
    )
    return AIExtractResponseOut(**result)


@router.websocket("/api/ws/transcription/live")
async def websocket_live_transcription(websocket: WebSocket) -> None:
    """Authorized browser-microphone live transcription over WebSocket (in-memory only).

    Protocol:
    - Connect with query params: `?token=<JWT>&language=auto|en|ta&sample_rate=16000&speaker_label=Unknown+speaker`
    - Client sends binary frames of 16-bit signed little-endian mono PCM audio.
    - Client may send JSON text control frames:
      - `{"type": "config", "language": "ta", "speaker_label": "Speaker 1"}`
      - `{"type": "flush"}` (process remaining in-memory buffer immediately)
      - `{"type": "stop"}` (flush remaining buffer, discard memory, close cleanly)
    - Server sends JSON frames:
      - `{"type": "ready", ...}`
      - `{"type": "status", "state": "processing"|"listening", ...}`
      - `{"type": "segments", "segments": [...], "detected_language": ..., "processing_seconds": ...}`
      - `{"type": "stopped", "audio_retained": false}`
    """
    token = websocket.query_params.get("token", "")
    language = websocket.query_params.get("language", "auto")
    sample_rate = int(websocket.query_params.get("sample_rate", "16000") or "16000")
    speaker_label = websocket.query_params.get("speaker_label", "Unknown speaker")

    db = SessionLocal()
    try:
        ctx = authenticate_token(db, token)
        if not ctx.has_permission("live_call:use"):
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Insufficient permission for Live Call Desk.")
            return
    except HTTPException:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid or expired authentication token.")
        return
    finally:
        db.close()

    await websocket.accept()
    pcm_buffer = bytearray()
    elapsed_seconds = 0.0
    segment_counter = 0

    await websocket.send_json(
        {
            "type": "ready",
            "message": "Authorized in-memory transcription session active. Audio is never saved.",
            "audio_retained": False,
            "model": transcription_service.get_status()["model_size"],
            "language": language,
            "speaker_label": speaker_label,
        }
    )

    async def _process_and_clear_buffer() -> None:
        nonlocal elapsed_seconds, segment_counter
        if not pcm_buffer:
            return
        raw_chunk = bytes(pcm_buffer)
        pcm_buffer.clear()  # Immediately discard buffer before transcription even finishes

        chunk_duration = len(raw_chunk) / float(max(sample_rate, 1) * 2)
        chunk_offset = elapsed_seconds
        elapsed_seconds += chunk_duration

        await websocket.send_json({"type": "status", "state": "processing"})
        result = await asyncio.to_thread(
            transcription_service.transcribe_pcm_int16,
            raw_chunk,
            sample_rate=sample_rate,
            offset_seconds=chunk_offset,
            language=language,
            speaker_label=speaker_label,
        )
        del raw_chunk

        segments_payload = []
        for seg in result["segments"]:
            segments_payload.append(
                {
                    "sequence_index": segment_counter,
                    "start_seconds": seg.start_seconds,
                    "end_seconds": seg.end_seconds,
                    "text": seg.text,
                    "language": seg.language,
                    "confidence": seg.confidence,
                    "speaker_label": seg.speaker_label,
                    "is_edited": False,
                }
            )
            segment_counter += 1

        await websocket.send_json(
            {
                "type": "segments",
                "segments": segments_payload,
                "detected_language": result.get("language"),
                "language_probability": result.get("language_probability"),
                "processing_seconds": result.get("processing_seconds"),
                "skipped_silence": result.get("skipped_silence", False),
                "audio_retained": False,
            }
        )
        await websocket.send_json({"type": "status", "state": "listening"})

    try:
        while True:
            message = await websocket.receive()
            if message["type"] == "websocket.disconnect":
                break

            if message.get("bytes") is not None:
                pcm_buffer.extend(message["bytes"])
                if len(pcm_buffer) > MAX_BUFFER_BYTES:
                    del pcm_buffer[: len(pcm_buffer) - MAX_BUFFER_BYTES]
                if len(pcm_buffer) >= CHUNK_THRESHOLD_BYTES:
                    await _process_and_clear_buffer()

            elif message.get("text") is not None:
                try:
                    cmd = json.loads(message["text"])
                except json.JSONDecodeError:
                    await websocket.send_json({"type": "error", "message": "Malformed JSON control message."})
                    continue

                cmd_type = cmd.get("type")
                if cmd_type == "config":
                    if cmd.get("language"):
                        language = str(cmd["language"])
                    if cmd.get("speaker_label"):
                        speaker_label = str(cmd["speaker_label"])
                    if cmd.get("sample_rate"):
                        sample_rate = int(cmd["sample_rate"])
                    await websocket.send_json(
                        {
                            "type": "config_updated",
                            "language": language,
                            "speaker_label": speaker_label,
                            "sample_rate": sample_rate,
                        }
                    )
                elif cmd_type == "flush":
                    await _process_and_clear_buffer()
                elif cmd_type == "stop":
                    await _process_and_clear_buffer()
                    await websocket.send_json({"type": "stopped", "audio_retained": False})
                    break
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        try:
            await websocket.send_json({"type": "error", "message": f"Transcription error: {exc}"})
        except Exception:
            pass
    finally:
        # Guaranteed immediate in-memory buffer disposal
        pcm_buffer.clear()
