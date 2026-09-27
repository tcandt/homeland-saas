-- Billing immutability triggers reference PaymentAllocation. The original
-- baseline omitted this allocation table, so create it before those triggers.
CREATE TABLE IF NOT EXISTS "PaymentAllocation" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PaymentAllocation_tenantId_invoiceId_idx"
ON "PaymentAllocation"("tenantId", "invoiceId");

CREATE INDEX IF NOT EXISTS "PaymentAllocation_tenantId_paymentId_idx"
ON "PaymentAllocation"("tenantId", "paymentId");

DO $$
BEGIN
  ALTER TABLE "PaymentAllocation"
  ADD CONSTRAINT "PaymentAllocation_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "Payment"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "PaymentAllocation"
  ADD CONSTRAINT "PaymentAllocation_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;
