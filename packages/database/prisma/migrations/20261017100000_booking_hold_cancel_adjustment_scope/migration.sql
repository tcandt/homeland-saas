BEGIN;

-- Booking-hold cancellation is a private adjustment shape. The historical
-- public base-invoice rule remains unchanged for ENTRY and MONTHLY_BASE.
CREATE OR REPLACE FUNCTION "validate_invoice_adjustment_scope"()
RETURNS TRIGGER AS $$
DECLARE
    parent_invoice "Invoice"%ROWTYPE;
    booking_deposit "Deposit"%ROWTYPE;
    booking_terms JSONB;
    booking_deposit_id TEXT;
    unpaid_remaining NUMERIC;
    expected_hash TEXT;
    item_count INTEGER;
    item_amount NUMERIC;
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
        IF NEW."customerId" IS DISTINCT FROM parent_invoice."customerId"
           OR NEW."contractId" IS DISTINCT FROM parent_invoice."contractId"
           OR NEW."rentalCycleId" IS DISTINCT FROM parent_invoice."rentalCycleId"
           OR NEW."period" IS DISTINCT FROM parent_invoice."period"
           OR NEW."usagePeriod" IS DISTINCT FROM parent_invoice."usagePeriod" THEN
            RAISE EXCEPTION 'INVOICE_ADJUSTMENT_SCOPE_MISMATCH' USING ERRCODE = '23514';
        END IF;

        IF parent_invoice."billingKind" IN ('ENTRY', 'MONTHLY_BASE')
           AND parent_invoice."adjustmentOfInvoiceId" IS NULL THEN
            RETURN NEW;
        END IF;

        IF parent_invoice."billingKind" <> 'BOOKING_HOLD'
           OR parent_invoice."adjustmentOfInvoiceId" IS NOT NULL
           OR NEW."billingKind" <> 'CREDIT_ADJUSTMENT'
           OR parent_invoice."status" NOT IN ('ISSUED', 'PARTIALLY_PAID', 'OVERDUE')
           OR NEW."status" NOT IN ('DRAFT', 'ISSUED') THEN
            RAISE EXCEPTION 'INVOICE_ADJUSTMENT_REQUIRES_ROOT_BASE' USING ERRCODE = '23514';
        END IF;

        SELECT c."termsSnapshot"
          INTO booking_terms
          FROM "Contract" c
         WHERE c."id" = parent_invoice."contractId"
           AND c."tenantId" = parent_invoice."tenantId"
           AND c."deletedAt" IS NULL;
        booking_deposit_id := booking_terms #>> '{bookingCommand,depositId}';
        IF booking_terms IS NULL
           OR booking_terms #>> '{bookingCommand,invoiceId}' IS DISTINCT FROM parent_invoice."id"
           OR booking_deposit_id IS NULL
           OR length(trim(booking_deposit_id)) = 0 THEN
            RAISE EXCEPTION 'BOOKING_HOLD_CANCELLATION_SCOPE_INVALID' USING ERRCODE = '23514';
        END IF;

        SELECT *
          INTO booking_deposit
          FROM "Deposit" d
         WHERE d."id" = booking_deposit_id
           AND d."tenantId" = parent_invoice."tenantId"
           AND d."deletedAt" IS NULL
           AND d."type" IN ('BOOKING', 'RESERVATION');
        IF NOT FOUND
           OR booking_deposit."contractId" IS DISTINCT FROM parent_invoice."contractId"
           OR booking_deposit."rentalCycleId" IS DISTINCT FROM parent_invoice."rentalCycleId"
           OR booking_deposit."customerId" IS DISTINCT FROM parent_invoice."customerId"
           OR booking_deposit."status" <> 'CANCELLED' THEN
            RAISE EXCEPTION 'BOOKING_HOLD_CANCELLATION_SCOPE_INVALID' USING ERRCODE = '23514';
        END IF;
        IF NOT EXISTS (
            SELECT 1
              FROM "DepositOperation" operation
             WHERE operation."tenantId" = parent_invoice."tenantId"
               AND operation."sourceDepositId" = booking_deposit."id"
               AND operation."rentalCycleId" IS NOT DISTINCT FROM booking_deposit."rentalCycleId"
               AND operation."contractId" IS NOT DISTINCT FROM booking_deposit."contractId"
               AND operation."type" = 'CANCEL'
               AND operation."status" = 'PENDING'
        ) THEN
            RAISE EXCEPTION 'BOOKING_HOLD_CANCELLATION_SCOPE_INVALID' USING ERRCODE = '23514';
        END IF;

        unpaid_remaining := parent_invoice."total" - parent_invoice."paidAmount" - parent_invoice."creditAmount";
        expected_hash := encode(
            sha256(convert_to(
                parent_invoice."tenantId" || ':' || parent_invoice."id" || ':' || booking_deposit."id" || ':' || trim_scale(unpaid_remaining)::text,
                'UTF8'
            )),
            'hex'
        );
        IF unpaid_remaining <= 0
           OR NEW."subtotal" IS DISTINCT FROM unpaid_remaining
           OR NEW."total" IS DISTINCT FROM unpaid_remaining
           OR NEW."discount" <> 0
           OR NEW."paidAmount" <> 0
           OR NEW."creditAmount" <> 0
           OR NEW."adjustmentIdempotencyKey" IS DISTINCT FROM ('booking-cancel:' || booking_deposit."id")
           OR NEW."adjustmentRequestHash" IS DISTINCT FROM expected_hash THEN
            RAISE EXCEPTION 'BOOKING_HOLD_CANCELLATION_SCOPE_INVALID' USING ERRCODE = '23514';
        END IF;

        IF NEW."status" = 'ISSUED' THEN
            SELECT COUNT(*), COALESCE(SUM(item."amount"), 0)
              INTO item_count, item_amount
              FROM "InvoiceItem" item
             WHERE item."tenantId" = NEW."tenantId"
               AND item."invoiceId" = NEW."id";
            IF item_count <> 1 OR item_amount IS DISTINCT FROM unpaid_remaining THEN
                RAISE EXCEPTION 'BOOKING_HOLD_CANCELLATION_ITEM_INVALID' USING ERRCODE = '23514';
            END IF;
        END IF;
        RETURN NEW;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "validate_booking_hold_cancellation_item"()
