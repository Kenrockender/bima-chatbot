# BIMA — quick smoke test: starts a session with Ibu Sari and sends one FA message.
# Usage:  .\scripts\smoke-test.ps1

$ErrorActionPreference = "Stop"

function Check($label, $url) {
    try {
        $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3
        Write-Host "  $label : $($r.StatusCode)" -ForegroundColor Green
        return $true
    } catch {
        Write-Host "  $label : DOWN" -ForegroundColor Red
        return $false
    }
}

Write-Host ""
Write-Host "[1/4] health checks" -ForegroundColor Cyan
$ok1 = Check "backend " "http://localhost:8000/health"
$ok2 = Check "frontend" "http://localhost:3000"
if (-not ($ok1 -and $ok2)) {
    Write-Host ""
    Write-Host "Some services are down. Run .\scripts\start.ps1 first." -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "[2/4] listing personas" -ForegroundColor Cyan
$personas = Invoke-RestMethod -Uri "http://localhost:8000/api/training/personas"
foreach ($p in $personas) {
    Write-Host ("  " + $p.name.PadRight(14) + " (" + $p.challenge + ") - " + $p.title)
}

Write-Host ""
Write-Host "[3/4] starting roleplay with Ibu Sari" -ForegroundColor Cyan
$body = @{ persona_id = "cautious_mom" } | ConvertTo-Json
$sw1 = [Diagnostics.Stopwatch]::StartNew()
$start = Invoke-RestMethod -Uri "http://localhost:8000/api/training/start" -Method Post -Body $body -ContentType "application/json"
$sw1.Stop()
Write-Host "  session : $($start.session_id)  ($($sw1.ElapsedMilliseconds)ms)"
Write-Host "  opening :" -NoNewline
Write-Host " $($start.opening_message)" -ForegroundColor Gray

Write-Host ""
Write-Host "[4/4] FA reply -> customer turn (this is the real latency test)" -ForegroundColor Cyan
$msg = "Halo Ibu Sari, salam kenal. Saya mau bantu cari proteksi yang pas untuk keluarga ibu. Boleh saya tanya dulu, anak ibu berapa orang ya?"
Write-Host "  FA      :" -NoNewline
Write-Host " $msg" -ForegroundColor Gray

$body = @{ session_id = $start.session_id; message = $msg } | ConvertTo-Json
$sw2 = [Diagnostics.Stopwatch]::StartNew()
$reply = Invoke-RestMethod -Uri "http://localhost:8000/api/training/chat" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 300
$sw2.Stop()
$elapsed = [math]::Round($sw2.Elapsed.TotalSeconds, 1)
Write-Host "  customer:" -NoNewline
Write-Host " $($reply.reply)" -ForegroundColor White
Write-Host "  (${elapsed}s)" -ForegroundColor DarkGray

if ($reply.facts_referenced -and $reply.facts_referenced.Count -gt 0) {
    Write-Host "  docs in context:" -ForegroundColor DarkGray
    foreach ($f in $reply.facts_referenced) {
        Write-Host "    - $($f.name)" -ForegroundColor DarkGray
    }
}

Write-Host ""
Write-Host "Smoke test complete." -ForegroundColor Green
Write-Host "Open http://localhost:3000 to use the full UI."
Write-Host ""
