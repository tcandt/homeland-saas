CREATE TYPE "NotificationTemplateVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED');

ALTER TABLE "NotificationTemplate"
  ADD COLUMN "publishedVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "publishedAt" TIMESTAMP(3),
  ADD COLUMN "publishedById" TEXT;

CREATE TABLE "NotificationTemplateVersion" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "subject" TEXT,
  "body" TEXT NOT NULL,
  "status" "NotificationTemplateVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationTemplateVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificationTemplateVersion_tenantId_code_version_key"
  ON "NotificationTemplateVersion"("tenantId", "code", "version");
CREATE INDEX "NotificationTemplateVersion_tenantId_code_status_updatedAt_idx"
  ON "NotificationTemplateVersion"("tenantId", "code", "status", "updatedAt");
