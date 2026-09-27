-- Payment promises are operational reminders only; the invoice/payment ledger
-- remains the authoritative source for liabilities and cash allocation.
CREATE TYPE "PaymentPromiseStatus" AS ENUM ('PENDING', 'OVERDUE', 'FULFILLED', 'CANCELLED');

CREATE TABLE "PaymentPromise" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "contractId" TEXT,
  "rentalCycleId" TEXT,
  "amount" DECIMAL(14,2) NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "status" "PaymentPromiseStatus" NOT NULL DEFAULT 'PENDING',
  "note" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "createdBy" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentPromise_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PaymentPromise_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PaymentPromise_tenantId_idempotencyKey_key" ON "PaymentPromise"("tenantId", "idempotencyKey");
CREATE INDEX "PaymentPromise_tenantId_status_dueDate_idx" ON "PaymentPromise"("tenantId", "status", "dueDate");
CREATE INDEX "PaymentPromise_tenantId_invoiceId_status_idx" ON "PaymentPromise"("tenantId", "invoiceId", "status");
CREATE INDEX "PaymentPromise_tenantId_customerId_status_idx" ON "PaymentPromise"("tenantId", "customerId", "status");
