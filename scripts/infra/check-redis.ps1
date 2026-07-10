$ErrorActionPreference = 'Stop'

Write-Host "============================================="
Write-Host "   Redis Gate"
Write-Host "============================================="

New-Item -ItemType Directory -Force -Path "docs/evidence/INFRASTRUCTURE" | Out-Null
$evidencePath = "docs/evidence/INFRASTRUCTURE/redis.txt"
Set-Content -Path $evidencePath -Value ""

try {
    $ping = docker exec homeland_redis redis-cli ping 2>&1
    if ($LASTEXITCODE -ne 0 -or $ping -notmatch "PONG") {
        Write-Host "Redis internal ping failed" -ForegroundColor Red
        Add-Content -Path $evidencePath -Value "INTERNAL_PING_FAIL"
        exit 1
    }
    
    $tcp = Test-NetConnection 127.0.0.1 -Port 6379 -WarningAction SilentlyContinue
    if (-not $tcp.TcpTestSucceeded) {
        Write-Host "Redis host TCP 6379 failed" -ForegroundColor Red
        Add-Content -Path $evidencePath -Value "HOST_TCP_FAIL"
        exit 1
    }
    
    Write-Host "Redis Gate: PASS" -ForegroundColor Green
    Add-Content -Path $evidencePath -Value "REDIS_PASS"
    exit 0
} catch {
    Write-Host "Redis Check Error: $_" -ForegroundColor Red
    Add-Content -Path $evidencePath -Value "REDIS_ERROR: $_"
    exit 1
}
