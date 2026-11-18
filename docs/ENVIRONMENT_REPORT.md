# ThulasiConnect — Development Environment Report

**Stage:** Prompt 1 — Environment Inspection, Dependency Installation and Development Readiness  
**Date:** 2026-11-18  
**Project Root:** `C:\Users\KRISHNA KANTH M\Downloads\ThulasiConnect`  
**Status:** Ready for Stage 2 (Application Architecture & Development) — No application code created yet.

---

## 1. Computer Specifications

| Specification | Detected Value |
|---|---|
| **Operating System** | Microsoft Windows 11 Home (64-bit) |
| **OS Version / Build** | `10.0.26200` (Build `26200`) |
| **Processor** | 11th Gen Intel(R) Core(TM) i3-1115G4 @ 3.00 GHz (x64, 2 physical cores / 4 logical processors) |
| **Physical Memory (RAM)** | `7.80 GB` total (`0.82 GB` free at initial inspection; `1.23 GB` free at final verification) |
| **Graphics (GPU)** | Intel(R) UHD Graphics (integrated, ~1 GB shared; **no NVIDIA CUDA GPU**) |
| **Storage Drive (`C:`)** | `237.05 GB` total SSD (`25.33 GB` free before setup; `17.67 GB` free after setup) |
| **Virtualization & WSL2** | WSL `2.7.13.0` installed (kernel `6.18.33.2-2`, default version 2, no Linux distributions installed); Hypervisor detected (VBS running), `VirtualizationFirmwareEnabled: False` |
| **Shell Privilege** | Standard User (`Administrator: False`) |
| **Required Local Ports** | `3000`, `5173`, `5432`, `8000`, `8001`, `11434` — all verified **AVAILABLE** |

---

## 2. Software Already Installed (Preserved Without Reinstallation)

| Software | Version | Location |
|---|---|---|
| **Git** | `2.52.0.windows.1` | `C:\Program Files\Git\cmd\git.exe` |
| **Python (Default System)** | `3.14.2` (`pip 26.1.1`) | `C:\Python314\python.exe` |
| **Python (Project Venv Base)** | `3.13.7` | `C:\Program Files\Python313\python.exe` |
| **Node.js (LTS)** | `v20.20.2` | `C:\Program Files\nodejs\node.exe` |
| **npm** | `10.8.2` | `C:\Program Files\nodejs\npm.cmd` |
| **VS Code** | `1.137.0` (x64) | `C:\Users\KRISHNA KANTH M\AppData\Local\Programs\Microsoft VS Code\bin\code.cmd` |
| **WSL** | `2.7.13.0` | `C:\WINDOWS\system32\wsl.exe` |
| **winget / Chocolatey** | Installed | System package managers |

---

## 3. Software & Dependencies Newly Installed

| Component | Purpose | Admin Required? |
|---|---|---|
| **PostgreSQL 16.16-1 (Portable Official EDB Binaries)** | Local relational database server and client utilities (`psql`, `pg_ctl`, `initdb`, `pg_dump`) | No (User-scope) |
| **Ollama `0.40.16`** | Local LLM runtime and HTTP API (`127.0.0.1:11434`) | No (User-scope) |
| **`qwen2.5:1.5b` (Ollama model)** | Lightweight local multilingual LLM for transcript summarization / extraction | No |
| **Python 3.13 Virtual Environment (`.venv`)** | Isolated backend, AI/speech, and Python testing environment (`--no-cache-dir`) | No |
| **Backend & Testing Python Packages** | FastAPI, Uvicorn, SQLAlchemy, Alembic, Pydantic, Pydantic Settings, Psycopg (binary), python-multipart, WebSockets, HTTPX, python-dotenv, Pytest, pytest-asyncio, Ruff | No |
| **AI & Speech Python Packages** | Faster-Whisper, CTranslate2 (CPU INT8), ONNX Runtime (Silero VAD), PyAV, NumPy | No |
| **Faster-Whisper `base` Multilingual Model** | Local CPU INT8 speech-to-text evaluation model (Tamil / English / mixed) | No |
| **Frontend npm Stack (`frontend/node_modules`)** | React, React DOM, TypeScript, Vite, Tailwind CSS v4, shadcn CLI & utilities (`clsx`, `tailwind-merge`, `class-variance-authority`), React Router, TanStack Query, React Hook Form, Zod, Recharts, Lucide React, ESLint, Playwright | No |
| **Playwright Chromium Browser** | Chromium-only browser binaries for E2E testing (Firefox/WebKit omitted to save disk space) | No |

