-- CORE-07 additive migration only.
-- Production execution is forbidden outside the approved maintenance-window runbook.

BEGIN;

CREATE TABLE "BillingSnapshot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "meterMappingId" TEXT,
    "sourceReadingId" TEXT,
    "billingPeriod" TEXT NOT NULL,
    "usagePeriod" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'LOCKED',
    "provider" TEXT NOT NULL DEFAULT 'hunonic',
    "startReadingKwh" DECIMAL(14,3),
    "endReadingKwh" DECIMAL(14,3),
    "usageKwh" DECIMAL(14,3) NOT NULL,
    "pricingMode" TEXT NOT NULL,
    "unitRateVnd" DECIMAL(14,2),
    "electricityAmount" DECIMAL(14,2) NOT NULL,
    "waterRatePerPersonVnd" DECIMAL(14,2) NOT NULL DEFAULT 100000,
    "waterAmount" DECIMAL(14,2) NOT NULL,
    "occupantCount" INTEGER NOT NULL,
    "occupants" JSONB NOT NULL,
    "allocations" JSONB NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "aggregateBasis" TEXT NOT NULL DEFAULT 'MONTHLY_AGGREGATE_V1',
    "sourcePayloadHash" TEXT NOT NULL,
    "sourceProvenance" JSONB NOT NULL,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BillingSnapshot_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BillingSnapshot_usage_non_negative_check" CHECK ("usageKwh" >= 0),
    CONSTRAINT "BillingSnapshot_electricity_non_negative_check" CHECK ("electricityAmount" >= 0),
    CONSTRAINT "BillingSnapshot_water_non_negative_check" CHECK ("waterAmount" >= 0),
    CONSTRAINT "BillingSnapshot_occupant_count_check" CHECK ("occupantCount" >= 0),
    CONSTRAINT "BillingSnapshot_status_locked_check" CHECK ("status" = 'LOCKED')
);

CREATE TABLE "MonthlySettlementRun" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "billingPeriod" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "result" JSONB,
    "errorCode" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MonthlySettlementRun_pkey" PRIMARY KEY ("id")
);

-- Observations are immutable evidence.  The source identity and exact payload
-- hash make retries idempotent without turning an observation into a mutable
-- monthly aggregate row.
ALTER TABLE "HunonicMeterReading"
    ADD COLUMN IF NOT EXISTS "sourceProvider" TEXT NOT NULL DEFAULT 'hunonic',
    ADD COLUMN IF NOT EXISTS "sourceProviderMeterId" TEXT,
    ADD COLUMN IF NOT EXISTS "sourcePeriod" TEXT,
    ADD COLUMN IF NOT EXISTS "observedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "payloadHash" TEXT,
    ADD COLUMN IF NOT EXISTS "aggregateBasis" TEXT NOT NULL DEFAULT 'MONTHLY_AGGREGATE_V1';

UPDATE "HunonicMeterReading" r
SET "sourceProviderMeterId" = m."providerMeterId",
    "sourcePeriod" = COALESCE(r."currentMonth", to_char(r."readingAt", 'YYYY-MM')),
    "observedAt" = r."readingAt",
    "payloadHash" = md5('legacy-v1:' || coalesce(r."raw"::text, '') || ':' || r."id")
        || md5('legacy-v1-suffix:' || coalesce(r."raw"::text, '') || ':' || r."id"),
    "aggregateBasis" = 'LEGACY_UNVERIFIED_AGGREGATE_V1'
FROM "HunonicMeterMapping" m
WHERE m."id" = r."meterMappingId";

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
          FROM "HunonicMeterReading" r
          LEFT JOIN "HunonicMeterMapping" m ON m."id" = r."meterMappingId"
         WHERE m."id" IS NULL
            OR m."tenantId" IS DISTINCT FROM r."tenantId"
            OR (m."roomId" IS NOT NULL AND m."roomId" IS DISTINCT FROM r."roomId")
            OR r."sourcePeriod" !~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
            OR r."sourceProviderMeterId" IS DISTINCT FROM m."providerMeterId"
            OR r."payloadHash" !~ '^[0-9a-f]{64}$'
    ) THEN
        RAISE EXCEPTION 'HUNONIC_LEGACY_READING_PREFLIGHT_FAILED' USING ERRCODE = '23514';
    END IF;
