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
            $pidToKill = $conn.OwningProcess
            if ($pidToKill -eq 0 -or $pidToKill -eq 4) { continue } # System Idle or System

            try {
                $proc = Get-Process -Id $pidToKill -ErrorAction Stop
                $procName = $proc.ProcessName.ToLower()
                $protectedProcs = @("com.docker.backend", "docker desktop", "wslhost", "vmmem", "svchost", "system", "wsl")
                
                $isProtected = $false
                foreach ($protected in $protectedProcs) {
                    if ($procName -like "*$protected*") {
                        $isProtected = $true
                        break
                    }
                }

                if ($isProtected) {
                    Write-Host "Skipping protected process $($proc.ProcessName) (PID: $pidToKill) on port $Port" -ForegroundColor Yellow
                } else {
                    Write-Host "Killing process $($proc.ProcessName) (PID: $pidToKill) on port $Port"
                    Stop-Process -Id $pidToKill -Force -ErrorAction SilentlyContinue
                }
            } catch {
                Write-Host "Could not identify or kill PID $pidToKill" -ForegroundColor Yellow
            }
        }
        Start-Sleep -Seconds 2
    }
}

Write-Host "0. Running Infrastructure Gates..." -ForegroundColor Cyan
powershell -ExecutionPolicy Bypass -File scripts/infra/run-all.ps1
if ($LASTEXITCODE -ne 0) {
    Write-Host "INFRASTRUCTURE BLOCKED. Cannot proceed with verify:prod." -ForegroundColor Red
    exit 1
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
