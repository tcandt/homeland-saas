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
$lastInstallPath = Join-Path $updateRootPath "last-install-manifest.json"
$currentVersion = (& git -C $workspacePath rev-parse HEAD).Trim()

Write-Step "CHECKING" 8 "Preparing rollback."
if (-not $TargetVersion -and (Test-Path -LiteralPath $lastInstallPath)) {
    $lastInstall = Get-Content -LiteralPath $lastInstallPath -Raw | ConvertFrom-Json
    $TargetVersion = $lastInstall.currentVersion
}
if (-not $TargetVersion) { throw "Target rollback version is required." }

$manifest = @{
    type = "rollback"
    currentVersion = $currentVersion
    targetVersion = $TargetVersion
    switched = $false
    restartRequested = $false
    finishedAt = (Get-Date).ToString("o")
    note = "Database restore is not automatic. Restore the matching dump manually if a migration changed data or schema."
}

Write-Step "BACKING_UP" 35 "Rollback metadata prepared; database restore remains manual."
Write-Step "SWITCHING" 70 "Preparing active version switch."

if ($AllowSwitch -or $env:SYSTEM_UPDATE_ALLOW_SWITCH -eq "true") {
    $currentManifestPath = Join-Path $updateRootPath "current.json"
    $manifest.switched = $true
    $manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $currentManifestPath -Encoding UTF8

    if ($env:SYSTEM_UPDATE_RESTART_COMMAND) {
        Write-Step "RESTARTING" 90 "Restart command configured; running service restart."
        Invoke-Expression $env:SYSTEM_UPDATE_RESTART_COMMAND
        $manifest.restartRequested = $true
    } else {
        Write-Step "RESTARTING" 90 "No restart command configured; service manager must restart manually."
    }
} else {
    Write-Step "SWITCHING" 90 "Switch skipped; set SYSTEM_UPDATE_ALLOW_SWITCH=true after service manager is ready."
}

$manifestPath = Join-Path $updateRootPath "last-rollback-manifest.json"
$manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $manifestPath -Encoding UTF8
Write-Step "ROLLED_BACK" 100 "Rollback runner completed."
Write-Output "SYSTEM_UPDATE_MANIFEST $manifestPath"
