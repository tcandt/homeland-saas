$ErrorActionPreference = 'Stop'

Write-Host "============================================="
Write-Host "   Phase 1: Production Build Verification    "
Write-Host "============================================="

function Kill-Port {
    param([int]$Port)
    Write-Host "Checking port $Port..."
    $conns = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    if ($conns) {
        foreach ($conn in $conns) {
            Write-Host "Killing process $($conn.OwningProcess) on port $Port"
            Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
        }
        Start-Sleep -Seconds 2
    }
}

Write-Host "1. Stopping ports 3000, 3001..."
Kill-Port 3000
Kill-Port 3001

Write-Host "2. Cleaning .next cache..."
if (Test-Path "apps\web\.next") {
    Remove-Item -Recurse -Force "apps\web\.next"
}

Write-Host "3. Building API..."
npm run build --workspace=api
if ($LASTEXITCODE -ne 0) { throw "API Build Failed" }

Write-Host "4. Building Web..." -ForegroundColor Cyan
npm run build --workspace=web
if ($LASTEXITCODE -ne 0) { throw "Web Build Failed" }

Write-Host "5. Starting API production server..." -ForegroundColor Cyan
$npmCmd = if ($IsWindows -or $env:OS -match "Windows") { "npm.cmd" } else { "npm" }
$apiProcess = Start-Process -FilePath $npmCmd -ArgumentList "run start:prod --workspace=api" -PassThru -NoNewWindow
Start-Sleep -Seconds 3

Write-Host "6. Starting Web production server..." -ForegroundColor Cyan
$webProcess = Start-Process -FilePath $npmCmd -ArgumentList "run start --workspace=web" -PassThru -NoNewWindow

function Wait-For-HealthCheck {
    param([string]$Url, [int]$Retries = 30)
    Write-Host "Waiting for $Url to be ready..."
    for ($i = 0; $i -lt $Retries; $i++) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
            if ($response.StatusCode -eq 200) {
                Write-Host "  -> Ready ($Url)"
                return
            }
        } catch {
            # Ignore and retry
        }
        Start-Sleep -Seconds 2
    }
    throw "Timeout waiting for $Url"
}

try {
    Write-Host "7. Waiting for Health Endpoints..."
    Wait-For-HealthCheck "http://127.0.0.1:3001/api/v1/health"
    Wait-For-HealthCheck "http://127.0.0.1:3001/api/v1/health/ready"
    Wait-For-HealthCheck "http://127.0.0.1:3000/buildings"

    Write-Host "8. Running Playwright Property Production Test..."
    npm run test:e2e:prod --workspace=web
    $pwExit = $LASTEXITCODE

    Write-Host "9. Evidence Package Collected."
} finally {
    Write-Host "10. Shutting down spawned processes..."
    if ($apiProcess -and -not $apiProcess.HasExited) { Stop-Process -Id $apiProcess.Id -Force }
    if ($webProcess -and -not $webProcess.HasExited) { Stop-Process -Id $webProcess.Id -Force }
    
    # Failsafe kill
    Kill-Port 3000
    Kill-Port 3001
}

if ($pwExit -ne 0) {
    Write-Host "Verification FAILED. Check Evidence Package." -ForegroundColor Red
    exit 1
} else {
    Write-Host "Verification PASSED." -ForegroundColor Green
}
