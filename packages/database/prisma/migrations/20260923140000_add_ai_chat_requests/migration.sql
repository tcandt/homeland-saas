CREATE TYPE "AiChatRequestStatus" AS ENUM ('RUNNING', 'PROVIDER_COMPLETED', 'COMPLETED', 'FAILED');

CREATE TABLE "AiChatRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "status" "AiChatRequestStatus" NOT NULL DEFAULT 'RUNNING',
    "result" JSONB,
    "errorCode" TEXT,
    "leaseExpiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiChatRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiChatRequest_tenantId_userId_idempotencyKey_key"
    ON "AiChatRequest"("tenantId", "userId", "idempotencyKey");

CREATE INDEX "AiChatRequest_tenantId_userId_status_leaseExpiresAt_idx"
    ON "AiChatRequest"("tenantId", "userId", "status", "leaseExpiresAt");

CREATE INDEX "AiChatRequest_conversationId_idx"
    ON "AiChatRequest"("conversationId");