END;
$$;

ALTER TABLE "HunonicMeterReading"
    ALTER COLUMN "sourceProviderMeterId" SET NOT NULL,
    ALTER COLUMN "sourcePeriod" SET NOT NULL,
    ALTER COLUMN "observedAt" SET NOT NULL,
    ALTER COLUMN "payloadHash" SET NOT NULL;

DROP INDEX IF EXISTS "HunonicMeterReading_tenantId_meterMappingId_readingAt_key";

CREATE UNIQUE INDEX "HunonicMeterReading_tenantId_meterMappingId_payloadHash_key"
ON "HunonicMeterReading"("tenantId", "meterMappingId", "payloadHash");

ALTER TABLE "InvoiceItem" ADD COLUMN "billingSnapshotId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "billingKind" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "baseInvoiceKey" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "adjustmentOfInvoiceId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "adjustmentReason" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "adjustmentCreatedBy" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "adjustmentRequestHash" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "adjustmentIdempotencyKey" TEXT;
ALTER TABLE "Contract" ADD COLUMN "moveInSnapshot" JSONB;
ALTER TABLE "Contract" ADD COLUMN "activatedAt" TIMESTAMP(3);
ALTER TABLE "Contract" ADD COLUMN "activationIdempotencyKey" TEXT;

CREATE UNIQUE INDEX "BillingSnapshot_tenantId_roomId_usagePeriod_key"
ON "BillingSnapshot"("tenantId", "roomId", "usagePeriod");
CREATE INDEX "BillingSnapshot_tenantId_billingPeriod_idx"
ON "BillingSnapshot"("tenantId", "billingPeriod");
CREATE INDEX "BillingSnapshot_tenantId_status_usagePeriod_idx"
ON "BillingSnapshot"("tenantId", "status", "usagePeriod");
CREATE INDEX "BillingSnapshot_tenantId_meterMappingId_usagePeriod_idx"
ON "BillingSnapshot"("tenantId", "meterMappingId", "usagePeriod");
CREATE INDEX "InvoiceItem_tenantId_billingSnapshotId_idx"
ON "InvoiceItem"("tenantId", "billingSnapshotId");
CREATE UNIQUE INDEX "Contract_tenantId_activationIdempotencyKey_key"
ON "Contract"("tenantId", "activationIdempotencyKey");
CREATE UNIQUE INDEX "Invoice_tenantId_baseInvoiceKey_key"
ON "Invoice"("tenantId", "baseInvoiceKey");
CREATE UNIQUE INDEX "Invoice_tenantId_id_key"
ON "Invoice"("tenantId", "id");
CREATE UNIQUE INDEX "Invoice_tenantId_adjustmentIdempotencyKey_key"
ON "Invoice"("tenantId", "adjustmentIdempotencyKey");
CREATE INDEX "Invoice_tenantId_adjustmentOfInvoiceId_idx"
ON "Invoice"("tenantId", "adjustmentOfInvoiceId");
CREATE UNIQUE INDEX "MonthlySettlementRun_tenantId_billingPeriod_scopeKey_key"
ON "MonthlySettlementRun"("tenantId", "billingPeriod", "scopeKey");
CREATE UNIQUE INDEX "MonthlySettlementRun_tenantId_idempotencyKey_key"
ON "MonthlySettlementRun"("tenantId", "idempotencyKey");
CREATE INDEX "MonthlySettlementRun_tenantId_status_startedAt_idx"
ON "MonthlySettlementRun"("tenantId", "status", "startedAt");