> **Intentionally Excluded Services:** MinIO (no audio recording storage), Redis, Celery, n8n, CUDA libraries, and Docker Desktop (see Section 8 & Section 10).

---

## 4. Exact Installed Versions

### System & CLI Tools
- **Git:** `2.52.0.windows.1`
- **Python (venv):** `3.13.7` (`pip 26.3`)
- **Python (system):** `3.14.2` (`pip 26.1.1`)
- **Node.js / npm:** `v20.20.2` / `10.8.2`
- **PostgreSQL (`psql` / `pg_ctl`):** `16.16` (Visual C++ build 1944, 64-bit)
- **Ollama:** `0.40.16` (`qwen2.5:1.5b` digest `65ec06548149`)
- **Docker / Docker Compose:** Not installed (deferred — see Section 8)

### Backend, AI & Python Testing (`.venv`)
- `fastapi`: `0.163.2`
- `uvicorn[standard]`: `0.54.0`
- `sqlalchemy`: `2.1.9`
- `alembic`: `1.20.1`
- `pydantic`: `2.14.3`
- `pydantic-settings`: `2.16.3`
- `psycopg` / `psycopg-binary`: `3.3.9`
- `python-multipart`: `0.0.34`
- `websockets`: `15.0.1`
- `httpx`: `0.28.1`
- `python-dotenv`: `1.2.4`
- `faster-whisper`: `1.2.1`
- `ctranslate2`: `4.9.0`
- `onnxruntime`: `1.32.0`
- `av`: `19.0.2`
- `numpy`: `2.5.5`
- `pytest`: `8.4.2`
- `pytest-asyncio`: `0.26.0`
- `ruff`: `0.17.5`

### Frontend & E2E Testing (`frontend/`)
- `react` / `react-dom`: `^19.0.0` (resolved in `frontend/package-lock.json`)
- `typescript` (`tsc`): `5.9.3`
- `vite`: `6.4.6`
- `tailwindcss` / `@tailwindcss/vite`: `^4.0.0`
- `shadcn`: `^2.1.8` (+ `clsx`, `tailwind-merge`, `class-variance-authority`)
- `react-router-dom`: `^7.1.0`
- `@tanstack/react-query`: `^5.62.0`
- `react-hook-form` / `@hookform/resolvers`: `^7.54.0` / `^3.9.1`
- `zod`: `^3.24.0`
- `recharts`: `^2.15.0`
- `lucide-react`: `^0.468.0`
- `eslint`: `9.39.5`
- `@playwright/test`: `1.65.1` (Chrome for Testing & Headless Shell `159.0.8154.6`)

---

## 5. Official Download Sources

| Component | Official Source |
|---|---|
| **PostgreSQL 16.16-1 Portable Binaries** | `https://get.enterprisedb.com/postgresql/postgresql-16.16-1-windows-x64-binaries.zip` (via `https://www.postgresql.org/download/windows/`) |
| **Ollama v0.40.16 (`OllamaSetup.exe`)** | `https://github.com/ollama/ollama/releases/download/v0.40.16/OllamaSetup.exe` (via `https://ollama.com/download`; SHA256 verified: `84db4f756ddc9e091142a85cdc0f7ae5db68bc9b3e075f114388b326f8ed912d`) |
| **Qwen 2.5 1.5B Model** | Official Ollama Registry (`ollama pull qwen2.5:1.5b`) |
| **Python Packages** | Official PyPI (`https://pypi.org/`) |
| **Faster-Whisper `base` Model** | Official Systran Hugging Face repository (`Systran/faster-whisper-base`, referenced by `https://github.com/SYSTRAN/faster-whisper`) |
| **Frontend npm Packages** | Official npm Registry (`https://registry.npmjs.org/`) |
| **Playwright Chromium** | Official Playwright CDN (`https://cdn.playwright.dev/`) |

