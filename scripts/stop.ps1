# Sera — stop containers (data persists in volumes).
# Usage:  .\scripts\stop.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

Write-Host "[Sera] stopping containers..." -ForegroundColor Cyan
Push-Location $root
try {
    docker compose -f docker-compose.local.yml down
} finally {
    Pop-Location
}

Write-Host "[Sera] stopped. Data preserved in docker volumes (backend_data)." -ForegroundColor Green