ALTER TABLE "BillingSnapshot"
ADD CONSTRAINT "BillingSnapshot_roomId_fkey"
FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BillingSnapshot"
ADD CONSTRAINT "BillingSnapshot_meterMappingId_fkey"
FOREIGN KEY ("meterMappingId") REFERENCES "HunonicMeterMapping"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BillingSnapshot"
ADD CONSTRAINT "BillingSnapshot_sourceReadingId_fkey"
FOREIGN KEY ("sourceReadingId") REFERENCES "HunonicMeterReading"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvoiceItem"
ADD CONSTRAINT "InvoiceItem_billingSnapshotId_fkey"
FOREIGN KEY ("billingSnapshotId") REFERENCES "BillingSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invoice"
ADD CONSTRAINT "Invoice_adjustmentOfInvoiceId_fkey"
FOREIGN KEY ("tenantId", "adjustmentOfInvoiceId") REFERENCES "Invoice"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Invoice"
ADD CONSTRAINT "Invoice_billing_kind_shape_check" CHECK (
    (
        "billingKind" IS NULL
        AND "baseInvoiceKey" IS NULL
        AND "adjustmentOfInvoiceId" IS NULL
        AND "adjustmentReason" IS NULL
        AND "adjustmentCreatedBy" IS NULL
        AND "adjustmentRequestHash" IS NULL
        AND "adjustmentIdempotencyKey" IS NULL
    )
    OR (
        "billingKind" IN ('ENTRY', 'MONTHLY_BASE')
        AND "baseInvoiceKey" IS NOT NULL
        AND "adjustmentOfInvoiceId" IS NULL
        AND "adjustmentReason" IS NULL
        AND "adjustmentCreatedBy" IS NULL
        AND "adjustmentRequestHash" IS NULL
        AND "adjustmentIdempotencyKey" IS NULL
    )
    OR (
        "billingKind" IN ('DEBIT_ADJUSTMENT', 'CREDIT_ADJUSTMENT')
        AND "baseInvoiceKey" IS NULL
        AND "adjustmentOfInvoiceId" IS NOT NULL
        AND length(trim(COALESCE("adjustmentReason", ''))) > 0
        AND length(trim(COALESCE("adjustmentCreatedBy", ''))) > 0
        AND length(trim(COALESCE("adjustmentRequestHash", ''))) > 0
        AND length(trim(COALESCE("adjustmentIdempotencyKey", ''))) BETWEEN 8 AND 128
        AND "subtotal" > 0
        AND "total" > 0
        AND "discount" = 0
        AND (
            "billingKind" <> 'CREDIT_ADJUSTMENT'
            OR ("paidAmount" = 0 AND "creditAmount" = 0)
        )
    )
);

