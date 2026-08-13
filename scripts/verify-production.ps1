[CmdletBinding()]
param(
    [switch]$SkipBuild,
    [switch]$SkipRuntime,
    [switch]$SkipE2E
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$workspace = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$runtimeRoot = Join-Path $workspace '.tmp-production-verify'
$apiOutDir = Join-Path $runtimeRoot 'api-dist'
$webOutName = '.tmp-production-verify/web-next'
$webOutDir = Join-Path $workspace (Join-Path 'apps/web' $webOutName)
$logDir = Join-Path $runtimeRoot 'logs'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$apiPort = 3101
$webPort = 3100
$apiOrigin = "http://127.0.0.1:$apiPort"
$webOrigin = "http://127.0.0.1:$webPort"
$apiProcess = $null
$webProcess = $null
$webTsConfigPath = Join-Path $workspace 'apps/web/tsconfig.json'
$webTsConfigSnapshot = $null
$webNextEnvPath = Join-Path $workspace 'apps/web/next-env.d.ts'
$webNextEnvSnapshot = $null

function Invoke-Checked {
    param(
        [Parameter(Mandatory = $true)][string]$Label,
        [Parameter(Mandatory = $true)][scriptblock]$Command
    )

    Write-Host "`n[$Label]" -ForegroundColor Cyan
    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "$Label failed with exit code $LASTEXITCODE."
    }
}

function Assert-PortAvailable {
    param([Parameter(Mandatory = $true)][int]$Port)

    $listeners = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue
    if ($listeners) {
        $owners = ($listeners | Select-Object -ExpandProperty OwningProcess -Unique) -join ', '
        throw "Verification port $Port is already in use by PID(s) $owners. No process was stopped."
    }
}

function Wait-ForHttp {
    param(
        [Parameter(Mandatory = $true)][string]$Url,
        [Parameter(Mandatory = $true)]$Process,
        [int]$Retries = 60
    )

    for ($attempt = 1; $attempt -le $Retries; $attempt += 1) {
        if ($Process.HasExited) {
            throw "Process $($Process.Id) exited before $Url became ready."
        }
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
            if ($response.StatusCode -eq 200) {
                Write-Host "READY $Url" -ForegroundColor Green
                return
            }
        } catch {
            Start-Sleep -Seconds 2
        }
    }

    throw "Timed out waiting for $Url."
}

function Stop-OwnedProcess {
    param($Process, [string]$Label)

    if ($null -eq $Process -or $Process.HasExited) { return }
    Write-Host "Stopping $Label PID $($Process.Id)..."
    Stop-Process -Id $Process.Id -ErrorAction SilentlyContinue
    try {
        Wait-Process -Id $Process.Id -Timeout 10 -ErrorAction Stop
    } catch {
        Write-Warning "$Label PID $($Process.Id) did not stop within 10 seconds. It was not force-killed."
    }
}

