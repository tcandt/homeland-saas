[CmdletBinding()]
param(
  [string]$ContainerName = "homeland_settlement_migration_gate_20261020"
)

$ErrorActionPreference = "Stop"
$migrationPath = Join-Path $PSScriptRoot "..\packages\database\prisma\migrations\20261020160000_allow_contract_settlement_billing_kind\migration.sql"
$created = $false

function Invoke-PostgresSql {
  param([Parameter(Mandatory = $true)][string]$Sql)
  $Sql | & docker exec -i $ContainerName psql -U postgres -d postgres -v ON_ERROR_STOP=1
  if ($LASTEXITCODE -ne 0) { throw "PostgreSQL command failed" }
}

function Assert-PostgresRejected {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$Sql
  )
  $savedErrorAction = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  $Sql | & docker exec -i $ContainerName psql -U postgres -d postgres -v ON_ERROR_STOP=1 *> $null
  $sqlExitCode = $LASTEXITCODE
  $ErrorActionPreference = $savedErrorAction
  if ($sqlExitCode -eq 0) { throw "Expected rejection: $Name" }
  Write-Host "PASS $Name"
}

try {
  $savedErrorAction = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  & docker container inspect $ContainerName *> $null
  $inspectExitCode = $LASTEXITCODE
  $ErrorActionPreference = $savedErrorAction
  if ($inspectExitCode -eq 0) { throw "Refusing to reuse existing container $ContainerName" }

  & docker run --detach --name $ContainerName --network none --env POSTGRES_HOST_AUTH_METHOD=trust postgres:16-alpine *> $null
  if ($LASTEXITCODE -ne 0) { throw "Unable to start isolated PostgreSQL container" }
  $created = $true

  $ready = $false
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    & docker exec $ContainerName pg_isready -U postgres -d postgres *> $null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    Start-Sleep -Milliseconds 500
  }
  if (-not $ready) { throw "Isolated PostgreSQL did not become ready" }

  Invoke-PostgresSql @'
CREATE TABLE "Invoice" (
  "id" text PRIMARY KEY,
  "tenantId" text NOT NULL,
  "customerId" text NOT NULL,
  "code" text NOT NULL,
  "status" text NOT NULL DEFAULT 'DRAFT',
  "dueDate" timestamptz NOT NULL,
  "subtotal" numeric NOT NULL DEFAULT 0,
  "discount" numeric NOT NULL DEFAULT 0,
  "total" numeric NOT NULL DEFAULT 0,
  "paidAmount" numeric NOT NULL DEFAULT 0,
  "creditAmount" numeric NOT NULL DEFAULT 0,
  "billingKind" text,
  "baseInvoiceKey" text,
  "adjustmentOfInvoiceId" text,
  "adjustmentReason" text,
  "adjustmentCreatedBy" text,
  "adjustmentRequestHash" text,
  "adjustmentIdempotencyKey" text,
  "deletedAt" timestamptz,
  "deletedBy" text,
  "deleteReason" text
);
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_billing_kind_shape_check" CHECK (true);
CREATE TABLE "InvoiceItem" (
  "id" text PRIMARY KEY,
  "tenantId" text NOT NULL,
  "invoiceId" text NOT NULL REFERENCES "Invoice"("id"),
  "type" text NOT NULL,
  "description" text NOT NULL,
  "quantity" numeric NOT NULL,
  "unitPrice" numeric NOT NULL,
  "amount" numeric NOT NULL
);
'@

  Get-Content -Raw $migrationPath | & docker exec -i $ContainerName psql -U postgres -d postgres -v ON_ERROR_STOP=1
  if ($LASTEXITCODE -ne 0) { throw "Settlement migration failed" }

  Invoke-PostgresSql @'
INSERT INTO "Invoice" ("id", "tenantId", "customerId", "code", "status", "dueDate", "subtotal", "discount", "total", "paidAmount", "creditAmount", "billingKind", "baseInvoiceKey")
VALUES ('settlement-1', 'tenant-1', 'customer-1', 'SET-001', 'DRAFT', now(), 100, 0, 100, 0, 0, 'CONTRACT_SETTLEMENT', 'contract:settlement-1');
INSERT INTO "InvoiceItem" ("id", "tenantId", "invoiceId", "type", "description", "quantity", "unitPrice", "amount")
VALUES ('settlement-item-1', 'tenant-1', 'settlement-1', 'UTILITY_ELECTRICITY', 'Settlement electricity', 1, 100, 100);
UPDATE "Invoice" SET "status" = 'ISSUED' WHERE "id" = 'settlement-1';
'@
  Write-Host "PASS valid draft settlement, item append, and issue"

  Assert-PostgresRejected "settlement shape without canonical base key" @'
INSERT INTO "Invoice" ("id", "tenantId", "customerId", "code", "status", "dueDate", "subtotal", "discount", "total", "paidAmount", "creditAmount", "billingKind")
VALUES ('bad-shape', 'tenant-1', 'customer-1', 'SET-BAD', 'DRAFT', now(), 1, 0, 1, 0, 0, 'CONTRACT_SETTLEMENT');
'@
  Assert-PostgresRejected "issued settlement cannot return to draft" @'
UPDATE "Invoice" SET "status" = 'DRAFT' WHERE "id" = 'settlement-1';
'@
  Assert-PostgresRejected "issued settlement cannot be soft deleted" @'
UPDATE "Invoice" SET "deletedAt" = now(), "deletedBy" = 'user-1', "deleteReason" = 'remove' WHERE "id" = 'settlement-1';
'@
  Assert-PostgresRejected "issued settlement cannot append items" @'
INSERT INTO "InvoiceItem" ("id", "tenantId", "invoiceId", "type", "description", "quantity", "unitPrice", "amount")
VALUES ('settlement-item-2', 'tenant-1', 'settlement-1', 'OTHER', 'Late append', 1, 1, 1);
'@
  Invoke-PostgresSql @'
UPDATE "Invoice" SET "status" = 'PARTIALLY_PAID' WHERE "id" = 'settlement-1';
UPDATE "Invoice" SET "status" = 'PAID' WHERE "id" = 'settlement-1';
'@
  Write-Host "PASS issued settlement permits payment status transitions"
  Write-Host "PASS bounded isolated migration validation complete"
} finally {
  if ($created) {
    & docker rm --force $ContainerName *> $null
    if ($LASTEXITCODE -ne 0) { Write-Warning "Could not remove isolated container $ContainerName" }
  }
}
