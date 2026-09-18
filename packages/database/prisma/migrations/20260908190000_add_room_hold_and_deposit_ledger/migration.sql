-- CORE-04/05 additive migration only.
-- Production execution is forbidden outside the approved maintenance-window runbook.

CREATE TYPE "RoomHoldKind" AS ENUM ('WHOLE', 'SHARED_SLOT');
CREATE TYPE "RoomHoldStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'RELEASED', 'CONVERTED', 'CANCELLED');
CREATE TYPE "DepositLedgerEntryType" AS ENUM ('CASH_IN', 'TRANSFER_OUT', 'TRANSFER_IN', 'REFUND', 'KEEP', 'DEDUCT', 'CREDIT', 'REVERSAL');
CREATE TYPE "DepositOperationType" AS ENUM ('COLLECT', 'CONVERT_TO_SECURITY', 'REFUND', 'CANCEL', 'COMPLETE_REFUND', 'RENEW_HOLD', 'TRANSFER_HOLD', 'RELEASE_HOLD', 'REVERSE_LEDGER');
CREATE TYPE "DepositOperationStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');
CREATE TYPE "OutboxEventStatus" AS ENUM ('PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED');

CREATE TABLE "RoomHold" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "rentalCycleId" TEXT NOT NULL,
    "depositId" TEXT,
    "roomId" TEXT NOT NULL,
    "kind" "RoomHoldKind" NOT NULL,
    "resourceKey" TEXT NOT NULL,
    "activeResourceKey" TEXT,
    "status" "RoomHoldStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "releasedAt" TIMESTAMP(3),
    "releaseReason" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RoomHold_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RoomHold_active_state_check" CHECK (
      ("status" = 'ACTIVE' AND "activeResourceKey" IS NOT NULL AND "releasedAt" IS NULL)
      OR
      ("status" <> 'ACTIVE' AND "activeResourceKey" IS NULL)
    )
);

CREATE TABLE "DepositOperation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "rentalCycleId" TEXT NOT NULL,
    "sourceDepositId" TEXT NOT NULL,
    "targetDepositId" TEXT,
    "contractId" TEXT,
    "type" "DepositOperationType" NOT NULL,
    "status" "DepositOperationStatus" NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "result" JSONB,
    "errorCode" TEXT,
    "receiptId" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "DepositOperation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DepositLedgerEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "rentalCycleId" TEXT NOT NULL,
    "depositId" TEXT NOT NULL,
    "contractId" TEXT,
    "operationId" TEXT NOT NULL,
    "type" "DepositLedgerEntryType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "balanceEffect" DECIMAL(14,2) NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "reversalOfId" TEXT,
    "metadata" JSONB,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DepositLedgerEntry_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DepositLedgerEntry_positive_amount_check" CHECK ("amount" > 0),
    CONSTRAINT "DepositLedgerEntry_non_zero_effect_check" CHECK ("balanceEffect" <> 0),
    CONSTRAINT "DepositLedgerEntry_effect_bound_check" CHECK (ABS("balanceEffect") = "amount")
);

CREATE TABLE "OutboxEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" "OutboxEventStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RoomHold_activeResourceKey_key" ON "RoomHold"("activeResourceKey");
CREATE UNIQUE INDEX "RoomHold_tenantId_idempotencyKey_key" ON "RoomHold"("tenantId", "idempotencyKey");
CREATE INDEX "RoomHold_tenantId_roomId_status_expiresAt_idx" ON "RoomHold"("tenantId", "roomId", "status", "expiresAt");
CREATE INDEX "RoomHold_tenantId_rentalCycleId_status_idx" ON "RoomHold"("tenantId", "rentalCycleId", "status");
CREATE INDEX "RoomHold_tenantId_depositId_status_idx" ON "RoomHold"("tenantId", "depositId", "status");

CREATE UNIQUE INDEX "DepositOperation_tenantId_idempotencyKey_key" ON "DepositOperation"("tenantId", "idempotencyKey");
CREATE INDEX "DepositOperation_tenantId_sourceDepositId_status_idx" ON "DepositOperation"("tenantId", "sourceDepositId", "status");
CREATE INDEX "DepositOperation_tenantId_rentalCycleId_status_idx" ON "DepositOperation"("tenantId", "rentalCycleId", "status");
CREATE INDEX "DepositOperation_tenantId_receiptId_idx" ON "DepositOperation"("tenantId", "receiptId");