Push-Location $workspace
try {
    Write-Host '====================================================='
    Write-Host ' HomeLand production verification (non-destructive) '
    Write-Host '====================================================='
    Write-Host 'This script does not delete build caches, stop shared ports, seed data, run migrations, or run CRUD E2E tests.'

    New-Item -ItemType Directory -Force -Path $runtimeRoot, $logDir | Out-Null
    Assert-PortAvailable -Port $apiPort
    Assert-PortAvailable -Port $webPort

    Invoke-Checked 'Encoding' { node scripts/check-mojibake.js }
    Invoke-Checked 'Prisma validate' { & .\node_modules\.bin\prisma.cmd validate --schema=packages/database/prisma/schema.prisma }
    Invoke-Checked 'Prisma migration status (read-only)' { & .\node_modules\.bin\prisma.cmd migrate status --schema=packages/database/prisma/schema.prisma }
    Invoke-Checked 'API typecheck' { npm.cmd run typecheck --workspace=api }
    Invoke-Checked 'Web typecheck' { npm.cmd run typecheck --workspace=web }
    Invoke-Checked 'API unit tests' { npm.cmd run test --workspace=api }
    Invoke-Checked 'Web unit tests' { npm.cmd run test --workspace=web }

    if (-not $SkipBuild) {
        Invoke-Checked 'Shared typecheck' { & .\node_modules\.bin\tsc.cmd -p packages/shared/tsconfig.json --noEmit }
        Invoke-Checked 'API isolated build' { & .\apps\api\node_modules\.bin\tsc.cmd -p apps/api/tsconfig.verify-production.json }

        $env:NEXT_BUILD_DIR = $webOutName
        $env:NEXT_PUBLIC_API_URL = "$apiOrigin/api/v1"
        $env:INTERNAL_API_ORIGIN = $apiOrigin
        $env:NEXT_PUBLIC_ALLOW_REGISTRATION = 'false'
        $webTsConfigSnapshot = Get-Content -LiteralPath $webTsConfigPath -Raw
        $webNextEnvSnapshot = Get-Content -LiteralPath $webNextEnvPath -Raw
        Invoke-Checked 'Web isolated production build' { npm.cmd run build --workspace=web }
        $webTsConfigAfterBuild = Get-Content -LiteralPath $webTsConfigPath -Raw
        if ($webTsConfigAfterBuild -ne $webTsConfigSnapshot) {
            [System.IO.File]::WriteAllText($webTsConfigPath, $webTsConfigSnapshot, [System.Text.UTF8Encoding]::new($false))
            Write-Host 'Restored apps/web/tsconfig.json after Next.js added isolated build type paths.' -ForegroundColor Yellow
        }
        $webNextEnvAfterBuild = Get-Content -LiteralPath $webNextEnvPath -Raw
        if ($webNextEnvAfterBuild -ne $webNextEnvSnapshot) {
            [System.IO.File]::WriteAllText($webNextEnvPath, $webNextEnvSnapshot, [System.Text.UTF8Encoding]::new($false))
            Write-Host 'Restored apps/web/next-env.d.ts after the isolated Next.js build.' -ForegroundColor Yellow
        }
    }

    if (-not $SkipRuntime) {
        $apiEntry = Join-Path $apiOutDir 'src/main.js'
        $webBuildId = Join-Path $webOutDir 'BUILD_ID'
        if (-not (Test-Path -LiteralPath $apiEntry)) { throw "Missing isolated API build: $apiEntry" }
        if (-not (Test-Path -LiteralPath $webBuildId)) { throw "Missing isolated web build: $webBuildId" }

        $env:NODE_ENV = 'production'
        $env:PORT = "$apiPort"
        $env:APP_URL = $apiOrigin
        $env:CORS_ORIGINS = $webOrigin
        $env:DISABLE_SCHEDULED_JOBS = 'true'
        $env:ENABLE_SWAGGER = 'false'
        if (-not $env:JWT_SECRET -or $env:JWT_SECRET.Length -lt 32 -or $env:JWT_SECRET -eq 'homeland_super_secret_key_change_in_production') {
            $env:JWT_SECRET = 'verification-only-loopback-secret-2026-not-for-deployment'
        }

        $apiStdout = Join-Path $logDir "api-$stamp.stdout.log"
        $apiStderr = Join-Path $logDir "api-$stamp.stderr.log"
        $webStdout = Join-Path $logDir "web-$stamp.stdout.log"
        $webStderr = Join-Path $logDir "web-$stamp.stderr.log"

        $apiProcess = Start-Process -FilePath 'node.exe' -ArgumentList $apiEntry -WorkingDirectory $workspace -WindowStyle Hidden -RedirectStandardOutput $apiStdout -RedirectStandardError $apiStderr -PassThru
        Wait-ForHttp -Url "$apiOrigin/api/v1/health" -Process $apiProcess
        Wait-ForHttp -Url "$apiOrigin/api/v1/health/ready" -Process $apiProcess

        $webProcess = Start-Process -FilePath 'node.exe' -ArgumentList @('node_modules/next/dist/bin/next', 'start', 'apps/web', '-p', "$webPort", '-H', '127.0.0.1') -WorkingDirectory $workspace -WindowStyle Hidden -RedirectStandardOutput $webStdout -RedirectStandardError $webStderr -PassThru
        Wait-ForHttp -Url "$webOrigin/login" -Process $webProcess

        if (-not $SkipE2E) {
            if (-not $env:E2E_ADMIN_PASSWORD -or -not $env:E2E_OWNER_A_PASSWORD -or -not $env:E2E_OWNER_B_PASSWORD -or -not $env:E2E_MANAGER_PASSWORD) {
                throw 'E2E_ADMIN_PASSWORD, E2E_OWNER_A_PASSWORD, E2E_OWNER_B_PASSWORD, and E2E_MANAGER_PASSWORD are required for the read-only production E2E gate.'
            }
            $env:VERIFY_PROD = '1'
            $env:E2E_WEB_BASE_URL = $webOrigin
            $env:E2E_API_BASE_URL = $apiOrigin
            Invoke-Checked 'Read-only and mocked production E2E' { npm.cmd run test:e2e:prod --workspace=web }
        }
    }

    Write-Host "`nProduction verification PASSED." -ForegroundColor Green
    Write-Host "Logs: $logDir"
} finally {
    if ($null -ne $webTsConfigSnapshot -and (Test-Path -LiteralPath $webTsConfigPath)) {
        $webTsConfigCurrent = Get-Content -LiteralPath $webTsConfigPath -Raw
        if ($webTsConfigCurrent -ne $webTsConfigSnapshot) {
            [System.IO.File]::WriteAllText($webTsConfigPath, $webTsConfigSnapshot, [System.Text.UTF8Encoding]::new($false))
        }
    }
    if ($null -ne $webNextEnvSnapshot -and (Test-Path -LiteralPath $webNextEnvPath)) {
        $webNextEnvCurrent = Get-Content -LiteralPath $webNextEnvPath -Raw
        if ($webNextEnvCurrent -ne $webNextEnvSnapshot) {
            [System.IO.File]::WriteAllText($webNextEnvPath, $webNextEnvSnapshot, [System.Text.UTF8Encoding]::new($false))
        }
    }
    Stop-OwnedProcess -Process $webProcess -Label 'web verification server'
    Stop-OwnedProcess -Process $apiProcess -Label 'API verification server'
    Pop-Location
}
