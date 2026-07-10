$ErrorActionPreference = 'Stop'

Write-Host "============================================="
Write-Host "   Prisma Gate"
Write-Host "============================================="

New-Item -ItemType Directory -Force -Path "docs/evidence/INFRASTRUCTURE" | Out-Null
$statusPath = "docs/evidence/INFRASTRUCTURE/prisma-migrate-status.txt"
Set-Content -Path $statusPath -Value ""

$ErrorActionPreference = 'Continue'
try {
    Write-Host "Generating Prisma Client..."
    npm run db:generate 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) { throw "npm run db:generate failed" }
    
    Write-Host "Checking migrate status..."
    $statusOutput = npx prisma migrate status --schema=packages/database/prisma/schema.prisma 2>&1 | Out-String
    $statusExit = $LASTEXITCODE
    
    # Dump to evidence
    Add-Content -Path $statusPath -Value $statusOutput
    
    if ($statusExit -ne 0) {
        Write-Host "Prisma Migrate Status: FAIL" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "Running Prisma Probe..."
    npx tsx scripts/infra/run-prisma-probe.ts 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Prisma Query Probe: FAIL" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "Prisma Gate: PASS" -ForegroundColor Green
    exit 0
} catch {
    Write-Host "Prisma Check Error: $_" -ForegroundColor Red
    Add-Content -Path $statusPath -Value "ERROR: $_"
    exit 1
}
