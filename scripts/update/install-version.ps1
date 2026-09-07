param(
    [Parameter(Mandatory = $true)]
    [string]$TargetVersion,

    [string]$TargetDisplayVersion = "",

    [string]$Repository = "https://github.com/tcandt/homeland-saas.git",
    [string]$Workspace = (Resolve-Path -LiteralPath ".").Path,
    [string]$UpdateRoot = "",
    [switch]$AllowSwitch
)

$ErrorActionPreference = "Stop"

if (-not $TargetDisplayVersion) {
    if ($TargetVersion -match '^v?[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$') {
        $TargetDisplayVersion = $TargetVersion
    } else {
        throw "Target display version is required when target ref is a commit SHA."
    }
}
if ($TargetVersion -notmatch '^([0-9a-fA-F]{40}|[0-9a-fA-F]{64}|v?[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?)$') {
    throw "Target ref must be an immutable commit SHA or a semantic-version tag."
}
if ($TargetDisplayVersion -notmatch '^v?[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$') {
    throw "Target display version must be a semantic version."
}
$repositoryUri = $null
if ([Uri]::TryCreate($Repository, [UriKind]::Absolute, [ref]$repositoryUri) -and $repositoryUri.UserInfo) {
    throw "Credential-bearing repository URLs are not supported; use SYSTEM_UPDATE_GITHUB_TOKEN."
}

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