---

## 6. Installation Locations

| Component | Path |
|---|---|
| **Project Root** | `C:\Users\KRISHNA KANTH M\Downloads\ThulasiConnect` |
| **Python 3.13 Virtual Environment** | `C:\Users\KRISHNA KANTH M\Downloads\ThulasiConnect\.venv` |
| **Frontend Packages** | `C:\Users\KRISHNA KANTH M\Downloads\ThulasiConnect\frontend\node_modules` |
| **PostgreSQL 16 Binaries** | `C:\Users\KRISHNA KANTH M\AppData\Local\Programs\PostgreSQL\16` (`bin` added to User `PATH`) |
| **PostgreSQL 16 Data Cluster & Log** | `C:\Users\KRISHNA KANTH M\AppData\Local\ThulasiConnect\pgdata` (`postgresql.log` in parent folder) |
| **Ollama Application & CLI** | `C:\Users\KRISHNA KANTH M\AppData\Local\Programs\Ollama` |
| **Ollama Models** | `C:\Users\KRISHNA KANTH M\.ollama\models` (`%USERPROFILE%\.ollama\models`) |
| **Faster-Whisper Model Cache** | `C:\Users\KRISHNA KANTH M\.cache\huggingface\hub\models--Systran--faster-whisper-base` |
| **Playwright Browsers** | `C:\Users\KRISHNA KANTH M\AppData\Local\ms-playwright` |

---

## 7. Disk Usage Before & After (and Adjusted Storage Plan)

### Actual Drive `C:` Measurements

| Metric | Before Setup | After Setup | Delta |
|---|---:|---:|---:|
| **Total Capacity** | `237.05 GB` | `237.05 GB` | — |
| **Used Space** | `211.73 GB` | `219.38 GB` | `+7.65 GB` |
| **Free Space** | `25.33 GB` | **`17.67 GB`** | `-7.66 GB` |

> **Safety Reserve Status:** Free space is **`17.67 GB`**, maintaining **`2.67 GB` above the 15 GB safety reserve**. All temporary installers (`postgresql-16.16-1-windows-x64-binaries.zip`, `OllamaSetup-0.40.16.exe`) were deleted immediately after installation, and `pip` was run with `--no-cache-dir`.

### Measured Footprint by Component vs. Adjusted Local Limits

Because `C:` had `25.33 GB` free rather than `50 GB`, local allocations were adjusted to preserve the `>= 15 GB` safety reserve:

| Component | Measured Actual | Adjusted Local Cap |
|---|---:|---:|
| Source code & frontend `node_modules` | `230.0 MB` | `1.0 GB` |
| Playwright Chromium cache | `1,448.1 MB` | `1.5 GB` |
| Python virtual environment (`.venv`) | `372.7 MB` | `0.8 GB` |
| PostgreSQL 16 binaries + `pgdata` | `979.5 MB` | `1.5 GB` |
| Local speech model (`faster-whisper-base`) | `141.0 MB` | `0.5 GB` |
| Ollama binaries + `qwen2.5:1.5b` | `4,137.8 MB` | `4.5 GB` |
| Docker images/containers | `0 MB` (deferred locally) | `0 GB` (central server only) |
| Application logs & local backups | `< 1 MB` | `0.5 GB` |
| **Unallocated Safety Reserve** | **`17.67 GB` free** | **At least `15.0 GB`** |

