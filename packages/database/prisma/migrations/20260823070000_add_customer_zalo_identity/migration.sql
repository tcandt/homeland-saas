ALTER TABLE "Customer"
  ADD COLUMN IF NOT EXISTS "zaloChatId" TEXT,
  ADD COLUMN IF NOT EXISTS "zaloUserId" TEXT;

CREATE INDEX IF NOT EXISTS "Customer_tenantId_zaloChatId_idx" ON "Customer"("tenantId", "zaloChatId");
CREATE INDEX IF NOT EXISTS "Customer_tenantId_zaloUserId_idx" ON "Customer"("tenantId", "zaloUserId");
