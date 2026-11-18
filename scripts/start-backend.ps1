# Starts the ThulasiConnect FastAPI backend on http://127.0.0.1:8000
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$py = Join-Path $root ".venv\Scripts\python.exe"

if (-not (Test-Path $py)) {
    Write-Error "Python virtual environment not found at $py"
    exit 1
}

Set-Location (Join-Path $root "backend")
Write-Host "Starting ThulasiConnect FastAPI backend on http://127.0.0.1:8000 ..."
& $py -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