CREATE UNIQUE INDEX "DepositLedgerEntry_reversalOfId_key" ON "DepositLedgerEntry"("reversalOfId");
CREATE UNIQUE INDEX "DepositLedgerEntry_tenantId_idempotencyKey_key" ON "DepositLedgerEntry"("tenantId", "idempotencyKey");
CREATE INDEX "DepositLedgerEntry_tenantId_depositId_createdAt_idx" ON "DepositLedgerEntry"("tenantId", "depositId", "createdAt");
CREATE INDEX "DepositLedgerEntry_tenantId_rentalCycleId_createdAt_idx" ON "DepositLedgerEntry"("tenantId", "rentalCycleId", "createdAt");
CREATE INDEX "DepositLedgerEntry_tenantId_operationId_idx" ON "DepositLedgerEntry"("tenantId", "operationId");
CREATE INDEX "DepositLedgerEntry_tenantId_sourceType_sourceId_idx" ON "DepositLedgerEntry"("tenantId", "sourceType", "sourceId");
CREATE UNIQUE INDEX "OutboxEvent_tenantId_idempotencyKey_key" ON "OutboxEvent"("tenantId", "idempotencyKey");
CREATE INDEX "OutboxEvent_status_availableAt_createdAt_idx" ON "OutboxEvent"("status", "availableAt", "createdAt");
CREATE INDEX "OutboxEvent_tenantId_aggregateType_aggregateId_idx" ON "OutboxEvent"("tenantId", "aggregateType", "aggregateId");

ALTER TABLE "RoomHold" ADD CONSTRAINT "RoomHold_rentalCycleId_fkey" FOREIGN KEY ("rentalCycleId") REFERENCES "RentalCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RoomHold" ADD CONSTRAINT "RoomHold_depositId_fkey" FOREIGN KEY ("depositId") REFERENCES "Deposit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RoomHold" ADD CONSTRAINT "RoomHold_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DepositOperation" ADD CONSTRAINT "DepositOperation_rentalCycleId_fkey" FOREIGN KEY ("rentalCycleId") REFERENCES "RentalCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DepositOperation" ADD CONSTRAINT "DepositOperation_sourceDepositId_fkey" FOREIGN KEY ("sourceDepositId") REFERENCES "Deposit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DepositOperation" ADD CONSTRAINT "DepositOperation_targetDepositId_fkey" FOREIGN KEY ("targetDepositId") REFERENCES "Deposit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DepositOperation" ADD CONSTRAINT "DepositOperation_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DepositLedgerEntry" ADD CONSTRAINT "DepositLedgerEntry_rentalCycleId_fkey" FOREIGN KEY ("rentalCycleId") REFERENCES "RentalCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DepositLedgerEntry" ADD CONSTRAINT "DepositLedgerEntry_depositId_fkey" FOREIGN KEY ("depositId") REFERENCES "Deposit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DepositLedgerEntry" ADD CONSTRAINT "DepositLedgerEntry_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DepositLedgerEntry" ADD CONSTRAINT "DepositLedgerEntry_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "DepositOperation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DepositLedgerEntry" ADD CONSTRAINT "DepositLedgerEntry_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "DepositLedgerEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OutboxEvent" ADD CONSTRAINT "OutboxEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "TenantOrg"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Ledger rows are append-only. A controlled tenant purge may opt in for the
-- current transaction with: SET LOCAL app.allow_deposit_ledger_mutation = 'on'.
CREATE FUNCTION "prevent_deposit_ledger_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('app.allow_deposit_ledger_mutation', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'DepositLedgerEntry is append-only; create a REVERSAL entry instead'
      USING ERRCODE = '55000';
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER "DepositLedgerEntry_append_only"
BEFORE UPDATE OR DELETE ON "DepositLedgerEntry"
FOR EACH ROW EXECUTE FUNCTION "prevent_deposit_ledger_mutation"();
