# Sera — start everything from cold.
# Usage:  .\scripts\start.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

Write-Host ""
Write-Host "[Sera] checking .env for OPENROUTER_API_KEY..." -ForegroundColor Cyan
$envFile = Join-Path $root ".env"
if (-not (Test-Path $envFile)) {
    Write-Host "       .env not found. Copy .env.example to .env and set OPENROUTER_API_KEY." -ForegroundColor Red
    exit 1
}
$keyLine = Get-Content $envFile | Where-Object { $_ -match '^\s*OPENROUTER_API_KEY\s*=\s*\S' }
if (-not $keyLine) {
    Write-Host "       OPENROUTER_API_KEY is empty in .env. Get a key at https://openrouter.ai/keys" -ForegroundColor Red
    exit 1
}
Write-Host "       OK" -ForegroundColor Green

Write-Host ""
Write-Host "[Sera] checking Docker..." -ForegroundColor Cyan
$dockerUp = $false
try {
    docker info 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) {
        $dockerUp = $true
        Write-Host "       OK" -ForegroundColor Green
    }
} catch {}
if (-not $dockerUp) {
    $dd = "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe"
    if (-not (Test-Path $dd)) {
        Write-Host "       Docker Desktop not found. Install it first." -ForegroundColor Red
        exit 1
    }
    Write-Host "       starting Docker Desktop... (may take ~60s)"
    Start-Process -FilePath $dd
    for ($i = 0; $i -lt 90; $i++) {
        Start-Sleep -Seconds 2
        docker info 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) {
            $dockerUp = $true
            break
        }
    }
    if (-not $dockerUp) {
        Write-Host "       Docker still not ready after 3min." -ForegroundColor Red
        exit 1
    }
    Write-Host "       OK" -ForegroundColor Green
}

Write-Host ""
Write-Host "[Sera] starting containers..." -ForegroundColor Cyan
Push-Location $root
try {
    docker compose -f docker-compose.local.yml up -d
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "[Sera] ready." -ForegroundColor Green
Write-Host "       Chat:  http://localhost:3000"
Write-Host "       Admin: http://localhost:3000/admin   (password from .env)"
Write-Host "       API:   http://localhost:8000/docs"
Write-Host ""
