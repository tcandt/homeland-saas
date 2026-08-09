-- Add owner and operational expense allocation fields.
-- This migration is additive: existing buildings, banks, payment requests, and expenses keep working.

CREATE TYPE "ExpenseCategory" AS ENUM (
  'SUPPLIES',
  'REPAIR',
  'MAINTENANCE',
  'UTILITY',
  'CLEANING',
  'REFUND',
  'STAFF',
  'OTHER'
);

CREATE TYPE "ExpenseSettlementStatus" AS ENUM (
  'NONE',
  'PENDING_REIMBURSEMENT',
  'REIMBURSED',
  'DEDUCTED_FROM_PROFIT'
);

CREATE TABLE "Owner" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "email" TEXT,
  "notes" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Owner_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Owner"
  ADD CONSTRAINT "Owner_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "TenantOrg"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Owner_tenantId_code_key" ON "Owner"("tenantId", "code");
CREATE INDEX "Owner_tenantId_isActive_idx" ON "Owner"("tenantId", "isActive");

ALTER TABLE "Building" ADD COLUMN "ownerId" TEXT;
ALTER TABLE "Building"
  ADD CONSTRAINT "Building_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "Owner"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Building_tenantId_ownerId_idx" ON "Building"("tenantId", "ownerId");

ALTER TABLE "BankAccount" ADD COLUMN "ownerId" TEXT;
ALTER TABLE "BankAccount"
  ADD CONSTRAINT "BankAccount_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "Owner"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "BankAccount_tenantId_ownerId_idx" ON "BankAccount"("tenantId", "ownerId");

ALTER TABLE "PaymentRequest"
  ADD COLUMN "ownerId" TEXT,
  ADD COLUMN "buildingId" TEXT,
  ADD COLUMN "roomId" TEXT,
  ADD COLUMN "bankAccountId" TEXT;

ALTER TABLE "PaymentRequest"
  ADD CONSTRAINT "PaymentRequest_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "Owner"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PaymentRequest"
  ADD CONSTRAINT "PaymentRequest_bankAccountId_fkey"
  FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "PaymentRequest_tenantId_ownerId_idx" ON "PaymentRequest"("tenantId", "ownerId");
CREATE INDEX "PaymentRequest_tenantId_buildingId_idx" ON "PaymentRequest"("tenantId", "buildingId");
CREATE INDEX "PaymentRequest_tenantId_bankAccountId_idx" ON "PaymentRequest"("tenantId", "bankAccountId");

ALTER TABLE "CostCenter"
  ADD COLUMN "ownerId" TEXT,
  ADD COLUMN "buildingId" TEXT;

ALTER TABLE "CostCenter"
  ADD CONSTRAINT "CostCenter_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "Owner"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "CostCenter_tenantId_ownerId_idx" ON "CostCenter"("tenantId", "ownerId");
CREATE INDEX "CostCenter_tenantId_buildingId_idx" ON "CostCenter"("tenantId", "buildingId");

ALTER TABLE "Expense"
  ADD COLUMN "ownerId" TEXT,
  ADD COLUMN "buildingId" TEXT,
  ADD COLUMN "roomId" TEXT,
  ADD COLUMN "paidByOwnerId" TEXT,
  ADD COLUMN "paidByName" TEXT,
  ADD COLUMN "category" "ExpenseCategory" NOT NULL DEFAULT 'OTHER',
  ADD COLUMN "vendor" TEXT,
  ADD COLUMN "settlementStatus" "ExpenseSettlementStatus" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "attachmentUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "approvedBy" TEXT,
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "reimbursedAt" TIMESTAMP(3);

ALTER TABLE "Expense"
  ADD CONSTRAINT "Expense_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "Owner"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Expense"
  ADD CONSTRAINT "Expense_paidByOwnerId_fkey"
  FOREIGN KEY ("paidByOwnerId") REFERENCES "Owner"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Expense_tenantId_ownerId_date_idx" ON "Expense"("tenantId", "ownerId", "date");
CREATE INDEX "Expense_tenantId_paidByOwnerId_settlementStatus_idx" ON "Expense"("tenantId", "paidByOwnerId", "settlementStatus");
CREATE INDEX "Expense_tenantId_buildingId_date_idx" ON "Expense"("tenantId", "buildingId", "date");
