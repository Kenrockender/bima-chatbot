# BIMA local dev launcher (Windows / PowerShell)
# Prereqs: Python 3.11+, Node 20+, OPENROUTER_API_KEY set in env or .env.
#
# Usage:  .\run-local.ps1
#         (Ctrl+C to stop both servers.)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

# Read OPENROUTER_API_KEY from .env if not already in the environment
if (-not $env:OPENROUTER_API_KEY) {
    $envFile = Join-Path $root ".env"
    if (Test-Path $envFile) {
        Get-Content $envFile | ForEach-Object {
            if ($_ -match '^\s*OPENROUTER_API_KEY\s*=\s*(.+?)\s*$') {
                $env:OPENROUTER_API_KEY = $matches[1].Trim('"').Trim("'")
            }
        }
    }
}
if (-not $env:OPENROUTER_API_KEY) {
    Write-Host "[BIMA] OPENROUTER_API_KEY is not set. Add it to .env or the environment first." -ForegroundColor Yellow
    Write-Host "       Get a key at https://openrouter.ai/keys" -ForegroundColor Yellow
    exit 1
}

# Backend
$backendDir = Join-Path $root "backend"
$venv = Join-Path $backendDir ".venv"
if (-not (Test-Path $venv)) {
    Write-Host "[BIMA] creating Python venv..."
    python -m venv $venv
    & "$venv\Scripts\python.exe" -m pip install --upgrade pip
    & "$venv\Scripts\pip.exe" install -r (Join-Path $backendDir "requirements.txt")
}

$env:ADMIN_PASSWORD = if ($env:ADMIN_PASSWORD) { $env:ADMIN_PASSWORD } else { "changeme" }
$env:SEED_DIR = Join-Path $root "dataset"
$env:SQLITE_PATH = Join-Path $backendDir "data\bima.db"
$env:UPLOAD_DIR = Join-Path $backendDir "data\uploads"

Write-Host "[BIMA] starting backend on :8000..."
$backend = Start-Process -PassThru -NoNewWindow `
    -WorkingDirectory $backendDir `
    -FilePath "$venv\Scripts\python.exe" `
    -ArgumentList "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"

# Frontend
$frontendDir = Join-Path $root "frontend"
if (-not (Test-Path (Join-Path $frontendDir "node_modules"))) {
    Write-Host "[BIMA] installing frontend deps..."
    Push-Location $frontendDir
    npm install --legacy-peer-deps
    Pop-Location
}

Write-Host "[BIMA] starting frontend on :3000..."
$frontend = Start-Process -PassThru -NoNewWindow `
    -WorkingDirectory $frontendDir `
    -FilePath "npm" `
    -ArgumentList "run", "dev"

Write-Host ""
Write-Host "[BIMA] running."
Write-Host "  Chat:  http://localhost:3000"
Write-Host "  Admin: http://localhost:3000/admin   (password: $($env:ADMIN_PASSWORD))"
Write-Host "  API:   http://localhost:8000/docs"
Write-Host ""
Write-Host "Press Ctrl+C to stop."

try {
    Wait-Process -Id $backend.Id, $frontend.Id
} finally {
    Stop-Process -Id $backend.Id -ErrorAction SilentlyContinue
    Stop-Process -Id $frontend.Id -ErrorAction SilentlyContinue
}
