-- The historical baseline created Invoice but omitted its child line table.
-- Later migrations add periods, snapshots, and immutability triggers to this
-- table, so a clean deployment needs this additive prerequisite first.
DO $$
BEGIN
  CREATE TYPE "InvoiceItemType" AS ENUM (
    'RENT',
    'UTILITY_WATER',
    'UTILITY_ELECTRICITY',
    'SERVICE',
    'PENALTY',
    'DISCOUNT',
    'OTHER'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS "InvoiceItem" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "type" "InvoiceItemType" NOT NULL,
  "description" TEXT NOT NULL,
  "quantity" DECIMAL(14,2) NOT NULL,
  "unitPrice" DECIMAL(14,2) NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InvoiceItem_tenantId_invoiceId_idx"
ON "InvoiceItem"("tenantId", "invoiceId");

DO $$
BEGIN
  ALTER TABLE "InvoiceItem"
  ADD CONSTRAINT "InvoiceItem_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;
