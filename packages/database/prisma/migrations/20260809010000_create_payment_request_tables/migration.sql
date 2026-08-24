-- Create missing payment request tables before owner/bank allocation migration.
-- This keeps the historical migration chain intact for databases that were
-- baselined before PaymentRequest existed as a physical table.

DO $$
BEGIN
    CREATE TYPE "PaymentProvider" AS ENUM ('SEPAY', 'MANUAL');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE "PaymentSourceType" AS ENUM ('INVOICE', 'DEPOSIT');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE "PaymentRequestStatus" AS ENUM ('PENDING', 'CONFIRMED', 'EXPIRED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE "PaymentRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sourceType" "PaymentSourceType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'SEPAY',
    "paymentCode" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "bankName" TEXT NOT NULL,
    "bankAccountNumber" TEXT NOT NULL,
    "bankAccountName" TEXT,
    "qrUrl" TEXT NOT NULL,
    "status" "PaymentRequestStatus" NOT NULL DEFAULT 'PENDING',
    "providerTransactionId" TEXT,
    "paidAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentRequest_tenantId_paymentCode_key" ON "PaymentRequest"("tenantId", "paymentCode");
CREATE UNIQUE INDEX "PaymentRequest_provider_providerTransactionId_key" ON "PaymentRequest"("provider", "providerTransactionId");
CREATE INDEX "PaymentRequest_tenantId_sourceType_sourceId_idx" ON "PaymentRequest"("tenantId", "sourceType", "sourceId");
CREATE INDEX "PaymentRequest_tenantId_status_idx" ON "PaymentRequest"("tenantId", "status");

CREATE TABLE "PaymentWebhookLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "provider" "PaymentProvider" NOT NULL,
    "providerTransactionId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentWebhookLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentWebhookLog_provider_providerTransactionId_key" ON "PaymentWebhookLog"("provider", "providerTransactionId");
CREATE INDEX "PaymentWebhookLog_tenantId_createdAt_idx" ON "PaymentWebhookLog"("tenantId", "createdAt");
