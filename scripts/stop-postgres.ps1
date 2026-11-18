# Gracefully stops the local ThulasiConnect PostgreSQL 16 portable cluster
$ErrorActionPreference = "Stop"

$pgBin = Join-Path $env:LOCALAPPDATA "Programs\PostgreSQL\16\bin"
$pgData = Join-Path $env:LOCALAPPDATA "ThulasiConnect\pgdata"
$pgCtl = Join-Path $pgBin "pg_ctl.exe"

if (-not (Test-Path $pgCtl)) {
    Write-Error "PostgreSQL 16 binaries not found at $pgBin."
    exit 1
}

$status = & $pgCtl -D $pgData status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "PostgreSQL 16 is not currently running."
    exit 0
}

Write-Host "Stopping PostgreSQL 16..."
& $pgCtl -D $pgData -m fast stop
