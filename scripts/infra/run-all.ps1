$ErrorActionPreference = 'Stop'

Write-Host "============================================="
Write-Host "   INFRASTRUCTURE AUTOMATION GATE"
Write-Host "============================================="

New-Item -ItemType Directory -Force -Path "docs/evidence/INFRASTRUCTURE" | Out-Null
$receiptPath = "docs/evidence/INFRASTRUCTURE/infrastructure-receipt.txt"

try {
    powershell -ExecutionPolicy Bypass -File scripts/infra/check-env.ps1
    powershell -ExecutionPolicy Bypass -File scripts/infra/check-docker.ps1
    powershell -ExecutionPolicy Bypass -File scripts/infra/check-postgres.ps1
    powershell -ExecutionPolicy Bypass -File scripts/infra/check-redis.ps1
    powershell -ExecutionPolicy Bypass -File scripts/infra/check-prisma.ps1
    
    Set-Content -Path $receiptPath -Value "INFRASTRUCTURE_PASS"
    Write-Host "ALL INFRASTRUCTURE GATES PASSED." -ForegroundColor Green
    exit 0
} catch {
    Write-Host "INFRASTRUCTURE GATE FAILED." -ForegroundColor Red
    Set-Content -Path $receiptPath -Value "INFRASTRUCTURE_BLOCKED"
    exit 1
}
