param(
    [string]$ExecutionId,
    [string]$Epic,
    [string]$Stage,
    [string]$CommandId
)

$ErrorActionPreference = 'Stop'

if (-not $ExecutionId) {
    Write-Host "ExecutionId is required" -ForegroundColor Red
    exit 1
}

$evidenceDir = "$PSScriptRoot\..\..\docs\evidence\runs\$ExecutionId"
if (-not (Test-Path "$evidenceDir\execution-manifest.json")) {
    Write-Host "Execution manifest not found for $ExecutionId" -ForegroundColor Red
    exit 1
}

# Whitelist map
$AllowedCommands = @{
    "verify_prod" = "npm run verify:prod"
    "backend_build" = "npm run build --workspace=api"
    "frontend_build" = "npm run build --workspace=web"
    "unit_test" = "npm run test --workspace=api"
    "integration_test" = "npm run test:e2e --workspace=api"
    "typecheck_web" = "npm run typecheck --workspace=web"
}

if (-not $AllowedCommands.ContainsKey($CommandId)) {
    Write-Host "CommandId $CommandId is not allowed." -ForegroundColor Red
    exit 1
}

$rawCommand = $AllowedCommands[$CommandId]

$stageDir = "$evidenceDir\$Stage"
if (-not (Test-Path $stageDir)) {
    New-Item -ItemType Directory -Path $stageDir | Out-Null
} else {
    $attempt = 2
    while (Test-Path "$stageDir-attempt-$attempt") { $attempt++ }
    $stageDir = "$stageDir-attempt-$attempt"
    New-Item -ItemType Directory -Path $stageDir | Out-Null
}

$stdoutFile = "$stageDir\stdout.log"
$stderrFile = "$stageDir\stderr.log"
$evidenceFile = "$stageDir\evidence.json"

Write-Host "Recording evidence for $Stage to $stageDir"

$startedAt = [datetime]::UtcNow

$cmdParts = $rawCommand -split " "
$exe = $cmdParts[0]
if ($exe -eq "npm") { $exe = if ($IsWindows -or $env:OS -match "Windows") { "npm.cmd" } else { "npm" } }
$argsList = $cmdParts[1..($cmdParts.Length-1)]

$processInfo = New-Object System.Diagnostics.ProcessStartInfo
$processInfo.FileName = $exe
$processInfo.Arguments = $argsList -join " "
$processInfo.RedirectStandardOutput = $true
$processInfo.RedirectStandardError = $true
$processInfo.UseShellExecute = $false
$processInfo.CreateNoWindow = $true
$processInfo.WorkingDirectory = (Get-Location).Path

$process = New-Object System.Diagnostics.Process
$process.StartInfo = $processInfo

$stdoutStr = New-Object System.Text.StringBuilder
$stderrStr = New-Object System.Text.StringBuilder

$process.add_OutputDataReceived({
    if ($_.Data -ne $null) {
        $stdoutStr.AppendLine($_.Data) | Out-Null
        Write-Host $_.Data
    }
})
$process.add_ErrorDataReceived({
    if ($_.Data -ne $null) {
        $stderrStr.AppendLine($_.Data) | Out-Null
        Write-Host $_.Data -ForegroundColor Red
    }
})

$process.Start() | Out-Null
$process.BeginOutputReadLine()
$process.BeginErrorReadLine()
$process.WaitForExit()

$finishedAt = [datetime]::UtcNow
$exitCode = $process.ExitCode
$durationMs = [math]::Round(($finishedAt - $startedAt).TotalMilliseconds)

Set-Content -Path $stdoutFile -Value $stdoutStr.ToString() -NoNewline
Set-Content -Path $stderrFile -Value $stderrStr.ToString() -NoNewline

$sha256 = [System.Security.Cryptography.SHA256]::Create()
function Get-Hash($path) {
    if (-not (Test-Path $path)) { return "" }
    $stream = [IO.File]::OpenRead($path)
    $hash = [BitConverter]::ToString($sha256.ComputeHash($stream)).Replace("-", "").ToLower()
    $stream.Close()
    return $hash
}

$commitSha = ""
try {
    $commitSha = (git rev-parse HEAD).Trim()
} catch {}

$evidenceObj = @{
    executionId = $ExecutionId
    epic = $Epic
    stage = $Stage
    commandId = $CommandId
    exitCode = $exitCode
    startedAtUtc = $startedAt.ToString("o")
    finishedAtUtc = $finishedAt.ToString("o")
    durationMs = $durationMs
    resolvedCommand = $rawCommand
    cwd = (Get-Location).Path
    repositoryCommitSha = $commitSha
    stdoutSha256 = Get-Hash $stdoutFile
    stderrSha256 = Get-Hash $stderrFile
}

$jsonObj = $evidenceObj | ConvertTo-Json -Depth 5
Set-Content -Path $evidenceFile -Value $jsonObj

Write-Host "Evidence recorded: $evidenceFile"
exit $exitCode
