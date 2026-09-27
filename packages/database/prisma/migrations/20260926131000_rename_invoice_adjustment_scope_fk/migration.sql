-- Align the historical constraint name with the composite tenant-scoped
-- relation declared in the Prisma schema.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Invoice_adjustmentOfInvoiceId_fkey'
  ) THEN
    ALTER TABLE "Invoice"
    RENAME CONSTRAINT "Invoice_adjustmentOfInvoiceId_fkey"
    TO "Invoice_tenantId_adjustmentOfInvoiceId_fkey";
  END IF;
END
$$;
