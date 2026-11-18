# ThulasiConnect — Local Setup & Startup Guide (Windows 11)

## Prerequisites (Already Verified in Local Environment)
- **Python 3.13.7** virtual environment at `.venv`
- **Node.js v20.20.2** & **npm 10.8.2**
- **PostgreSQL 16.16** portable binaries at `%LOCALAPPDATA%\Programs\PostgreSQL\16` (cluster at `%LOCALAPPDATA%\ThulasiConnect\pgdata`, database `thulasiconnect_dev`)
- **Ollama 0.40.16** with `qwen2.5:1.5b` downloaded (`http://127.0.0.1:11434`)
- **Faster-Whisper `base`** cached locally at `ai-services/models`

---

## Step-by-Step Startup Commands (Windows PowerShell)

### 1. Check Environment & Service Ports
```powershell
cd "C:\Users\KRISHNA KANTH M\Downloads\ThulasiConnect"
.\scripts\check-env.ps1
```

### 2. Start PostgreSQL 16 (Skip if port `5432` is already listening)
```powershell
cd "C:\Users\KRISHNA KANTH M\Downloads\ThulasiConnect"
.\scripts\start-postgres.ps1
```

### 3. Start Local Ollama Service (Skip if port `11434` is already listening)
```powershell
$env:OLLAMA_HOST = "127.0.0.1:11434"
ollama serve
```

### 4. Apply Any Pending Database Migrations (Non-Destructive)
```powershell
cd "C:\Users\KRISHNA KANTH M\Downloads\ThulasiConnect\backend"
..\.venv\Scripts\alembic.exe upgrade head
```

### 5. Start the FastAPI Backend (`http://127.0.0.1:8000`)
*(Automatically starts the 60-second background overdue escalation scheduler.)*
```powershell
cd "C:\Users\KRISHNA KANTH M\Downloads\ThulasiConnect"
.\scripts\start-backend.ps1
```

### 6. Start the React Frontend (`http://127.0.0.1:5173`)
Open a second PowerShell terminal:
```powershell
cd "C:\Users\KRISHNA KANTH M\Downloads\ThulasiConnect"
.\scripts\start-frontend.ps1
```

---

## Access URLs
- **Web Application:** `http://127.0.0.1:5173`
- **Backend API Base:** `http://127.0.0.1:8000`
- **Interactive OpenAPI / Swagger Docs:** `http://127.0.0.1:8000/docs`
- **Health & Scheduler Status:** `http://127.0.0.1:8000/api/health`

---

## Running Verification Suites
```powershell
cd "C:\Users\KRISHNA KANTH M\Downloads\ThulasiConnect"

# Python Lint
.\.venv\Scripts\ruff.exe check backend\app tests\test_backend_api.py

# Backend API, RBAC, Scheduler, AI & Privacy Tests
$env:TEST_DEV_PASSWORD = "<your-local-dev-password>"
.\.venv\Scripts\pytest.exe tests/test_backend_api.py -v

# Frontend TypeScript, ESLint & Build
cd frontend
npm run typecheck
npm run lint
npm run build

# Playwright Chromium 5-Role E2E Tests (requires backend on :8000 & frontend on :5173)
$env:TEST_DEV_PASSWORD = "<your-local-dev-password>"
npx playwright test --reporter=list
```

## Clean Shutdown
- Press `Ctrl+C` in the Frontend and Backend PowerShell terminals (cancels the background scheduler gracefully).
- Optionally stop PostgreSQL: `.\scripts\stop-postgres.ps1`.
