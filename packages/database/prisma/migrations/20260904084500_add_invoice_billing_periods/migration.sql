ALTER TABLE "Invoice"
ADD COLUMN "period" TEXT,
ADD COLUMN "usagePeriod" TEXT;

ALTER TABLE "InvoiceItem"
ADD COLUMN "servicePeriod" TEXT;

CREATE INDEX "Invoice_tenantId_period_idx"
ON "Invoice"("tenantId", "period");

CREATE INDEX "InvoiceItem_tenantId_servicePeriod_idx"
ON "InvoiceItem"("tenantId", "servicePeriod");