RETURNS TRIGGER AS $$
DECLARE
    adjustment_invoice "Invoice"%ROWTYPE;
    parent_invoice "Invoice"%ROWTYPE;
    booking_deposit_id TEXT;
    unpaid_remaining NUMERIC;
BEGIN
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    SELECT * INTO adjustment_invoice FROM "Invoice" WHERE "id" = NEW."invoiceId";
    IF NOT FOUND
       OR adjustment_invoice."tenantId" IS DISTINCT FROM NEW."tenantId"
       OR adjustment_invoice."billingKind" <> 'CREDIT_ADJUSTMENT'
       OR adjustment_invoice."adjustmentOfInvoiceId" IS NULL THEN
        RETURN NEW;
    END IF;
    SELECT * INTO parent_invoice FROM "Invoice" WHERE "id" = adjustment_invoice."adjustmentOfInvoiceId";
    IF NOT FOUND OR parent_invoice."billingKind" <> 'BOOKING_HOLD' THEN
        RETURN NEW;
    END IF;

    SELECT c."termsSnapshot" #>> '{bookingCommand,depositId}'
      INTO booking_deposit_id
      FROM "Contract" c
     WHERE c."id" = parent_invoice."contractId"
       AND c."tenantId" = parent_invoice."tenantId"
       AND c."deletedAt" IS NULL;
    IF booking_deposit_id IS NULL
       OR adjustment_invoice."adjustmentIdempotencyKey" IS DISTINCT FROM ('booking-cancel:' || booking_deposit_id) THEN
        RAISE EXCEPTION 'BOOKING_HOLD_CANCELLATION_ITEM_INVALID' USING ERRCODE = '23514';
    END IF;

    unpaid_remaining := parent_invoice."total" - parent_invoice."paidAmount" - parent_invoice."creditAmount";
    IF NEW."amount" IS DISTINCT FROM unpaid_remaining
       OR NEW."quantity" <> 1
       OR NEW."unitPrice" IS DISTINCT FROM unpaid_remaining
       OR NEW."type" <> 'OTHER'
       OR NEW."description" IS DISTINCT FROM 'Internal closure of unpaid booking hold balance'
       OR NEW."servicePeriod" IS DISTINCT FROM COALESCE(parent_invoice."period", 'BOOKING_HOLD')
       OR EXISTS (
            SELECT 1
              FROM "InvoiceItem" item
             WHERE item."invoiceId" = NEW."invoiceId"
               AND item."id" <> NEW."id"
       ) THEN
        RAISE EXCEPTION 'BOOKING_HOLD_CANCELLATION_ITEM_INVALID' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "Invoice_validate_booking_hold_cancellation_item" ON "InvoiceItem";
CREATE TRIGGER "Invoice_validate_booking_hold_cancellation_item"
BEFORE INSERT OR UPDATE ON "InvoiceItem"
FOR EACH ROW EXECUTE FUNCTION "validate_booking_hold_cancellation_item"();

COMMIT;
