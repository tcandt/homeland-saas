param(
  [string]$SourceRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path,
  [string]$OutputRoot = (Join-Path $PSScriptRoot "release")
)

$ErrorActionPreference = "Stop"

function Ensure-Directory([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) {
    New-Item -ItemType Directory -Path $Path -Force | Out-Null
  }
}

function Copy-PathSafe {
  param(
    [Parameter(Mandatory = $true)][string]$Source,
    [Parameter(Mandatory = $true)][string]$Destination
  )

  if (-not (Test-Path -LiteralPath $Source)) {
    return
  }

  $item = Get-Item -LiteralPath $Source
  Ensure-Directory (Split-Path -Parent $Destination)

  if ($item.PSIsContainer) {
    Ensure-Directory $Destination
    Copy-Item -LiteralPath (Join-Path $Source "*") -Destination $Destination -Recurse -Force
  } else {
    Copy-Item -LiteralPath $Source -Destination $Destination -Force
  }
}

function Copy-DirectoryContents {
  param(
    [Parameter(Mandatory = $true)][string]$Source,
    [Parameter(Mandatory = $true)][string]$Destination,
    [string[]]$ExcludeNames = @()
  )

  if (-not (Test-Path -LiteralPath $Source)) {
    return
  }

  Ensure-Directory $Destination
  Get-ChildItem -LiteralPath $Source -Force | ForEach-Object {
    if ($ExcludeNames -contains $_.Name) {
      return
    }

    $target = Join-Path $Destination $_.Name
    if ($_.PSIsContainer) {
      Copy-DirectoryContents -Source $_.FullName -Destination $target -ExcludeNames $ExcludeNames
    } else {
      Ensure-Directory (Split-Path -Parent $target)
      Copy-Item -LiteralPath $_.FullName -Destination $target -Force
    }
  }
}

if (Test-Path -LiteralPath $OutputRoot) {
  Remove-Item -LiteralPath $OutputRoot -Recurse -Force
}
Ensure-Directory $OutputRoot

$rootFiles = @(
  "Dockerfile.api",
  "Dockerfile.web",
  "package.json",
  "package-lock.json",
  "turbo.json",
  ".env.docker.example"
)

foreach ($file in $rootFiles) {
  Copy-PathSafe -Source (Join-Path $SourceRoot $file) -Destination (Join-Path $OutputRoot $file)
}

Copy-DirectoryContents -Source (Join-Path $SourceRoot "apps") -Destination (Join-Path $OutputRoot "apps") -ExcludeNames @(
  "node_modules",
  ".next",
  "dist",
  "coverage"
)

Copy-DirectoryContents -Source (Join-Path $SourceRoot "packages") -Destination (Join-Path $OutputRoot "packages") -ExcludeNames @(
  "node_modules",
  "dist",
  "coverage"
)

Copy-DirectoryContents -Source (Join-Path $SourceRoot "scripts") -Destination (Join-Path $OutputRoot "scripts") -ExcludeNames @(
  "node_modules"
)

Copy-DirectoryContents -Source (Join-Path $SourceRoot "prisma") -Destination (Join-Path $OutputRoot "prisma")
Copy-DirectoryContents -Source (Join-Path $SourceRoot "public") -Destination (Join-Path $OutputRoot "public")

$releaseMetaDir = Join-Path $SourceRoot "deploy\public-production"
Copy-PathSafe -Source (Join-Path $releaseMetaDir "README.md") -Destination (Join-Path $OutputRoot "README.md")
Copy-PathSafe -Source (Join-Path $releaseMetaDir "env.public-production") -Destination (Join-Path $OutputRoot ".env.public-production")

$composeSource = Get-Content -LiteralPath (Join-Path $releaseMetaDir "docker-compose.public-production.yml") -Raw
$composeAdjusted = $composeSource `
  -replace 'context: \.\./\.\.', 'context: .' `
  -replace 'env_file:\s*\n\s*- env\.public-production', "env_file:`n      - .env.public-production"

Set-Content -LiteralPath (Join-Path $OutputRoot "docker-compose.public-production.yml") -Value $composeAdjusted -Encoding UTF8

$manifest = [ordered]@{
  sourceRoot = $SourceRoot
  generatedAt = (Get-Date).ToString("o")
  releaseRoot = $OutputRoot
  contents = @(
    "Dockerfile.api",
    "Dockerfile.web",
    "package.json",
    "package-lock.json",
    "turbo.json",
    ".env.docker.example",
    ".env.public-production",
    "docker-compose.public-production.yml",
    "README.md",
    "apps/",
    "packages/",
    "scripts/",
    "prisma/",
    "public/"
  )
}

$manifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $OutputRoot "release-manifest.json") -Encoding UTF8

Write-Host "Production release bundle created at: $OutputRoot"
