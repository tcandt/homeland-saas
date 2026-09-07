param(
    [string]$TargetVersion = "",
    [string]$Workspace = (Resolve-Path -LiteralPath ".").Path,
    [string]$UpdateRoot = "",
    [switch]$AllowSwitch
)

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Status, [int]$Progress, [string]$Message)
    Write-Output "SYSTEM_UPDATE_STEP $Status $Progress $Message"
}

$workspacePath = (Resolve-Path -LiteralPath $Workspace).Path
if (-not $UpdateRoot) { $UpdateRoot = Join-Path $workspacePath ".codex-update" }
$updateRootPath = if (Test-Path -LiteralPath $UpdateRoot) { (Resolve-Path -LiteralPath $UpdateRoot).Path } else { (New-Item -ItemType Directory -Path $UpdateRoot -Force).FullName }
$env:SYSTEM_UPDATE_ROOT = $updateRootPath
$lastInstallPath = Join-Path $updateRootPath "last-install-manifest.json"
$gitCurrentVersion = $null
if (Get-Command git -ErrorAction SilentlyContinue) {
    try {
        $gitCurrentVersion = & git -C $workspacePath rev-parse HEAD 2>$null
        if ($LASTEXITCODE -ne 0) { $gitCurrentVersion = $null }
    } catch {
        $gitCurrentVersion = $null
    }
}
$currentVersion = if ($gitCurrentVersion) {
    ($gitCurrentVersion | Select-Object -First 1).Trim()
} elseif ($env:COMMIT_SHA) {
    $env:COMMIT_SHA
} elseif ($env:APP_VERSION) {
    $env:APP_VERSION
} else {
    "unknown"
}

Write-Step "CHECKING" 8 "Preparing rollback."
$lastInstall = if (Test-Path -LiteralPath $lastInstallPath) {
    Get-Content -LiteralPath $lastInstallPath -Raw | ConvertFrom-Json
} else { $null }
if (-not $TargetVersion -and $lastInstall) { $TargetVersion = $lastInstall.currentVersion }
if (-not $TargetVersion) { throw "Target rollback version is required." }
if (-not $lastInstall) { throw "Last install manifest is required to resolve the rollback release." }
$rollbackReleasePath = if ($lastInstall.currentVersion -eq $TargetVersion) {
    [string]$lastInstall.previousReleasePath
} else { "" }
if (-not $rollbackReleasePath -or -not (Test-Path -LiteralPath $rollbackReleasePath -PathType Container)) {
    throw "Rollback target does not match a valid previous release in the last install manifest."
}
$rollbackAppVersion = [string]$lastInstall.previousAppVersion
$rollbackCommitSha = if ($lastInstall.previousCommitSha) {
    [string]$lastInstall.previousCommitSha
} elseif ($TargetVersion -match '^[0-9a-fA-F]{40}$|^[0-9a-fA-F]{64}$') {
    $TargetVersion
} else { "" }
if (-not $rollbackAppVersion -and (Test-Path -LiteralPath (Join-Path $rollbackReleasePath "package.json"))) {
    try {
        $declaredVersion = & node -p "require(process.argv[1]).version" (Join-Path $rollbackReleasePath "package.json") 2>$null
        if ($LASTEXITCODE -eq 0 -and $declaredVersion -match '^v?[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$') {
            $rollbackAppVersion = "v$(([string]$declaredVersion).Trim() -replace '^v+', '')"
        }
    } catch {
        $rollbackAppVersion = ""
    }
}
if (-not $rollbackCommitSha -and (Get-Command git -ErrorAction SilentlyContinue)) {
    try {
        $releaseCommit = & git -C $rollbackReleasePath rev-parse 'HEAD^{commit}' 2>$null
        if ($LASTEXITCODE -eq 0 -and $releaseCommit -match '^([0-9a-fA-F]{40}|[0-9a-fA-F]{64})$') {
            $rollbackCommitSha = ([string]$releaseCommit).Trim()
        }
    } catch {
        $rollbackCommitSha = ""
    }
}

$manifest = @{
    type = "rollback"
    currentVersion = $currentVersion
    targetVersion = $TargetVersion
    targetRef = $rollbackCommitSha
    appVersion = $rollbackAppVersion
    releasePath = $rollbackReleasePath
    switched = $false
    restartRequested = $false
    finishedAt = (Get-Date).ToString("o")
    status = "PREPARED"
    note = "Database restore is not automatic. Restore the matching dump manually if a migration changed data or schema."
}

Write-Step "BACKING_UP" 35 "Rollback metadata prepared; database restore remains manual."
Write-Step "SWITCHING" 70 "Preparing active version switch."

if ($AllowSwitch -or $env:SYSTEM_UPDATE_ALLOW_SWITCH -eq "true") {
    $currentManifestPath = Join-Path $updateRootPath "current.json"
    $manifest.switched = $true
    $manifest.status = "ROLLED_BACK"
    $manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $currentManifestPath -Encoding UTF8

    if ($env:SYSTEM_UPDATE_RESTART_COMMAND) {
        Write-Step "RESTARTING" 90 "Restart command configured; running service restart."
        if ($rollbackAppVersion) { $env:APP_VERSION = $rollbackAppVersion } else { Remove-Item Env:\APP_VERSION -ErrorAction SilentlyContinue }
        if ($rollbackCommitSha) { $env:COMMIT_SHA = $rollbackCommitSha } else { Remove-Item Env:\COMMIT_SHA -ErrorAction SilentlyContinue }
        $env:SYSTEM_UPDATE_ROOT = $updateRootPath
        $global:LASTEXITCODE = 0
        Invoke-Expression $env:SYSTEM_UPDATE_RESTART_COMMAND
        if ($LASTEXITCODE -ne 0) { throw "Rollback restart command failed with code $LASTEXITCODE" }
        $manifest.restartRequested = $true
    } else {
        Write-Step "RESTARTING" 90 "No restart command configured; service manager must restart manually."
    }
} else {
    Write-Step "BLOCKED" 90 "Rollback target verified, but switching is disabled; set SYSTEM_UPDATE_ALLOW_SWITCH=true after service manager is ready."
}

$manifestPath = Join-Path $updateRootPath "last-rollback-manifest.json"
$manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $manifestPath -Encoding UTF8
if ($manifest.switched) {
    Write-Step "ROLLED_BACK" 100 "Rollback runner completed."
} else {
    Write-Step "BLOCKED" 100 "Rollback was prepared but no active release was switched."
}
Write-Output "SYSTEM_UPDATE_MANIFEST $manifestPath"
