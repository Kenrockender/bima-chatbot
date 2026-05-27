# BIMA — tail backend + frontend logs.
# Usage:  .\scripts\logs.ps1              (both, last 50 lines, follow)
#         .\scripts\logs.ps1 backend      (backend only)
#         .\scripts\logs.ps1 frontend     (frontend only)

param([string]$Target = "both")

switch ($Target.ToLower()) {
    "backend"  { docker logs -f --tail 50 bima-backend }
    "frontend" { docker logs -f --tail 50 bima-frontend }
    "both"     {
        Write-Host "Tailing both. Ctrl+C to stop." -ForegroundColor Cyan
        # Background frontend, foreground backend
        Start-Job -ScriptBlock { docker logs -f --tail 50 bima-frontend } | Out-Null
        docker logs -f --tail 50 bima-backend
    }
    default    { Write-Host "Usage: .\scripts\logs.ps1 [backend|frontend|both]" }
}