CREATE OR REPLACE FUNCTION "protect_invoice_economic_fields"()
RETURNS TRIGGER AS $$
DECLARE
    protected_issued_document BOOLEAN;
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD."status" <> 'DRAFT' THEN
            RAISE EXCEPTION 'INVOICE_APPEND_ONLY_DELETE_FORBIDDEN' USING ERRCODE = '23514';
        END IF;
        RETURN OLD;
    END IF;

    protected_issued_document :=
        OLD."status" <> 'DRAFT'
        AND OLD."billingKind" IN (
            'ENTRY',
            'MONTHLY_BASE',
            'DEBIT_ADJUSTMENT',
            'CREDIT_ADJUSTMENT'
        );

    IF protected_issued_document AND (
        NEW."deletedAt" IS DISTINCT FROM OLD."deletedAt"
        OR NEW."deletedBy" IS DISTINCT FROM OLD."deletedBy"
        OR NEW."deleteReason" IS DISTINCT FROM OLD."deleteReason"
    ) THEN
        RAISE EXCEPTION 'INVOICE_APPEND_ONLY_SOFT_DELETE_FORBIDDEN' USING ERRCODE = '23514';
    END IF;

    IF protected_issued_document
       AND NEW."status" IS DISTINCT FROM OLD."status"
       AND NOT (
           OLD."billingKind" <> 'CREDIT_ADJUSTMENT'
           AND (
               (OLD."status" = 'ISSUED' AND NEW."status" IN ('PARTIALLY_PAID', 'PAID', 'OVERDUE'))
               OR (OLD."status" = 'PARTIALLY_PAID' AND NEW."status" IN ('PAID', 'OVERDUE'))
               OR (OLD."status" = 'OVERDUE' AND NEW."status" IN ('PARTIALLY_PAID', 'PAID'))
           )
       ) THEN
        RAISE EXCEPTION 'INVOICE_APPEND_ONLY_STATUS_TRANSITION_FORBIDDEN' USING ERRCODE = '23514';
    END IF;

    IF OLD."status" <> 'DRAFT' AND (
        NEW."tenantId" IS DISTINCT FROM OLD."tenantId"
        OR NEW."contractId" IS DISTINCT FROM OLD."contractId"
        OR NEW."rentalCycleId" IS DISTINCT FROM OLD."rentalCycleId"
        OR NEW."customerId" IS DISTINCT FROM OLD."customerId"
        OR NEW."code" IS DISTINCT FROM OLD."code"
        OR NEW."period" IS DISTINCT FROM OLD."period"
        OR NEW."usagePeriod" IS DISTINCT FROM OLD."usagePeriod"
        OR NEW."dueDate" IS DISTINCT FROM OLD."dueDate"
        OR NEW."subtotal" IS DISTINCT FROM OLD."subtotal"
        OR NEW."discount" IS DISTINCT FROM OLD."discount"
        OR NEW."total" IS DISTINCT FROM OLD."total"
        OR NEW."billingKind" IS DISTINCT FROM OLD."billingKind"
        OR NEW."baseInvoiceKey" IS DISTINCT FROM OLD."baseInvoiceKey"
        OR NEW."adjustmentOfInvoiceId" IS DISTINCT FROM OLD."adjustmentOfInvoiceId"
        OR NEW."adjustmentReason" IS DISTINCT FROM OLD."adjustmentReason"
        OR NEW."adjustmentCreatedBy" IS DISTINCT FROM OLD."adjustmentCreatedBy"
        OR NEW."adjustmentRequestHash" IS DISTINCT FROM OLD."adjustmentRequestHash"
        OR NEW."adjustmentIdempotencyKey" IS DISTINCT FROM OLD."adjustmentIdempotencyKey"
    ) THEN
        RAISE EXCEPTION 'INVOICE_APPEND_ONLY_ECONOMIC_FIELDS' USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Invoice_protect_economic_fields"
BEFORE UPDATE OR DELETE ON "Invoice"
FOR EACH ROW EXECUTE FUNCTION "protect_invoice_economic_fields"();

CREATE OR REPLACE FUNCTION "validate_invoice_adjustment_scope"()
RETURNS TRIGGER AS $$
DECLARE
    parent_invoice "Invoice"%ROWTYPE;
BEGIN
    IF NEW."billingKind" IN ('DEBIT_ADJUSTMENT', 'CREDIT_ADJUSTMENT') THEN
        IF NEW."adjustmentOfInvoiceId" IS NULL
           OR NEW."adjustmentOfInvoiceId" = NEW."id" THEN
            RAISE EXCEPTION 'INVOICE_ADJUSTMENT_REQUIRES_ROOT_BASE' USING ERRCODE = '23514';
        END IF;

        SELECT *
          INTO parent_invoice
          FROM "Invoice"
         WHERE "id" = NEW."adjustmentOfInvoiceId";

        IF NOT FOUND THEN
            RAISE EXCEPTION 'INVOICE_ADJUSTMENT_BASE_NOT_FOUND' USING ERRCODE = '23503';
        END IF;
        IF parent_invoice."tenantId" IS DISTINCT FROM NEW."tenantId" THEN
            RAISE EXCEPTION 'INVOICE_ADJUSTMENT_TENANT_MISMATCH' USING ERRCODE = '23514';
        END IF;
        IF parent_invoice."billingKind" NOT IN ('ENTRY', 'MONTHLY_BASE')
           OR parent_invoice."adjustmentOfInvoiceId" IS NOT NULL THEN
            RAISE EXCEPTION 'INVOICE_ADJUSTMENT_REQUIRES_ROOT_BASE' USING ERRCODE = '23514';
        END IF;
        IF NEW."customerId" IS DISTINCT FROM parent_invoice."customerId"
           OR NEW."contractId" IS DISTINCT FROM parent_invoice."contractId"
           OR NEW."rentalCycleId" IS DISTINCT FROM parent_invoice."rentalCycleId"
           OR NEW."period" IS DISTINCT FROM parent_invoice."period"
           OR NEW."usagePeriod" IS DISTINCT FROM parent_invoice."usagePeriod" THEN
            RAISE EXCEPTION 'INVOICE_ADJUSTMENT_SCOPE_MISMATCH' USING ERRCODE = '23514';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Invoice_validate_adjustment_scope"
