DO $$
BEGIN
  CREATE TYPE "PaymentWebhookStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'IGNORED', 'NEEDS_REVIEW', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "PaymentWebhookLog"
  ADD COLUMN IF NOT EXISTS "status" "PaymentWebhookStatus" NOT NULL DEFAULT 'RECEIVED',
  ADD COLUMN IF NOT EXISTS "attemptCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "processingStartedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastError" TEXT;

CREATE INDEX IF NOT EXISTS "PaymentWebhookLog_status_createdAt_idx"
  ON "PaymentWebhookLog"("status", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "Payment_tenantId_provider_providerRef_nonempty_key"
  ON "Payment"("tenantId", "provider", "providerRef")
  WHERE "providerRef" IS NOT NULL AND "providerRef" <> '';
