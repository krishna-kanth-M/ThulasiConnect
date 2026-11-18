# Verifies ThulasiConnect local development readiness
$root = Split-Path -Parent $PSScriptRoot
$venvPy = Join-Path $root ".venv\Scripts\python.exe"
$pgBin = Join-Path $env:LOCALAPPDATA "Programs\PostgreSQL\16\bin"
$ollamaBin = Join-Path $env:LOCALAPPDATA "Programs\Ollama"

if (Test-Path $pgBin) { $env:Path = "$env:Path;$pgBin" }
if (Test-Path $ollamaBin) { $env:Path = "$env:Path;$ollamaBin" }

Write-Host "=== ThulasiConnect Environment Health Check ==="
Write-Host ("Git:        " + (git --version 2>&1))
Write-Host ("Python:     " + (python --version 2>&1))
if (Test-Path $venvPy) {
    Write-Host ("Venv Py:    " + (& $venvPy --version 2>&1))
} else {
    Write-Host "Venv Py:    MISSING (.venv not found)"
}
Write-Host ("Node.js:    " + (node --version 2>&1))
Write-Host ("npm:        " + (npm --version 2>&1))
Write-Host ("PostgreSQL: " + (psql --version 2>&1))
Write-Host ("Ollama:     " + (ollama --version 2>&1))

$c = Get-PSDrive C
Write-Host ("C: Free:    {0:N2} GB / {1:N2} GB" -f ($c.Free / 1GB), (($c.Used + $c.Free) / 1GB))

Write-Host "`n=== Service Ports ==="
foreach ($port in @(5173, 5432, 8000, 11434)) {
    $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($conn) {
        $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
        Write-Host ("Port {0,-5}: LISTENING ({1})" -f $port, $proc.ProcessName)
    } else {
        Write-Host ("Port {0,-5}: AVAILABLE" -f $port)
    }
}