### Zero Audio Storage Enforcement
- No MinIO, S3 bucket, local audio directory, database BLOB column, or browser audio cache has been configured.
- `.gitignore` explicitly excludes audio file extensions (`*.wav`, `*.mp3`, `*.ogg`, `*.opus`, `*.webm`, `*.m4a`, `*.flac`, `*.aac`, `*.pcm`).
- `.env.example` sets `AUDIO_STORAGE_ENABLED=false`.
- Faster-Whisper verification ran strictly on an in-memory NumPy `float32` buffer (`del audio_buf` after transcription).

---

## 8. Database Configuration (and Docker Desktop Decision)

### Why Docker Desktop Was Deferred on This Machine
1. **Storage Constraint:** Drive `C:` had only `25.33 GB` free. Installing Docker Desktop + WSL2 VHDX + a PostgreSQL container (`~3.5–5.0 GB`) alongside Ollama + `qwen2.5:1.5b` would have pushed free disk space below the mandatory `15 GB` safety reserve (`~11–14 GB`).
2. **Memory Constraint:** This laptop has `7.80 GB` total RAM (`0.82–1.23 GB` free during normal desktop use). Running a WSL2 Linux VM (`vmmemWSL`, typically `2–4 GB` RAM) concurrently with Ollama (`~1.5–2.0 GB` RAM) and Faster-Whisper would cause heavy paging and instability.
3. **Privilege / Firmware Note:** The current shell is non-Administrator, and `VirtualizationFirmwareEnabled` reported `False` on `Win32_Processor` (while VBS hypervisor is active). Docker Desktop requires Administrator/UAC installation.

### Supported Local Alternative Configured: Native Portable PostgreSQL 16.16
- **Host / Port:** `127.0.0.1:5432` (loopback only)
- **Database Created:** `thulasiconnect_dev` (`UTF8` encoding, locale `C`)
- **Initial Superuser:** `postgres` (local loopback `trust` for initial dev; before application development starts, create a dedicated least-privilege application role `thulasiconnect_app` with `scram-sha-256` password set via `.env`)
- **Driver Verified:** `SQLAlchemy 2.1.9` + `psycopg 3.3.9` (`postgresql+psycopg://...`) connected and executed `SELECT version()` and `SELECT current_database()` successfully.
- **Migration Tool Verified:** `alembic 1.20.1` installed and ready.
- **Future Central Server Deployment:** Because the backend targets standard PostgreSQL 16 via `DATABASE_URL`, deploying via Docker Compose on the future central server requires zero database driver changes.

---

## 9. AI Model Configuration & Verification Results

### Local LLM — Ollama (`qwen2.5:1.5b`)
- **Runtime:** Ollama `0.40.16` on `http://127.0.0.1:11434`
- **Model:** `qwen2.5:1.5b` (`940.4 MB` / `986 MB` manifest size, no paid API key required)
- **Verified Endpoints:** `GET /api/version`, `GET /api/tags`, `POST /api/generate`
- **Measured CPU Inference (Intel Core i3-1115G4, 8 GB RAM):**
  - Cold request latency (including model load): `6.89s` for 16 output tokens
  - Token generation throughput: **`13.57 tokens/sec`**

### Local Speech-to-Text — Faster-Whisper (`base`, CPU INT8)
- **Library:** `faster-whisper 1.2.1` + `ctranslate2 4.9.0` + `onnxruntime 1.32.0` (built-in Silero VAD)
- **Configuration:** `device="cpu"`, `compute_type="int8"`, `cpu_threads=4`, `vad_filter=True`
- **Model Cached:** `Systran/faster-whisper-base` (`141.0 MB`, multilingual: Tamil, English, Tamil-English code-switched evaluation)
- **Measured Performance (In-Memory 3-second 16 kHz `float32` buffer, zero disk audio):**
  - Warm local load time (`local_files_only=True`): **`1.28s`**
  - 3-second buffer with Silero VAD (`vad_filter=True`): **`1.30s`**
  - 3-second buffer raw decode without VAD under concurrent CPU load (`vad_filter=False`, `language="ta"`): `25.59s`
