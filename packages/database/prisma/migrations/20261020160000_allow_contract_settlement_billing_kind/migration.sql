-- Settlement invoices are canonical base documents with an immutable key.
-- Keep every existing shape clause intact while allowing this forward kind.
BEGIN;
ALTER TABLE "Invoice" DROP CONSTRAINT IF EXISTS "Invoice_billing_kind_shape_check";

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
        "billingKind" IN ('ENTRY', 'MONTHLY_BASE', 'BOOKING_HOLD', 'CONTRACT_SETTLEMENT')
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

-- The common economic-field guard already covers non-DRAFT settlement
-- invoices. Extend status/soft-delete protection without changing older kinds.
CREATE FUNCTION "protect_settlement_invoice_state"()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD."billingKind" = 'CONTRACT_SETTLEMENT' AND OLD."status" <> 'DRAFT' THEN
        IF NEW."deletedAt" IS DISTINCT FROM OLD."deletedAt"
           OR NEW."deletedBy" IS DISTINCT FROM OLD."deletedBy"
           OR NEW."deleteReason" IS DISTINCT FROM OLD."deleteReason" THEN
            RAISE EXCEPTION 'INVOICE_APPEND_ONLY_SOFT_DELETE_FORBIDDEN' USING ERRCODE = '23514';
        END IF;
        IF NEW."status" IS DISTINCT FROM OLD."status" AND NOT (
            (OLD."status" = 'ISSUED' AND NEW."status" IN ('PARTIALLY_PAID', 'PAID', 'OVERDUE'))
            OR (OLD."status" = 'PARTIALLY_PAID' AND NEW."status" IN ('PAID', 'OVERDUE'))
            OR (OLD."status" = 'OVERDUE' AND NEW."status" IN ('PARTIALLY_PAID', 'PAID'))
        ) THEN
            RAISE EXCEPTION 'INVOICE_APPEND_ONLY_STATUS_TRANSITION_FORBIDDEN' USING ERRCODE = '23514';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Invoice_protect_settlement_state"
BEFORE UPDATE ON "Invoice"
FOR EACH ROW EXECUTE FUNCTION "protect_settlement_invoice_state"();

CREATE FUNCTION "protect_settlement_item_insert"()
RETURNS TRIGGER AS $$
DECLARE
    parent_invoice "Invoice"%ROWTYPE;
BEGIN
    SELECT * INTO parent_invoice FROM "Invoice"
      WHERE "id" = NEW."invoiceId" FOR SHARE;
    IF parent_invoice."billingKind" = 'CONTRACT_SETTLEMENT'
       AND parent_invoice."status" <> 'DRAFT' THEN
        RAISE EXCEPTION 'INVOICE_SETTLEMENT_ITEM_APPEND_FORBIDDEN' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "InvoiceItem_protect_settlement_insert"
BEFORE INSERT ON "InvoiceItem"
FOR EACH ROW EXECUTE FUNCTION "protect_settlement_item_insert"();

COMMIT;
