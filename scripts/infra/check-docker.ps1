$ErrorActionPreference = 'Stop'

Write-Host "============================================="
Write-Host "   Docker Gate"
Write-Host "============================================="

New-Item -ItemType Directory -Force -Path "docs/evidence/INFRASTRUCTURE" | Out-Null
$evidencePath = "docs/evidence/INFRASTRUCTURE/docker.txt"
Set-Content -Path $evidencePath -Value ""

$ErrorActionPreference = 'Continue'
try {
    $info = docker info 2>&1
    if ($LASTEXITCODE -ne 0) { throw "docker info failed" }
} catch {
    Write-Host "DOCKER_DAEMON_DOWN: Cannot reach Docker daemon" -ForegroundColor Red
    Add-Content -Path $evidencePath -Value "DOCKER_DAEMON_DOWN"
    exit 1
}

try {
    $compose = docker compose ps 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) { throw "docker compose ps failed" }
    
    if ($compose -notmatch "homeland_postgres" -or $compose -notmatch "homeland_redis") {
        Write-Host "COMPOSE_PROJECT_NOT_READY: Expected containers not found" -ForegroundColor Red
        Add-Content -Path $evidencePath -Value "COMPOSE_PROJECT_NOT_READY"
        exit 1
    }
} catch {
    Write-Host "COMPOSE_ERROR: Failed to run docker compose ps" -ForegroundColor Red
    Add-Content -Path $evidencePath -Value "COMPOSE_ERROR"
    exit 1
}

Write-Host "Docker is reachable and compose project is running."
Add-Content -Path $evidencePath -Value "DOCKER_READY"
exit 0