BEFORE INSERT OR UPDATE ON "Invoice"
FOR EACH ROW EXECUTE FUNCTION "validate_invoice_adjustment_scope"();

CREATE OR REPLACE FUNCTION "protect_issued_invoice_items"()
RETURNS TRIGGER AS $$
DECLARE
    old_parent_status TEXT;
    old_parent_kind TEXT;
    old_parent_tenant TEXT;
    new_parent_status TEXT;
    new_parent_kind TEXT;
    new_parent_tenant TEXT;
    snapshot_tenant TEXT;
    snapshot_usage_period TEXT;
BEGIN
    IF TG_OP IN ('UPDATE', 'DELETE') THEN
        SELECT "status", "billingKind", "tenantId"
          INTO old_parent_status, old_parent_kind, old_parent_tenant
          FROM "Invoice"
         WHERE "id" = OLD."invoiceId";
        IF NOT FOUND OR old_parent_tenant IS DISTINCT FROM OLD."tenantId" THEN
            RAISE EXCEPTION 'INVOICE_ITEM_PARENT_TENANT_MISMATCH' USING ERRCODE = '23514';
        END IF;
    END IF;

    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        SELECT "status", "billingKind", "tenantId"
          INTO new_parent_status, new_parent_kind, new_parent_tenant
          FROM "Invoice"
         WHERE "id" = NEW."invoiceId";
        IF NOT FOUND OR new_parent_tenant IS DISTINCT FROM NEW."tenantId" THEN
            RAISE EXCEPTION 'INVOICE_ITEM_PARENT_TENANT_MISMATCH' USING ERRCODE = '23514';
        END IF;
        IF NEW."billingSnapshotId" IS NOT NULL THEN
            SELECT "tenantId", "usagePeriod"
              INTO snapshot_tenant, snapshot_usage_period
              FROM "BillingSnapshot"
             WHERE "id" = NEW."billingSnapshotId";
            IF NOT FOUND OR snapshot_tenant IS DISTINCT FROM NEW."tenantId" THEN
                RAISE EXCEPTION 'INVOICE_ITEM_SNAPSHOT_TENANT_MISMATCH' USING ERRCODE = '23514';
            END IF;
            IF NEW."type" NOT IN ('UTILITY_ELECTRICITY', 'UTILITY_WATER')
               OR NEW."servicePeriod" IS DISTINCT FROM snapshot_usage_period THEN
                RAISE EXCEPTION 'INVOICE_ITEM_SNAPSHOT_PERIOD_MISMATCH' USING ERRCODE = '23514';
            END IF;
        END IF;
        IF new_parent_kind = 'MONTHLY_BASE'
           AND NEW."type" IN ('UTILITY_ELECTRICITY', 'UTILITY_WATER')
           AND NEW."billingSnapshotId" IS NULL THEN
            RAISE EXCEPTION 'MONTHLY_UTILITY_SNAPSHOT_REQUIRED' USING ERRCODE = '23514';
        END IF;
    END IF;

    IF TG_OP = 'INSERT'
       AND new_parent_kind IN ('DEBIT_ADJUSTMENT', 'CREDIT_ADJUSTMENT')
       AND new_parent_status <> 'DRAFT' THEN
        RAISE EXCEPTION 'INVOICE_ADJUSTMENT_ITEM_APPEND_FORBIDDEN' USING ERRCODE = '23514';
    END IF;

    IF TG_OP = 'UPDATE'
       AND (old_parent_status <> 'DRAFT' OR new_parent_status <> 'DRAFT') THEN
        RAISE EXCEPTION 'INVOICE_ITEM_APPEND_ONLY' USING ERRCODE = '23514';
    END IF;
    IF TG_OP = 'DELETE' AND old_parent_status <> 'DRAFT' THEN
        RAISE EXCEPTION 'INVOICE_ITEM_APPEND_ONLY' USING ERRCODE = '23514';
    END IF;

    IF TG_OP <> 'DELETE' AND new_parent_kind IN ('DEBIT_ADJUSTMENT', 'CREDIT_ADJUSTMENT')
       AND (NEW."quantity" <= 0 OR NEW."unitPrice" <= 0 OR NEW."amount" <= 0) THEN
        RAISE EXCEPTION 'INVOICE_ADJUSTMENT_ITEM_MAGNITUDE_INVALID' USING ERRCODE = '23514';
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "InvoiceItem_protect_issued_items"
BEFORE INSERT OR UPDATE OR DELETE ON "InvoiceItem"
FOR EACH ROW EXECUTE FUNCTION "protect_issued_invoice_items"();

