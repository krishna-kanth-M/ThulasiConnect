# Starts the local ThulasiConnect PostgreSQL 16 portable cluster on 127.0.0.1:5432
$ErrorActionPreference = "Stop"

$pgBin = Join-Path $env:LOCALAPPDATA "Programs\PostgreSQL\16\bin"
$pgData = Join-Path $env:LOCALAPPDATA "ThulasiConnect\pgdata"
$pgLog = Join-Path $env:LOCALAPPDATA "ThulasiConnect\postgresql.log"
$pgCtl = Join-Path $pgBin "pg_ctl.exe"

if (-not (Test-Path $pgCtl)) {
    Write-Error "PostgreSQL 16 binaries not found at $pgBin."
    exit 1
}

if (-not (Test-Path (Join-Path $pgData "PG_VERSION"))) {
    Write-Error "PostgreSQL data directory not initialized at $pgData."
    exit 1
}

$status = & $pgCtl -D $pgData status 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "PostgreSQL 16 is already running."
    exit 0
}

Write-Host "Starting PostgreSQL 16 on 127.0.0.1:5432..."
& $pgCtl -D $pgData -l $pgLog -o "-h 127.0.0.1 -p 5432" start
