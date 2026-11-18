# ThulasiConnect — Live Transcription & Privacy Architecture

## 1. Strict Transcription-Only Pipeline (Zero Audio Storage)

```text
Authorized Browser Microphone (explicit getUserMedia permission + pulsing UI badge + Stop button)
   │
   ▼ Web Audio API (downsampled in-memory to 16 kHz mono Int16 PCM)
WebSocket (/api/ws/transcription/live, authenticated via JWT)
   │
   ▼ Ephemeral Python bytearray (hard cap: 12s; flushed every ~4s)
Faster-Whisper `base` (device="cpu", compute_type="int8", beam_size=3, Silero VAD)
   │   • Model reused from `ai-services/models` (no redownload)
   │   • Raw PCM chunk immediately cleared & deleted in memory
   ▼ Timestamped JSON segments (`start_seconds`, `end_seconds`, `text`, `language`, `confidence`)
Live Call Desk UI (Employee reviews & edits transcription mistakes)
   │
   ▼ Optional Text-Only Request to Local Ollama (`qwen2.5:1.5b` on 127.0.0.1:11434)
AI-Suggested Medicine Requirements (strictly tagged `ai_suggested` / `missing_info`)
   │
   ▼ Mandatory Employee Confirmation
PostgreSQL 16 (stores ONLY text transcript & confirmed request metadata — ZERO audio)
```

## 2. Audio Input Modes
1. **Browser Microphone Prototype (`browser_microphone_test`):** Implemented and functional via WebSocket. Clearly labeled as a microphone test session and excluded from verified telephone call counts.
2. **Manual Telephone Call Registration (`manual_telephone_call`):** Always-available fallback for phone calls received on existing pharmacy handsets.
3. **Verified Telephony Integration (`verified_telephony_integration`):** Modular adapter stub (`backend/app/services/telephony_adapter.py`) currently marked **Disconnected** until an authorized SIP/PBX/IP-telephony audio stream is connected.

## 3. Speaker Labeling & Language Support
- **Speaker Labels:** Supports `Speaker 1`, `Speaker 2`, and `Unknown speaker` tagged as `unverified` unless an employee or dual-channel telephony stream provides verified speaker identity. Ordinary single-channel microphone capture does not perform biometric identity verification.
- **Languages:** Configured for `auto`, `en` (English), and `ta` (Tamil) to evaluate English, Tamil, and Tanglish speech. Accuracy on real pharmacy conversations must be validated during controlled branch evaluation; inline editing is provided on every segment so pharmacists can immediately fix recognition errors.
