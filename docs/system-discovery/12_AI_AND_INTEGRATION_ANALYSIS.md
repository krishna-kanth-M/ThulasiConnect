# 12 — AI, Speech-to-Text, Integrations & Audio Privacy Audit

> **Audited Files:** `backend/app/services/transcription_service.py`, `backend/app/routers/transcription.py`, `backend/app/services/ai_extraction_service.py`, `backend/app/services/shopaid_adapter.py`, `backend/app/services/telephony_adapter.py`, `frontend/src/pages/LiveCallDeskPage.tsx`, `frontend/src/pages/CallDetailPage.tsx`, `tests/record_sample.py`, `tests/test_transcription.py`, `tests/test_live_microphone.py`.

---

## 1. Speech-to-Text Engine (Faster-Whisper)

- **Implementation:** `TranscriptionService` (`backend/app/services/transcription_service.py`), thread-safe lazy singleton.
- **Configuration:**
  - Model: `base` multilingual (`Systran/faster-whisper-base`), loaded from `ai-services/models` (`WHISPER_DOWNLOAD_ROOT`) — **never redownloads**.
  - Runtime: `device="cpu"`, `compute_type="int8"`, `cpu_threads=4`, `beam_size=3`, `vad_filter=True` (built-in Silero VAD via `onnxruntime 1.32.0`).
- **Live Browser Capture (`LiveCallDeskPage.tsx`):**
  - Requests explicit `navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } })`.
  - Uses Web Audio API `AudioContext` + `ScriptProcessorNode(4096, 1, 1)` to downsample to 16 kHz Int16 PCM in browser memory and stream binary frames over `/api/ws/transcription/live`.
  - Displays a prominent red pulsing **`MICROPHONE ACTIVE — IN-MEMORY ONLY`** badge and an immediate **`Stop Mic Immediately`** button.
- **Server-Side Ephemeral Buffer Handling (`routers/transcription.py`):**
  - Accumulates PCM bytes in a volatile `bytearray` up to `CHUNK_THRESHOLD_BYTES = 128,000` (4 seconds at 16 kHz mono Int16), with a hard cap of `MAX_BUFFER_BYTES = 384,000` (12 seconds).
  - Copies to `raw_chunk`, immediately calls `pcm_buffer.clear()`, runs RMS silence skip (`rms < 0.002`) before invoking Faster-Whisper in `asyncio.to_thread`, converts `avg_logprob` to an approximate `0..1` confidence indicator, emits JSON segments, deletes `raw_chunk`, and clears `pcm_buffer` in `finally:` on disconnect/stop.
- **Language Support (`en`, `ta`, `auto`):**
  - Technically wired for English, Tamil, and auto-detect (for Tanglish). **Not yet benchmarked on real pharmacy calls** — accuracy on Indian pharmaceutical brand names and code-switched Tamil-English must be evaluated with authorized branch test utterances.
- **Speaker Tagging:**
  - Currently manual dropdown selection (`Unknown speaker`, `Speaker 1`, `Speaker 2`) stored with `identity_status = "unverified"`. Automatic multi-speaker diarization is **not implemented** (honestly reported via `speaker_diarization_mode: "not_verified_single_channel"`).

---

## 2. Local LLM Medicine Extraction (Ollama `qwen2.5:1.5b`)

- **Implementation:** `extract_call_requirements()` (`backend/app/services/ai_extraction_service.py`).
- **Endpoint:** Local `http://127.0.0.1:11434/api/generate` (`format: "json"`, `temperature: 0.1`, `num_predict: 512`, timeout `45s`).
- **Input Restriction:** Receives **only** `transcript_text` and optional `language_hint`. **Raw audio is never sent to Ollama.** No paid or external cloud AI APIs exist anywhere in the project.
- **Safety Controls:**
  - System prompt strictly prohibits inventing medicines, dosages, prices, medical advice, diagnoses, or prescriptions.
  - Every returned medicine item is tagged `verification_status: "ai_suggested"` or `"missing_info"`, paired with `SAFETY_DISCLAIMER`.
  - Frontend enforces explicit employee click on **Confirm** (`employee_confirmed`) before allowing `POST /api/requests`.
- **Resilience Fallback:** If Ollama is stopped or returns invalid JSON, `_heuristic_extract()` runs a local regex parser (`medicine_name + strength/unit`) so the call desk never breaks.

---

## 3. Privacy & Zero-Audio-Storage Verification Audit

| Layer / Artifact | Audio Persistence Audit Result | Status |
|---|---|---|
| **PostgreSQL Schema (`26` tables)** | Zero `BYTEA`, audio file path, or audio URL columns. Only text transcripts & metadata. | **Compliant** |
| **Backend Application (`backend/app/`)** | Zero file writes of audio bytes; PCM resides strictly in RAM (`bytearray` / `np.ndarray`) and is cleared immediately. | **Compliant** |
| **Frontend Application (`frontend/src/`)** | Zero `MediaRecorder` blob downloads, zero `<audio>` playback tags, zero LocalStorage/IndexedDB audio storage. | **Compliant** |
| **External Network Calls** | Zero external AI/transcription APIs; Ollama & Faster-Whisper run 100% on `127.0.0.1`. | **Compliant** |
| **Developer Test Folder (`tests/`)** | **Finding:** Pre-existing developer test script `tests/record_sample.py` writes `tests/sample.wav` (`320,044` bytes currently present on disk, gitignored by `*.wav` in `.gitignore`). This is **not** imported or executed by the application, but must never be deployed or used with real customer calls. | **Dev-Test Exception Noted** |

---

## 4. ShopAid & Telephony Integration Status

### ShopAid Inventory Software (`shopaid_adapter.py`)
- **Live API Status:** **Disconnected** (`status = "csv_fallback_only"` after CSV import, otherwise `"disconnected"`). No invented endpoints, no live stock claims, write operations permanently disabled (`write_operations_allowed: false`).
- **CSV Reference Fallback:** **Working.** Admin uploads UTF-8 CSV via `POST /api/integrations/shopaid/import-csv` into `shopaid_catalog_items` (currently 2 synthetic test items: `Dolo 650`, `Telma 40`). Staff search via `GET /api/integrations/shopaid/catalog`, with every hit clearly marked `csv_import_fallback` / `Live API Disconnected`.

### Pharmacy Telephony / SIP / PBX Adapter (`telephony_adapter.py`)
- **Status:** **Disconnected** (`UI only / placeholder` adapter config).
- **Audio Input Modes:**
  1. `browser_microphone_test` — Working prototype.
  2. `manual_telephone_call` — Working fallback.
  3. `verified_telephony_integration` — Disabled in UI and blocked on `POST /api/calls` for non-admin callers until a real authorized PBX/SIP/IP-telephony bridge is built.