- **Important Note:** Tamil / English / Tanglish transcription accuracy has **not** been assumed or benchmarked yet and must be evaluated later using authorized real-world test conversations.

---

## 10. Known Limitations

1. **Tight RAM (7.80 GB total):** Do **not** run Ollama (`qwen2.5:1.5b`), Faster-Whisper, Chromium E2E tests, and heavy IDE tasks simultaneously at peak memory. Prefer running speech transcription and LLM summarization sequentially or unloading idle models (`keep_alive` in Ollama).
2. **CPU-Only Dual-Core Inference (i3-1115G4):**
   - Faster-Whisper `base` INT8 requires `vad_filter=True` and chunked in-memory streaming; decoding long unfiltered audio on 2 physical cores will lag behind real time.
   - If live Tamil/English evaluation later shows `base` is too slow for real-time streaming, fall back to `tiny` (`~75 MB`) on this laptop, or run `small`/`medium` on the future central server.
3. **Limited Free Disk Space (`17.67 GB` free):** Avoid pulling additional large Ollama models, additional Playwright browsers (Firefox/WebKit), or Docker Desktop on this laptop until more disk space is reclaimed.
4. **No Docker Locally:** Container builds and `docker compose` workflows are deferred to the future central server (or after freeing >=10 GB disk and upgrading RAM).

---

## 11. Unresolved Errors & Non-Blocking Warnings

- **Unresolved Errors:** **None.** All selected dependencies installed and passed functional verification.
- **Non-Blocking Warnings Observed:**
  1. *Hugging Face Symlinks Warning on Windows:* `huggingface_hub` logs a symlink warning when Windows Developer Mode is disabled. Caching works normally; suppress in runtime code/env with `HF_HUB_DISABLE_SYMLINKS_WARNING=1`.
  2. *npm Deprecation Notices:* `recharts@2.15.4` (v2 branch; v3 available) and `eslint@9.39.5` emitted standard npm deprecation notices during `npm install`. Both installed and verified cleanly; can be upgraded during frontend architecture setup if desired.
  3. *Transient Network Resets:* Two TCP resets occurred during large downloads (`PostgreSQL` zip and `OllamaSetup.exe`), both recovered cleanly via resumable downloads and verified (including exact SHA256 verification on `OllamaSetup.exe`).

---

## 12. Commands to Start the Development Environment

> Open a **new** PowerShell terminal so the updated User `PATH` (`PostgreSQL\16\bin` and `Ollama`) is loaded.

### 1. Check Environment Health
```powershell
cd "C:\Users\KRISHNA KANTH M\Downloads\ThulasiConnect"
.\scripts\check-env.ps1
```

### 2. Start & Stop Local PostgreSQL 16 (`127.0.0.1:5432`)
```powershell
# Start PostgreSQL
.\scripts\start-postgres.ps1

# Verify connectivity
psql -h 127.0.0.1 -p 5432 -U postgres -d thulasiconnect_dev -c "SELECT version();"

# Stop PostgreSQL cleanly when done
.\scripts\stop-postgres.ps1
```

### 3. Activate Python 3.13 Virtual Environment (Backend / AI / Tests)
```powershell
cd "C:\Users\KRISHNA KANTH M\Downloads\ThulasiConnect"
.\.venv\Scripts\Activate.ps1
python --version
pytest --version
ruff --version
```

### 4. Start Local Ollama Service & Test `qwen2.5:1.5b` (`127.0.0.1:11434`)
```powershell
$env:OLLAMA_HOST = "127.0.0.1:11434"
ollama serve
```
In a second terminal:
```powershell
ollama list
ollama run qwen2.5:1.5b "Hello"
```

### 5. Frontend Tooling Check (`frontend/`)
```powershell
cd "C:\Users\KRISHNA KANTH M\Downloads\ThulasiConnect\frontend"
npx vite --version
npx tsc --version
npx eslint --version
npx playwright --version
```