CREATE OR REPLACE FUNCTION "prevent_credit_adjustment_allocation"()
RETURNS TRIGGER AS $$
DECLARE
    payment_tenant TEXT;
    invoice_tenant TEXT;
    invoice_kind TEXT;
BEGIN
    SELECT "tenantId"
      INTO payment_tenant
      FROM "Payment"
     WHERE "id" = NEW."paymentId";
    IF NOT FOUND THEN
        RAISE EXCEPTION 'PAYMENT_ALLOCATION_PAYMENT_NOT_FOUND' USING ERRCODE = '23503';
    END IF;

    SELECT "tenantId", "billingKind"
      INTO invoice_tenant, invoice_kind
      FROM "Invoice"
     WHERE "id" = NEW."invoiceId";
    IF NOT FOUND THEN
        RAISE EXCEPTION 'PAYMENT_ALLOCATION_INVOICE_NOT_FOUND' USING ERRCODE = '23503';
    END IF;

    IF NEW."tenantId" IS DISTINCT FROM payment_tenant
       OR NEW."tenantId" IS DISTINCT FROM invoice_tenant
       OR payment_tenant IS DISTINCT FROM invoice_tenant THEN
        RAISE EXCEPTION 'PAYMENT_ALLOCATION_TENANT_MISMATCH' USING ERRCODE = '23514';
    END IF;
    IF invoice_kind = 'CREDIT_ADJUSTMENT' THEN
        RAISE EXCEPTION 'CREDIT_ADJUSTMENT_ALLOCATION_FORBIDDEN' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PaymentAllocation_prevent_credit_adjustment"
BEFORE INSERT OR UPDATE ON "PaymentAllocation"
FOR EACH ROW EXECUTE FUNCTION "prevent_credit_adjustment_allocation"();

-- CORE-07.04 evidence guards.  A locked snapshot and an imported observation
-- are accounting evidence, not cache rows; corrections must be new evidence.
CREATE OR REPLACE FUNCTION "validate_billing_snapshot_provenance"()
RETURNS TRIGGER AS $$
DECLARE
    room_tenant TEXT;
    mapping_tenant TEXT;
    mapping_room_id TEXT;
    reading_tenant TEXT;
    reading_period TEXT;
    reading_basis TEXT;
    reading_mapping_id TEXT;
    reading_room_id TEXT;
    reading_provider_meter_id TEXT;
    reading_payload_hash TEXT;
