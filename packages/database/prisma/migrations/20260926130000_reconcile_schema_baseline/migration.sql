-- Reconcile schema objects that were present in the Prisma datamodel but
-- absent from the historical migration chain. This migration is additive
-- except for the explicit, lossless InvoiceStatus vocabulary mapping below.

DO $$
BEGIN
  CREATE TYPE "SettingScope" AS ENUM ('TENANT', 'USER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS "AppSetting" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "scope" "SettingScope" NOT NULL,
  "ownerId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AppSetting_tenantId_scope_ownerId_idx"
ON "AppSetting"("tenantId", "scope", "ownerId");

CREATE UNIQUE INDEX IF NOT EXISTS "AppSetting_tenantId_scope_ownerId_key_key"
ON "AppSetting"("tenantId", "scope", "ownerId", "key");

ALTER TABLE "Building"
ADD COLUMN IF NOT EXISTS "displayOrder" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Customer"
ADD COLUMN IF NOT EXISTS "relationship" TEXT;

ALTER TABLE "Room"
ADD COLUMN IF NOT EXISTS "area" DECIMAL(10,2);

DROP INDEX IF EXISTS "Room_tenantId_code_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Room_tenantId_buildingId_code_key"
ON "Room"("tenantId", "buildingId", "code");
CREATE INDEX IF NOT EXISTS "Building_tenantId_displayOrder_idx"
ON "Building"("tenantId", "displayOrder");

ALTER TABLE "ContractParty" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "ContractSettlement" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "Occupancy" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "RentalCycle" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "DepositLedgerEntry"
DROP CONSTRAINT IF EXISTS "DepositLedgerEntry_reversalOfId_fkey";
ALTER TABLE "DepositLedgerEntry"
ADD CONSTRAINT "DepositLedgerEntry_reversalOfId_fkey"
FOREIGN KEY ("reversalOfId") REFERENCES "DepositLedgerEntry"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

DO $$
DECLARE
  has_legacy_partial BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_enum value
    JOIN pg_type type ON type.oid = value.enumtypid
    WHERE type.typname = 'InvoiceStatus'
      AND value.enumlabel IN ('PARTIAL', 'CREDITED')
  ) INTO has_legacy_partial;

  IF has_legacy_partial THEN
    ALTER TABLE "Invoice" ALTER COLUMN "status" DROP DEFAULT;
    CREATE TYPE "InvoiceStatus_reconciled_20260926" AS ENUM (
      'DRAFT',
      'ISSUED',
      'PARTIALLY_PAID',
      'PAID',
      'OVERDUE',
      'CANCELLED',
      'WRITTEN_OFF'
    );
    ALTER TABLE "Invoice"
    ALTER COLUMN "status" TYPE "InvoiceStatus_reconciled_20260926"
    USING (
      CASE "status"::text
        WHEN 'PARTIAL' THEN 'PARTIALLY_PAID'
        WHEN 'CREDITED' THEN 'WRITTEN_OFF'
        ELSE "status"::text
      END
    )::"InvoiceStatus_reconciled_20260926";
    DROP TYPE "InvoiceStatus";
    ALTER TYPE "InvoiceStatus_reconciled_20260926" RENAME TO "InvoiceStatus";
    ALTER TABLE "Invoice" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
  END IF;
END
$$;