function Set-ReleaseEnvValue {
    param([string]$Path, [string]$Key, [string]$Value)
    $lines = if (Test-Path -LiteralPath $Path) { @(Get-Content -LiteralPath $Path) } else { @() }
    $nextLines = [System.Collections.Generic.List[string]]::new()
    $written = $false
    foreach ($line in $lines) {
        if ($line -match "^\s*$([regex]::Escape($Key))\s*=") {
            if (-not $written) {
                $nextLines.Add("$Key=`"$Value`"")
                $written = $true
            }
            continue
        }
        $nextLines.Add($line)
    }
    if (-not $written) { $nextLines.Add("$Key=`"$Value`"") }

    $tempPath = "$Path.$PID.$([Guid]::NewGuid().ToString('N')).tmp"
    try {
        [IO.File]::WriteAllLines($tempPath, $nextLines, [Text.UTF8Encoding]::new($false))
        Move-Item -LiteralPath $tempPath -Destination $Path -Force
    } finally {
        if (Test-Path -LiteralPath $tempPath) { Remove-Item -LiteralPath $tempPath -Force }
    }
}

function Invoke-GitCloneTarget {
    param([string]$RepositoryUrl, [string]$ReleasePath, [string]$TargetRef)
    $namesToRestore = [System.Collections.Generic.List[string]]::new()
    $previousValues = @{}
    function Set-TemporaryProcessEnv([string]$Name, [string]$Value) {
        if (-not $previousValues.ContainsKey($Name)) {
            $previousValues[$Name] = [Environment]::GetEnvironmentVariable($Name, 'Process')
            $namesToRestore.Add($Name)
        }
        [Environment]::SetEnvironmentVariable($Name, $Value, 'Process')
    }

    try {
        Set-TemporaryProcessEnv 'GIT_TERMINAL_PROMPT' '0'
        $token = if ($env:SYSTEM_UPDATE_GITHUB_TOKEN) {
            $env:SYSTEM_UPDATE_GITHUB_TOKEN
        } elseif ($env:GITHUB_TOKEN) {
            $env:GITHUB_TOKEN
        } else {
            $env:GH_TOKEN
        }
        if ($token -and $RepositoryUrl.StartsWith('https://github.com/', [StringComparison]::OrdinalIgnoreCase)) {
            $configCount = 0
            if ($env:GIT_CONFIG_COUNT -match '^\d+$') { $configCount = [int]$env:GIT_CONFIG_COUNT }
            $authBytes = [Text.Encoding]::UTF8.GetBytes("x-access-token:$token")
            Set-TemporaryProcessEnv "GIT_CONFIG_KEY_$configCount" 'http.extraHeader'
            Set-TemporaryProcessEnv "GIT_CONFIG_VALUE_$configCount" "Authorization: Basic $([Convert]::ToBase64String($authBytes))"
            Set-TemporaryProcessEnv 'GIT_CONFIG_COUNT' ([string]($configCount + 1))
        }

        & git clone --no-checkout $RepositoryUrl $ReleasePath
        if ($LASTEXITCODE -ne 0) { throw "git clone failed with code $LASTEXITCODE" }
        & git -C $ReleasePath remote set-url origin $RepositoryUrl
        if ($LASTEXITCODE -ne 0) { throw "git remote sanitization failed with code $LASTEXITCODE" }
        & git -C $ReleasePath checkout --detach $TargetRef
        if ($LASTEXITCODE -ne 0) { throw "git checkout failed with code $LASTEXITCODE" }
    } finally {
        foreach ($name in $namesToRestore) {
            [Environment]::SetEnvironmentVariable($name, $previousValues[$name], 'Process')
        }
    }
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
$env:SYSTEM_UPDATE_ROOT = $updateRootPath
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$safeVersion = ($TargetDisplayVersion -replace "[^0-9A-Za-z_.-]", "_")
$releasePath = Join-Path (Join-Path $updateRootPath "releases") "$stamp-$safeVersion"
$backupRootCandidate = if ($env:SYSTEM_UPDATE_BACKUP_OUTPUT_DIR) { $env:SYSTEM_UPDATE_BACKUP_OUTPUT_DIR } else { Join-Path $workspacePath ".codex-backups\system-update" }
if (-not [IO.Path]::IsPathRooted($backupRootCandidate)) { $backupRootCandidate = Join-Path $workspacePath $backupRootCandidate }
$backupRoot = (New-Item -ItemType Directory -Path $backupRootCandidate -Force).FullName
$env:SYSTEM_UPDATE_BACKUP_OUTPUT_DIR = $backupRoot
$backupPath = Join-Path $backupRoot "$stamp-before-$safeVersion"
$manifestPath = Join-Path $updateRootPath "last-install-manifest.json"

if (Test-Path -LiteralPath $releasePath) { throw "Release path already exists: $releasePath" }
New-Item -ItemType Directory -Path $releasePath | Out-Null
New-Item -ItemType Directory -Path $backupPath -Force | Out-Null

Write-Step "CHECKING" 5 "Preparing update to $TargetDisplayVersion ($TargetVersion)."
$previousAppVersion = [Environment]::GetEnvironmentVariable('APP_VERSION', 'Process')
$previousCommitSha = [Environment]::GetEnvironmentVariable('COMMIT_SHA', 'Process')
$displayVersionPattern = '^v?[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$'
if ($previousAppVersion -notmatch $displayVersionPattern) { $previousAppVersion = $null }
if (-not $previousAppVersion -and (Test-Path -LiteralPath (Join-Path $workspacePath "package.json"))) {
    try {
        $declaredVersion = & node -p "require(process.argv[1]).version" (Join-Path $workspacePath "package.json") 2>$null
        if ($LASTEXITCODE -eq 0 -and $declaredVersion -match $displayVersionPattern) {
            $previousAppVersion = "v$(([string]$declaredVersion).Trim() -replace '^v+', '')"
        }
    } catch {
        $previousAppVersion = $null
    }
}
if ($previousCommitSha -notmatch '^([0-9a-fA-F]{40}|[0-9a-fA-F]{64})$') { $previousCommitSha = $null }
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
if (-not $previousCommitSha -and $currentVersion -match '^([0-9a-fA-F]{40}|[0-9a-fA-F]{64})$') {
    $previousCommitSha = $currentVersion
}

Write-Step "BACKING_UP" 20 "Backing up available env and metadata."
$envPath = if ($env:SYSTEM_UPDATE_ENV_FILE) { $env:SYSTEM_UPDATE_ENV_FILE } else { Join-Path $workspacePath ".env" }
if (Test-Path -LiteralPath $envPath) { Copy-Item -LiteralPath $envPath -Destination (Join-Path $backupPath ".env") }
@{
    currentVersion = $currentVersion
    targetVersion = $TargetDisplayVersion
    requestedTargetRef = $TargetVersion
    previousAppVersion = $previousAppVersion
    previousCommitSha = $previousCommitSha
    createdAt = (Get-Date).ToString("o")
    workspace = $workspacePath
} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $backupPath "metadata.json") -Encoding UTF8

$storageDir = if ($env:SYSTEM_UPDATE_STORAGE_DIR) { $env:SYSTEM_UPDATE_STORAGE_DIR } else { Get-EnvValue -Path $envPath -Key "STORAGE_DIR" }
if (-not $storageDir) { $storageDir = Join-Path $workspacePath "storage" }

Write-Step "BACKING_UP" 28 "Creating production backup bundle."
$backupScript = Join-Path $workspacePath "scripts\production-backup.js"
$backupArgs = @($backupScript, "--output-dir", $backupRoot, "--storage-dir", $storageDir)
if (Test-Path -LiteralPath $envPath) {
    $backupArgs += @("--env-file", $envPath)
} else {
    $backupArgs += "--env-managed-externally"
    Write-Step "BACKING_UP" 28 "Env file is managed by the deployment host and is not mounted in the API container."
}
if ($env:SYSTEM_UPDATE_PG_DUMP_PATH) { $backupArgs += @("--pg-dump", $env:SYSTEM_UPDATE_PG_DUMP_PATH) }
& node @backupArgs
if ($LASTEXITCODE -ne 0) { throw "production backup failed with code $LASTEXITCODE" }
$backupManifest = Join-Path $backupRoot "latest-manifest.json"
$backupManifestJson = Get-Content -LiteralPath $backupManifest -Raw | ConvertFrom-Json
$backupBundlePath = Join-Path $backupRoot $backupManifestJson.id

Write-Step "BACKING_UP" 35 "Verifying backup manifest and dump readability."
$restoreCheckScript = Join-Path $workspacePath "scripts\production-restore-check.js"
$restoreArgs = @(
    $restoreCheckScript,
    "--manifest", $backupManifest,
    "--max-age-hours", $(if ($env:SYSTEM_UPDATE_BACKUP_MAX_AGE_HOURS) { $env:SYSTEM_UPDATE_BACKUP_MAX_AGE_HOURS } else { "24" })
)
if ($env:SYSTEM_UPDATE_REQUIRE_OFF_HOST -eq "true") { $restoreArgs += "--require-off-host" }
if ($env:SYSTEM_UPDATE_PG_RESTORE_PATH) { $restoreArgs += @("--pg-restore", $env:SYSTEM_UPDATE_PG_RESTORE_PATH) }
if ($env:SYSTEM_UPDATE_SKIP_PG_RESTORE_LIST -eq "true") { $restoreArgs += "--skip-pg-restore-list" }
& node @restoreArgs
if ($LASTEXITCODE -ne 0) { throw "production restore check failed with code $LASTEXITCODE" }

Write-Step "DOWNLOADING" 42 "Cloning target source into isolated release directory."
Invoke-GitCloneTarget -RepositoryUrl $Repository -ReleasePath $releasePath -TargetRef $TargetVersion
$sourceCommit = (& git -C $releasePath rev-parse 'HEAD^{commit}').Trim()
if ($LASTEXITCODE -ne 0 -or $sourceCommit -notmatch '^([0-9a-fA-F]{40}|[0-9a-fA-F]{64})$') { throw "Could not resolve checked-out target commit." }
$sourceVersion = & node -p "require(process.argv[1]).version" (Join-Path $releasePath "package.json")
if ($LASTEXITCODE -ne 0 -or -not $sourceVersion) { throw "Could not read version from checked-out package.json." }
$sourceDisplayVersion = "v$(([string]$sourceVersion).Trim() -replace '^v+', '')"
$expectedDisplayVersion = "v$($TargetDisplayVersion -replace '^v+', '')"
if ($sourceDisplayVersion -cne $expectedDisplayVersion) {
    throw "Checked-out source declares $sourceDisplayVersion, expected $expectedDisplayVersion."
}
if (Test-Path -LiteralPath $envPath) { Copy-Item -LiteralPath $envPath -Destination (Join-Path $releasePath ".env") }
Set-ReleaseEnvValue -Path (Join-Path $releasePath ".env") -Key "APP_VERSION" -Value $expectedDisplayVersion
Set-ReleaseEnvValue -Path (Join-Path $releasePath ".env") -Key "COMMIT_SHA" -Value $sourceCommit
Set-ReleaseEnvValue -Path (Join-Path $releasePath ".env") -Key "SYSTEM_UPDATE_ROOT" -Value $updateRootPath
Set-ReleaseEnvValue -Path (Join-Path $releasePath ".env") -Key "SYSTEM_UPDATE_BACKUP_OUTPUT_DIR" -Value $backupRoot

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
    targetVersion = $TargetDisplayVersion
    targetRef = $sourceCommit
    requestedTargetRef = $TargetVersion
    previousAppVersion = $previousAppVersion
    previousCommitSha = $previousCommitSha
    previousReleasePath = $workspacePath
    releasePath = $releasePath
    backupPath = $backupBundlePath
    systemMetadataBackupPath = $backupPath
    backupManifest = $backupManifest
    switched = $false
    restartRequested = $false
    restartExitCode = $null
    autoRollbackPerformed = $false
    rollbackRestartExitCode = $null
    status = "PREPARED"
    finishedAt = (Get-Date).ToString("o")
}
$runnerExitCode = 0

if ($AllowSwitch -or $env:SYSTEM_UPDATE_ALLOW_SWITCH -eq "true") {
    Write-Step "SWITCHING" 90 "Writing active version manifest."
    $currentManifestPath = Join-Path $updateRootPath "current.json"
    $manifest.switched = $true
    $manifest.status = "DONE"
    @{
        releasePath = $releasePath
        targetVersion = $TargetDisplayVersion
        targetRef = $sourceCommit
        appVersion = $expectedDisplayVersion
        previousReleasePath = $workspacePath
        previousVersion = $currentVersion
        backupPath = $backupBundlePath
        activatedAt = (Get-Date).ToString("o")
    } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $currentManifestPath -Encoding UTF8

    if ($env:SYSTEM_UPDATE_RESTART_COMMAND) {
        Write-Step "RESTARTING" 94 "Restart command configured; running service restart."
        $manifest.restartRequested = $true
        $env:APP_VERSION = $expectedDisplayVersion
        $env:COMMIT_SHA = $sourceCommit
        $env:SYSTEM_UPDATE_ROOT = $updateRootPath
        $env:SYSTEM_UPDATE_BACKUP_OUTPUT_DIR = $backupRoot
        $global:LASTEXITCODE = 0
        try {
            Invoke-Expression $env:SYSTEM_UPDATE_RESTART_COMMAND
            $manifest.restartExitCode = $LASTEXITCODE
        } catch {
            $manifest.restartExitCode = 1
            $manifest.error = $_.Exception.Message
        }

        if ($manifest.restartExitCode -ne 0) {
            $manifest.status = "FAILED_RESTART"
            $runnerExitCode = 1
            if ($env:SYSTEM_UPDATE_AUTO_ROLLBACK -ne "false") {
                Write-Step "RESTARTING" 97 "Restart/health failed; rolling back active manifest to previous release."
                $manifest.autoRollbackPerformed = $true
                @{
                    releasePath = $workspacePath
                    targetVersion = $currentVersion
                    targetRef = $previousCommitSha
                    appVersion = $previousAppVersion
                    rolledBackFrom = $TargetDisplayVersion
                    backupPath = $backupBundlePath
                    activatedAt = (Get-Date).ToString("o")
                } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $currentManifestPath -Encoding UTF8

                if ($null -eq $previousAppVersion) {
                    Remove-Item Env:\APP_VERSION -ErrorAction SilentlyContinue
                } else {
                    $env:APP_VERSION = $previousAppVersion
                }
                if ($null -eq $previousCommitSha) {
                    Remove-Item Env:\COMMIT_SHA -ErrorAction SilentlyContinue
                } else {
                    $env:COMMIT_SHA = $previousCommitSha
                }
                $global:LASTEXITCODE = 0
                try {
                    Invoke-Expression $env:SYSTEM_UPDATE_RESTART_COMMAND
                    $manifest.rollbackRestartExitCode = $LASTEXITCODE
                } catch {
                    $manifest.rollbackRestartExitCode = 1
                    $manifest.rollbackError = $_.Exception.Message
                }

                if ($manifest.rollbackRestartExitCode -eq 0) {
                    $manifest.status = "ROLLED_BACK_AFTER_FAILED_RESTART"
                } else {
                    $manifest.status = "ROLLBACK_RESTART_FAILED"
                }
            } else {
                Write-Step "RESTARTING" 97 "Restart/health failed; auto rollback is disabled."
            }
        }
    } else {
        Write-Step "RESTARTING" 94 "No restart command configured; service manager must restart manually."
    }
} else {
    Write-Step "BLOCKED" 90 "Release prepared, but switching is disabled; activate it with the host updater or service manager."
}

$manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $manifestPath -Encoding UTF8
if ($runnerExitCode -eq 0) {
    if ($manifest.switched) {
        Write-Step "DONE" 100 "Update runner completed."
    } else {
        Write-Step "BLOCKED" 100 "Release preparation completed; the active version was not switched."
    }
} else {
    Write-Step "FAILED" 100 "Update runner failed; app rollback attempted according to manifest."
}
Write-Output "SYSTEM_UPDATE_MANIFEST $manifestPath"
exit $runnerExitCode