BEGIN
    SELECT "tenantId" INTO room_tenant FROM "Room" WHERE "id" = NEW."roomId";
    IF NOT FOUND OR room_tenant IS DISTINCT FROM NEW."tenantId" THEN
        RAISE EXCEPTION 'BILLING_SNAPSHOT_ROOM_TENANT_MISMATCH' USING ERRCODE = '23514';
    END IF;
    IF NEW."meterMappingId" IS NOT NULL THEN
        SELECT "tenantId", "roomId" INTO mapping_tenant, mapping_room_id FROM "HunonicMeterMapping" WHERE "id" = NEW."meterMappingId";
        IF NOT FOUND OR mapping_tenant IS DISTINCT FROM NEW."tenantId"
           OR mapping_room_id IS DISTINCT FROM NEW."roomId" THEN
            RAISE EXCEPTION 'BILLING_SNAPSHOT_MAPPING_TENANT_MISMATCH' USING ERRCODE = '23514';
        END IF;
    END IF;
    IF NEW."sourceReadingId" IS NOT NULL THEN
        SELECT "tenantId", "sourcePeriod", "aggregateBasis", "meterMappingId", "roomId", "sourceProviderMeterId", "payloadHash"
          INTO reading_tenant, reading_period, reading_basis, reading_mapping_id, reading_room_id, reading_provider_meter_id, reading_payload_hash
          FROM "HunonicMeterReading" WHERE "id" = NEW."sourceReadingId";
        IF NOT FOUND OR reading_tenant IS DISTINCT FROM NEW."tenantId"
           OR reading_period IS DISTINCT FROM NEW."usagePeriod"
           OR reading_basis IS DISTINCT FROM NEW."aggregateBasis"
           OR reading_room_id IS DISTINCT FROM NEW."roomId"
           OR (NEW."meterMappingId" IS NOT NULL AND reading_mapping_id IS DISTINCT FROM NEW."meterMappingId") THEN
            RAISE EXCEPTION 'BILLING_SNAPSHOT_SOURCE_MISMATCH' USING ERRCODE = '23514';
        END IF;
    END IF;
    IF NEW."aggregateBasis" <> 'MONTHLY_AGGREGATE_V1' THEN
        RAISE EXCEPTION 'BILLING_SNAPSHOT_BASIS_UNSUPPORTED' USING ERRCODE = '23514';
    END IF;
    IF NEW."startReadingKwh" IS NOT NULL OR NEW."endReadingKwh" IS NOT NULL THEN
        RAISE EXCEPTION 'BILLING_SNAPSHOT_MONTHLY_AGGREGATE_REQUIRES_NULL_ENDPOINTS' USING ERRCODE = '23514';
    END IF;
    IF length(trim(COALESCE(NEW."sourcePayloadHash", ''))) = 0
       OR NEW."sourcePayloadHash" !~ '^[0-9a-f]{64}$'
       OR NEW."sourceProvenance" IS NULL
       OR (NEW."sourceReadingId" IS NOT NULL AND (
           NEW."sourceProvenance"->>'sourceProviderMeterId' IS DISTINCT FROM reading_provider_meter_id
           OR NEW."sourceProvenance"->>'readingPayloadHash' IS DISTINCT FROM reading_payload_hash
       )) THEN
        RAISE EXCEPTION 'BILLING_SNAPSHOT_PROVENANCE_REQUIRED' USING ERRCODE = '23514';
    END IF;
    IF (NEW."usageKwh" > 0 OR NEW."electricityAmount" > 0)
       AND (NEW."sourceReadingId" IS NULL OR NEW."meterMappingId" IS NULL) THEN
        RAISE EXCEPTION 'BILLING_SNAPSHOT_REQUIRES_PERSISTED_OBSERVATION' USING ERRCODE = '23514';
    END IF;
    IF NEW."billingPeriod" !~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
       OR NEW."usagePeriod" !~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
       OR to_char((NEW."usagePeriod" || '-01')::date + interval '1 month', 'YYYY-MM') <> NEW."billingPeriod" THEN
        RAISE EXCEPTION 'BILLING_SNAPSHOT_PERIOD_INVALID' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "BillingSnapshot_validate_provenance"
BEFORE INSERT OR UPDATE ON "BillingSnapshot"
FOR EACH ROW EXECUTE FUNCTION "validate_billing_snapshot_provenance"();

CREATE OR REPLACE FUNCTION "validate_hunonic_meter_reading_source"()
RETURNS TRIGGER AS $$
DECLARE
    mapping_tenant TEXT;
    mapping_room_id TEXT;
    room_tenant TEXT;
    mapping_provider_meter_id TEXT;
