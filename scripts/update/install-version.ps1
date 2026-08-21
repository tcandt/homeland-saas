param(
    [Parameter(Mandatory = $true)]
    [string]$TargetVersion,

    [string]$Repository = "https://github.com/tcandt/homeland-saas.git",
    [string]$Workspace = (Resolve-Path -LiteralPath ".").Path,
    [string]$UpdateRoot = "",
    [switch]$AllowSwitch
)

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Status, [int]$Progress, [string]$Message)
    Write-Output "SYSTEM_UPDATE_STEP $Status $Progress $Message"
}

function Get-EnvValue {
    param([string]$Path, [string]$Key)
    if (-not (Test-Path -LiteralPath $Path)) { return $null }
    $line = Get-Content -LiteralPath $Path | Where-Object { $_ -match "^\s*$([regex]::Escape($Key))\s*=" } | Select-Object -First 1
    if (-not $line) { return $null }
    return ($line -replace "^\s*$([regex]::Escape($Key))\s*=\s*", "").Trim().Trim('"')
}

function Backup-Database {
    param([string]$EnvPath, [string]$BackupDir)
    $databaseUrl = Get-EnvValue -Path $EnvPath -Key "DATABASE_URL"
    if (-not $databaseUrl) {
        Write-Step "BACKING_UP" 28 "DATABASE_URL not found; database backup skipped."
        return $null
    }

    $pgDump = $env:SYSTEM_UPDATE_PG_DUMP_PATH
    if (-not $pgDump) { $pgDump = "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe" }
    if (-not (Test-Path -LiteralPath $pgDump)) {
        Write-Step "BACKING_UP" 30 "pg_dump not found; database backup skipped."
        return $null
    }

    $uri = [Uri]$databaseUrl
    $dbName = $uri.AbsolutePath.TrimStart("/")
    $queryIndex = $dbName.IndexOf("?")
    if ($queryIndex -ge 0) { $dbName = $dbName.Substring(0, $queryIndex) }
    $userInfo = $uri.UserInfo.Split(":", 2)
    $dbUser = [Uri]::UnescapeDataString($userInfo[0])
    $env:PGPASSWORD = if ($userInfo.Count -gt 1) { [Uri]::UnescapeDataString($userInfo[1]) } else { "" }
    $dumpPath = Join-Path $BackupDir "database.dump"
    & $pgDump -h $uri.Host -p $uri.Port -U $dbUser -d $dbName -F c -f $dumpPath
    $exit = $LASTEXITCODE
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
    if ($exit -ne 0) { throw "pg_dump failed with code $exit" }
    Write-Step "BACKING_UP" 35 "Database backup created."
    return $dumpPath
}

$workspacePath = (Resolve-Path -LiteralPath $Workspace).Path
if (-not $UpdateRoot) { $UpdateRoot = Join-Path $workspacePath ".codex-update" }
$updateRootPath = if (Test-Path -LiteralPath $UpdateRoot) { (Resolve-Path -LiteralPath $UpdateRoot).Path } else { (New-Item -ItemType Directory -Path $UpdateRoot -Force).FullName }
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$safeVersion = ($TargetVersion -replace "[^0-9A-Za-z_.-]", "_")
$releasePath = Join-Path (Join-Path $updateRootPath "releases") "$stamp-$safeVersion"
$backupRoot = Join-Path $workspacePath ".codex-backups\system-update"
$backupPath = Join-Path $backupRoot "$stamp-before-$safeVersion"
$manifestPath = Join-Path $updateRootPath "last-install-manifest.json"

if (Test-Path -LiteralPath $releasePath) { throw "Release path already exists: $releasePath" }
New-Item -ItemType Directory -Path $releasePath | Out-Null
New-Item -ItemType Directory -Path $backupPath -Force | Out-Null

Write-Step "CHECKING" 5 "Preparing update to $TargetVersion."
$currentVersion = (& git -C $workspacePath rev-parse HEAD).Trim()

Write-Step "BACKING_UP" 20 "Backing up env and metadata."
$envPath = Join-Path $workspacePath ".env"
if (Test-Path -LiteralPath $envPath) { Copy-Item -LiteralPath $envPath -Destination (Join-Path $backupPath ".env") }
@{
    currentVersion = $currentVersion
    targetVersion = $TargetVersion
    createdAt = (Get-Date).ToString("o")
    workspace = $workspacePath
} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $backupPath "metadata.json") -Encoding UTF8
$databaseBackup = Backup-Database -EnvPath $envPath -BackupDir $backupPath

Write-Step "DOWNLOADING" 42 "Cloning target source into isolated release directory."
& git clone --no-checkout $Repository $releasePath
if ($LASTEXITCODE -ne 0) { throw "git clone failed with code $LASTEXITCODE" }
& git -C $releasePath checkout $TargetVersion
if ($LASTEXITCODE -ne 0) { throw "git checkout failed with code $LASTEXITCODE" }
if (Test-Path -LiteralPath $envPath) { Copy-Item -LiteralPath $envPath -Destination (Join-Path $releasePath ".env") }

if ($env:SYSTEM_UPDATE_RUN_BUILD -ne "false") {
    Write-Step "BUILDING" 56 "Installing dependencies from lockfile."
    $npm = if ($env:SYSTEM_UPDATE_NPM_PATH) { $env:SYSTEM_UPDATE_NPM_PATH } else { "npm.cmd" }
    & $npm ci --prefix $releasePath
    if ($LASTEXITCODE -ne 0) { throw "npm ci failed with code $LASTEXITCODE" }

    Write-Step "BUILDING" 68 "Building release."
    & $npm run build --prefix $releasePath
    if ($LASTEXITCODE -ne 0) { throw "npm build failed with code $LASTEXITCODE" }
} else {
    Write-Step "BUILDING" 68 "Build skipped by SYSTEM_UPDATE_RUN_BUILD=false."
}

Write-Step "MIGRATING" 76 "Migration is not applied automatically by this runner."
Write-Step "HEALTH_CHECK" 84 "Running source preflight checks."
& node (Join-Path $releasePath "scripts\check-mojibake.js")
if ($LASTEXITCODE -ne 0) { throw "check-mojibake failed with code $LASTEXITCODE" }

$manifest = @{
    type = "install"
    currentVersion = $currentVersion
    targetVersion = $TargetVersion
    releasePath = $releasePath
    backupPath = $backupPath
    databaseBackup = $databaseBackup
    switched = $false
    restartRequested = $false
    finishedAt = (Get-Date).ToString("o")
}

if ($AllowSwitch -or $env:SYSTEM_UPDATE_ALLOW_SWITCH -eq "true") {
    Write-Step "SWITCHING" 90 "Writing active version manifest."
    $currentManifestPath = Join-Path $updateRootPath "current.json"
    $manifest.switched = $true
    $manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $currentManifestPath -Encoding UTF8

    if ($env:SYSTEM_UPDATE_RESTART_COMMAND) {
        Write-Step "RESTARTING" 94 "Restart command configured; running service restart."
        Invoke-Expression $env:SYSTEM_UPDATE_RESTART_COMMAND
        $manifest.restartRequested = $true
    } else {
        Write-Step "RESTARTING" 94 "No restart command configured; service manager must restart manually."
    }
} else {
    Write-Step "SWITCHING" 90 "Switch skipped; set SYSTEM_UPDATE_ALLOW_SWITCH=true after service manager is ready."
}

$manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $manifestPath -Encoding UTF8
Write-Step "DONE" 100 "Update runner completed."
Write-Output "SYSTEM_UPDATE_MANIFEST $manifestPath"
