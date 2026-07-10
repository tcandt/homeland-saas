$ErrorActionPreference = 'Stop'

Write-Host "============================================="
Write-Host "   PostgreSQL Gate"
Write-Host "============================================="

New-Item -ItemType Directory -Force -Path "docs/evidence/INFRASTRUCTURE" | Out-Null
$internalEvidence = "docs/evidence/INFRASTRUCTURE/postgres-internal.txt"
$hostEvidence = "docs/evidence/INFRASTRUCTURE/postgres-host-port.txt"
Set-Content -Path $internalEvidence -Value ""
Set-Content -Path $hostEvidence -Value ""

$internalReady = $false

# 1. Internal Readiness
try {
    $pgReady = docker exec homeland_postgres pg_isready -U homeland -d homeland 2>&1
    if ($LASTEXITCODE -eq 0 -and $pgReady -match "accepting connections") {
        Write-Host "Internal PostgreSQL: READY"
        Add-Content -Path $internalEvidence -Value "INTERNAL_READY"
        $internalReady = $true
    } else {
        Write-Host "Internal PostgreSQL: NOT READY" -ForegroundColor Red
        Add-Content -Path $internalEvidence -Value "INTERNAL_NOT_READY: $pgReady"
    }
} catch {
    Write-Host "Internal PostgreSQL: EXEC FAILED" -ForegroundColor Red
    Add-Content -Path $internalEvidence -Value "INTERNAL_EXEC_FAILED"
}

# Dump logs for evidence
try {
    $logs = docker logs homeland_postgres --tail 100 2>&1
    Add-Content -Path $internalEvidence -Value "`n--- DOCKER LOGS ---`n$logs"
} catch {}

# 2. Host Port Check
try {
    $dockerPort = docker compose port postgres 5432 2>&1
    if ($LASTEXITCODE -ne 0) { throw "docker compose port failed" }
    
    $inspect = docker inspect homeland_postgres --format '{{json .NetworkSettings.Ports}}' 2>&1
    if ($LASTEXITCODE -ne 0) { throw "docker inspect failed" }
    
    $tcp = Test-NetConnection 127.0.0.1 -Port 5433 -WarningAction SilentlyContinue
    if ($tcp.TcpTestSucceeded) {
        Write-Host "Host TCP 5433: PASS"
        Add-Content -Path $hostEvidence -Value "HOST_TCP_PASS"
        
        if ($internalReady) {
            Write-Host "PostgreSQL Gate: PASS" -ForegroundColor Green
            exit 0
        } else {
            Write-Host "PostgreSQL Gate: FAIL (Internal not ready)" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "Host TCP 5433: FAIL" -ForegroundColor Red
        if ($internalReady) {
            Add-Content -Path $hostEvidence -Value "DOCKER_PORT_PUBLISH_FAILURE"
            Write-Host "DOCKER_PORT_PUBLISH_FAILURE: Internal is ready but host cannot connect!" -ForegroundColor Red
        } else {
            Add-Content -Path $hostEvidence -Value "HOST_TCP_FAIL"
        }
        exit 1
    }
} catch {
    Write-Host "Host TCP Check Error: $_" -ForegroundColor Red
    Add-Content -Path $hostEvidence -Value "HOST_CHECK_ERROR: $_"
    exit 1
}