BEGIN
    SELECT "tenantId", "roomId", "providerMeterId"
      INTO mapping_tenant, mapping_room_id, mapping_provider_meter_id
      FROM "HunonicMeterMapping" WHERE "id" = NEW."meterMappingId";
    IF NOT FOUND OR mapping_tenant IS DISTINCT FROM NEW."tenantId"
       OR (mapping_room_id IS NOT NULL AND mapping_room_id IS DISTINCT FROM NEW."roomId") THEN
        RAISE EXCEPTION 'HUNONIC_READING_MAPPING_SCOPE_MISMATCH' USING ERRCODE = '23514';
    END IF;
    IF NEW."roomId" IS NOT NULL THEN
        SELECT "tenantId" INTO room_tenant FROM "Room" WHERE "id" = NEW."roomId";
        IF NOT FOUND OR room_tenant IS DISTINCT FROM NEW."tenantId" THEN
            RAISE EXCEPTION 'HUNONIC_READING_ROOM_TENANT_MISMATCH' USING ERRCODE = '23514';
        END IF;
    END IF;
    IF NEW."sourcePeriod" !~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
       OR NEW."sourcePeriod" IS DISTINCT FROM NEW."currentMonth"
       OR NEW."observedAt" IS NULL
       OR length(trim(COALESCE(NEW."sourceProvider", ''))) = 0
       OR NEW."sourceProviderMeterId" IS DISTINCT FROM mapping_provider_meter_id
       OR NEW."payloadHash" !~ '^[0-9a-f]{64}$'
       OR NEW."aggregateBasis" <> 'MONTHLY_AGGREGATE_V1' THEN
        RAISE EXCEPTION 'HUNONIC_READING_SOURCE_INVALID' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "HunonicMeterReading_validate_source"
BEFORE INSERT OR UPDATE ON "HunonicMeterReading"
FOR EACH ROW EXECUTE FUNCTION "validate_hunonic_meter_reading_source"();

CREATE OR REPLACE FUNCTION "protect_billing_snapshot"()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'BILLING_SNAPSHOT_IMMUTABLE' USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "BillingSnapshot_immutable"
BEFORE UPDATE OR DELETE ON "BillingSnapshot"
FOR EACH ROW EXECUTE FUNCTION "protect_billing_snapshot"();

CREATE OR REPLACE FUNCTION "protect_hunonic_meter_reading"()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'HUNONIC_READING_IMMUTABLE' USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "HunonicMeterReading_immutable"
BEFORE UPDATE OR DELETE ON "HunonicMeterReading"
FOR EACH ROW EXECUTE FUNCTION "protect_hunonic_meter_reading"();

CREATE OR REPLACE FUNCTION "protect_hunonic_mapping_identity"()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW."provider" IS DISTINCT FROM OLD."provider"
        OR NEW."providerMeterId" IS DISTINCT FROM OLD."providerMeterId"
        OR NEW."providerDeviceId" IS DISTINCT FROM OLD."providerDeviceId"
        OR NEW."providerRootId" IS DISTINCT FROM OLD."providerRootId"
        OR NEW."buildingId" IS DISTINCT FROM OLD."buildingId"
        OR NEW."roomId" IS DISTINCT FROM OLD."roomId"
        OR NEW."buildingCode" IS DISTINCT FROM OLD."buildingCode"
        OR NEW."roomCode" IS DISTINCT FROM OLD."roomCode")
       AND (EXISTS (SELECT 1 FROM "HunonicMeterReading" WHERE "meterMappingId" = OLD."id")
            OR EXISTS (SELECT 1 FROM "BillingSnapshot" WHERE "meterMappingId" = OLD."id")) THEN
        RAISE EXCEPTION 'HUNONIC_MAPPING_IDENTITY_IMMUTABLE_ONCE_USED' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "HunonicMeterMapping_identity_immutable_once_used"
BEFORE UPDATE ON "HunonicMeterMapping"
FOR EACH ROW EXECUTE FUNCTION "protect_hunonic_mapping_identity"();

COMMIT;
