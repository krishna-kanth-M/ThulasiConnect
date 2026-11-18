# Starts the ThulasiConnect Vite React frontend on http://127.0.0.1:5173
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location (Join-Path $root "frontend")
Write-Host "Starting ThulasiConnect frontend on http://127.0.0.1:5173 ..."
npm run dev
