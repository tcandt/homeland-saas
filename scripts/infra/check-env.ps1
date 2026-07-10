$ErrorActionPreference = 'Stop'

Write-Host "============================================="
Write-Host "   Environment Gate"
Write-Host "============================================="

# Resolve environment variables like node would
$envFiles = @(".env", "packages\database\.env")
$dbUrl = ""

foreach ($file in $envFiles) {
    if (Test-Path $file) {
        $lines = Get-Content $file
        foreach ($line in $lines) {
            if ($line -match '^DATABASE_URL="(.*)"$') {
                $dbUrl = $matches[1]
            } elseif ($line -match "^DATABASE_URL=(.*)$") {
                $dbUrl = $matches[1]
            }
        }
    }
}

if (-not $dbUrl) {
    Write-Host "DATABASE_URL: MISSING" -ForegroundColor Red
    New-Item -ItemType Directory -Force -Path "docs/evidence/INFRASTRUCTURE" | Out-Null
    Set-Content -Path "docs/evidence/INFRASTRUCTURE/environment.txt" -Value "ENV_MISMATCH: DATABASE_URL is missing"
    exit 1
}

if ($dbUrl -match '^(?<protocol>[^:]+)://(?<user>[^:]+):(?<password>[^@]+)@(?<host>[^:]+):(?<port>\d+)/(?<database>[^?]+)') {
    Write-Host "DATABASE_URL: PRESENT"
    Write-Host "Protocol: $($matches['protocol'])"
    Write-Host "Host: $($matches['host'])"
    Write-Host "Port: $($matches['port'])"
    Write-Host "Database: $($matches['database'])"
    Write-Host "Credentials: MASKED"
    
    New-Item -ItemType Directory -Force -Path "docs/evidence/INFRASTRUCTURE" | Out-Null
    $evidence = "DATABASE_URL: PRESENT`nProtocol: $($matches['protocol'])`nHost: $($matches['host'])`nPort: $($matches['port'])`nDatabase: $($matches['database'])`nCredentials: MASKED"
    Set-Content -Path "docs/evidence/INFRASTRUCTURE/environment.txt" -Value $evidence
    exit 0
} else {
    Write-Host "DATABASE_URL: INVALID FORMAT" -ForegroundColor Red
    New-Item -ItemType Directory -Force -Path "docs/evidence/INFRASTRUCTURE" | Out-Null
    Set-Content -Path "docs/evidence/INFRASTRUCTURE/environment.txt" -Value "ENV_MISMATCH: DATABASE_URL invalid format"
    exit 1
}
