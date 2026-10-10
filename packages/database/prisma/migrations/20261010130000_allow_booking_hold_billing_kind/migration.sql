-- Booking-hold invoices are base economic documents, like entry invoices.
-- Replace only the forward constraint; historical migration bytes remain unchanged.
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
        "billingKind" IN ('ENTRY', 'MONTHLY_BASE', 'BOOKING_HOLD')
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
COMMIT;
