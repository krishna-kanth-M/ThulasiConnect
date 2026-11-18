"""In-memory Faster-Whisper speech-to-text service (CPU INT8, ZERO audio persistence).

Privacy & architecture guarantees:
- Accepts raw 16 kHz mono float32 PCM samples strictly in memory (NumPy arrays).
- NEVER writes audio files to disk, database, or logs.
- Immediately releases temporary audio buffers after transcription.
- Reuses the local Faster-Whisper model cached at WHISPER_DOWNLOAD_ROOT (`ai-services/models`).
"""

import math
import os
import threading
import time
from dataclasses import dataclass
from typing import Any

import numpy as np

from app.core.config import get_settings

os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")


@dataclass
class TranscribedChunkSegment:
    start_seconds: float
    end_seconds: float
    text: str
    language: str | None
    confidence: float | None
    speaker_label: str = "Unknown speaker"


class TranscriptionService:
    """Thread-safe lazy wrapper around local Faster-Whisper (CPU INT8)."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._model: Any = None
        self._loaded_model_size: str | None = None
        self._last_load_seconds: float | None = None

    def get_status(self) -> dict[str, Any]:
        settings = get_settings()
        return {
            "engine": "faster-whisper",
            "model_size": self._loaded_model_size or settings.whisper_model_size,
            "device": settings.whisper_device,
            "compute_type": settings.whisper_compute_type,
            "cpu_threads": settings.whisper_cpu_threads,
            "vad_filter": settings.whisper_vad_filter,
            "download_root": settings.resolved_whisper_download_root,
            "loaded": self._model is not None,
            "last_load_seconds": self._last_load_seconds,
            "audio_storage_enabled": False,
            "speaker_diarization_mode": "not_verified_single_channel",
            "supported_languages": ["auto", "en", "ta"],
        }

    def _ensure_model(self, model_size: str | None = None) -> Any:
        settings = get_settings()
        target_size = model_size or settings.whisper_model_size
        with self._lock:
            if self._model is not None and self._loaded_model_size == target_size:
                return self._model

            from faster_whisper import WhisperModel

            t0 = time.perf_counter()
            self._model = WhisperModel(
                target_size,
                device=settings.whisper_device,
                compute_type=settings.whisper_compute_type,
                cpu_threads=settings.whisper_cpu_threads,
                download_root=settings.resolved_whisper_download_root,
            )
            self._loaded_model_size = target_size
            self._last_load_seconds = round(time.perf_counter() - t0, 2)
            return self._model

    def transcribe_pcm_int16(
        self,
        pcm_bytes: bytes,
        *,
        sample_rate: int = 16000,
        offset_seconds: float = 0.0,
        language: str | None = None,
        speaker_label: str = "Unknown speaker",
    ) -> dict[str, Any]:
        """Transcribe raw 16-bit signed little-endian mono PCM strictly in memory."""
        if not pcm_bytes:
            return {"segments": [], "language": language, "language_probability": None, "processing_seconds": 0.0}

        # Convert int16 PCM bytes -> float32 normalized [-1.0, 1.0] purely in RAM
        audio_i16 = np.frombuffer(pcm_bytes, dtype=np.int16)
        if audio_i16.size == 0:
            return {"segments": [], "language": language, "language_probability": None, "processing_seconds": 0.0}

        audio_f32 = audio_i16.astype(np.float32) / 32768.0
        del audio_i16

        # Resample simply if caller did not send 16 kHz (linear interpolation in RAM)
        if sample_rate != 16000 and sample_rate > 0:
            target_len = int(round(audio_f32.size * 16000 / sample_rate))
            if target_len > 0:
                x_old = np.linspace(0.0, 1.0, num=audio_f32.size, endpoint=False)
                x_new = np.linspace(0.0, 1.0, num=target_len, endpoint=False)
                audio_f32 = np.interp(x_new, x_old, audio_f32).astype(np.float32)

        return self.transcribe_float32(
            audio_f32,
            offset_seconds=offset_seconds,
            language=language,
            speaker_label=speaker_label,
        )

    def transcribe_float32(
        self,
        audio_f32: np.ndarray,
        *,
        offset_seconds: float = 0.0,
        language: str | None = None,
        speaker_label: str = "Unknown speaker",
    ) -> dict[str, Any]:
        """Transcribe a 16 kHz float32 NumPy array in RAM and discard temporary references."""
        settings = get_settings()
        t0 = time.perf_counter()
        try:
            # Guard against silence-only buffers to keep CPU load low
            rms = float(np.sqrt(np.mean(np.square(audio_f32)))) if audio_f32.size else 0.0
            if rms < 0.002:
                return {
                    "segments": [],
                    "language": language,
                    "language_probability": None,
                    "processing_seconds": round(time.perf_counter() - t0, 3),
                    "skipped_silence": True,
                }

            model = self._ensure_model()
            lang_arg = None if (not language or language == "auto") else language
            segments_iter, info = model.transcribe(
                audio_f32,
                beam_size=settings.whisper_beam_size,
                vad_filter=settings.whisper_vad_filter,
                language=lang_arg,
            )

            out_segments: list[TranscribedChunkSegment] = []
            for seg in segments_iter:
                text = (seg.text or "").strip()
                if not text:
                    continue
                # Convert Whisper avg_logprob (~ -2.0..0.0) into an approximate [0..1] confidence indicator
                conf: float | None = None
                if getattr(seg, "avg_logprob", None) is not None:
                    conf = round(max(0.0, min(1.0, math.exp(seg.avg_logprob))), 3)

                out_segments.append(
                    TranscribedChunkSegment(
                        start_seconds=round(offset_seconds + float(seg.start), 2),
                        end_seconds=round(offset_seconds + float(seg.end), 2),
                        text=text,
                        language=getattr(info, "language", lang_arg),
                        confidence=conf,
                        speaker_label=speaker_label,
                    )
                )

            return {
                "segments": out_segments,
                "language": getattr(info, "language", lang_arg),
                "language_probability": round(float(getattr(info, "language_probability", 0.0)), 3)
                if getattr(info, "language_probability", None) is not None
                else None,
                "processing_seconds": round(time.perf_counter() - t0, 3),
                "skipped_silence": False,
            }
        finally:
            # Explicitly drop local audio buffer reference so audio is never retained
            del audio_f32


transcription_service = TranscriptionService()
