# ThulasiConnect

Enterprise Multi-Branch Pharmacy Call Management, In-Memory Speech Transcription, Customer Medicine Request Tracking, and Hierarchical Supervision Platform for Thulasi Pharmacy.

---

## Privacy & Zero-Audio-Storage Architecture

ThulasiConnect implements a strict **transcription-only** architecture:

- Live browser microphone audio is downsampled to 16 kHz mono PCM strictly **in RAM** and streamed over an authenticated WebSocket to local **Faster-Whisper (CPU INT8)**.
- Temporary audio buffers are discarded immediately after each chunk decode and on session stop/disconnect.
- **No audio files, no audio database columns, no audio playback controls, and no external cloud AI services** are used.
- Only approved text transcripts and structured customer/medicine request metadata are stored in PostgreSQL.

---

## Architecture & Documentation

| Document | Contents |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Modular monolith design, component boundaries, and invariants |
| [`docs/DATABASE_DESIGN.md`](docs/DATABASE_DESIGN.md) | 26-table normalized PostgreSQL 16 schema and Alembic migrations |
| [`docs/API_DOCUMENTATION.md`](docs/API_DOCUMENTATION.md) | REST and WebSocket endpoints (live Swagger at `/docs`) |
| [`docs/USER_ROLES.md`](docs/USER_ROLES.md) | 5-role RBAC hierarchy, backend scope enforcement, and bootstrap CLI |
| [`docs/TRANSCRIPTION_ARCHITECTURE.md`](docs/TRANSCRIPTION_ARCHITECTURE.md) | In-memory Faster-Whisper + local Ollama Qwen 2.5 1.5B pipeline |
| [`docs/INTEGRATION_STATUS.md`](docs/INTEGRATION_STATUS.md) | ShopAid read-only adapter (+ CSV fallback) and Telephony adapter status |
| [`docs/TESTING_REPORT.md`](docs/TESTING_REPORT.md) | Verified Pytest, Playwright E2E, Ruff, TypeScript, and ESLint results |
| [`docs/KNOWN_LIMITATIONS.md`](docs/KNOWN_LIMITATIONS.md) | Hardware, telephony, ShopAid, and language-evaluation limitations |
| [`docs/ENVIRONMENT_REPORT.md`](docs/ENVIRONMENT_REPORT.md) | Local Windows 11 hardware & dependency audit |

---

## Windows PowerShell Quick Start

### 1. Verify Local Environment
```powershell
cd "C:\Users\KRISHNA KANTH M\Downloads\ThulasiConnect"
.\scripts\check-env.ps1
```

### 2. Start PostgreSQL 16 (Local Portable Cluster on `127.0.0.1:5432`)
```powershell
.\scripts\start-postgres.ps1
```
*(Stop PostgreSQL later with `.\scripts\stop-postgres.ps1`.)*

### 3. Start Local Ollama Service (`127.0.0.1:11434`, `qwen2.5:1.5b`)
*(Skip if Ollama is already listening on port `11434`.)*
```powershell
$env:OLLAMA_HOST = "127.0.0.1:11434"
ollama serve
```

### 4. Apply Database Migrations & Bootstrap Initial Development Accounts
```powershell
cd "C:\Users\KRISHNA KANTH M\Downloads\ThulasiConnect\backend"
..\.venv\Scripts\alembic.exe upgrade head

# Create initial System Administrator + synthetic multi-branch dev organization
$env:BOOTSTRAP_ADMIN_EMAIL = "admin@thulasipharmacy.local"
$env:BOOTSTRAP_ADMIN_PASSWORD = "<choose-a-strong-password>"
..\.venv\Scripts\python.exe -m app.cli.bootstrap_admin --seed-demo
```

### 5. Start the Backend API (`http://127.0.0.1:8000`)
```powershell
cd "C:\Users\KRISHNA KANTH M\Downloads\ThulasiConnect"
.\scripts\start-backend.ps1
```
API docs: `http://127.0.0.1:8000/docs` • Health: `http://127.0.0.1:8000/api/health`

### 6. Start the Frontend Web Application (`http://127.0.0.1:5173`)
In a separate PowerShell terminal:
```powershell
cd "C:\Users\KRISHNA KANTH M\Downloads\ThulasiConnect"
.\scripts\start-frontend.ps1
```
Open **`http://127.0.0.1:5173`** in Chrome or Edge.

---

## Running Tests & Quality Checks

```powershell
cd "C:\Users\KRISHNA KANTH M\Downloads\ThulasiConnect"

# Python lint
.\.venv\Scripts\ruff.exe check backend\app tests\test_backend_api.py

# Backend API, RBAC, Persistence, Escalation, WebSocket & Ollama tests
$env:TEST_DEV_PASSWORD = "<your-bootstrap-password>"
.\.venv\Scripts\pytest.exe tests/test_backend_api.py -v

# Frontend TypeScript check, ESLint, and production build
cd frontend
npm run typecheck
npm run lint
npm run build

# Playwright Chromium E2E tests (with backend on :8000 and frontend on :5173)
$env:TEST_DEV_PASSWORD = "<your-bootstrap-password>"
npx playwright test --reporter=list
```

---

## Troubleshooting

- **Database connection refused (`5432`):** Run `.\scripts\start-postgres.ps1` and confirm `psql -h 127.0.0.1 -p 5432 -U postgres -d thulasiconnect_dev -c "SELECT 1;"`.
- **Ollama offline during AI extraction:** Start `ollama serve` on `127.0.0.1:11434`. If Ollama is stopped, ThulasiConnect automatically degrades to a local rule-based suggestion parser without crashing.
- **Browser microphone blocked:** Ensure you access the frontend over `http://127.0.0.1:5173` or `http://localhost:5173` (secure context for `getUserMedia`) and grant microphone permission, or use manual transcript entry as fallback.
- **Low RAM (8 GB machine):** Avoid running simultaneous heavy Ollama generations and long unfiltered Faster-Whisper chunks; keep Silero VAD enabled (`WHISPER_VAD_FILTER=true`).
