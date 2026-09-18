CREATE TYPE "RentalCycleStatus" AS ENUM ('PLANNED', 'RESERVED', 'ACTIVE', 'CLOSED', 'CANCELLED');

CREATE TABLE "RentalCycle" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "status" "RentalCycleStatus" NOT NULL DEFAULT 'PLANNED',
    "expectedMoveInAt" TIMESTAMP(3),
    "actualMoveInAt" TIMESTAMP(3),
    "actualEndAt" TIMESTAMP(3),
    "closedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RentalCycle_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Contract" ADD COLUMN "rentalCycleId" TEXT;
ALTER TABLE "Deposit" ADD COLUMN "rentalCycleId" TEXT;
ALTER TABLE "Occupancy" ADD COLUMN "rentalCycleId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "rentalCycleId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "rentalCycleId" TEXT;
ALTER TABLE "ContractSettlement" ADD COLUMN "rentalCycleId" TEXT;

CREATE INDEX "RentalCycle_tenantId_customerId_status_idx" ON "RentalCycle"("tenantId", "customerId", "status");
CREATE INDEX "RentalCycle_tenantId_roomId_status_idx" ON "RentalCycle"("tenantId", "roomId", "status");
CREATE INDEX "RentalCycle_tenantId_status_expectedMoveInAt_idx" ON "RentalCycle"("tenantId", "status", "expectedMoveInAt");
CREATE INDEX "Contract_tenantId_rentalCycleId_idx" ON "Contract"("tenantId", "rentalCycleId");
CREATE INDEX "Deposit_tenantId_rentalCycleId_status_idx" ON "Deposit"("tenantId", "rentalCycleId", "status");
CREATE INDEX "Occupancy_tenantId_rentalCycleId_leftAt_idx" ON "Occupancy"("tenantId", "rentalCycleId", "leftAt");
CREATE INDEX "Invoice_tenantId_rentalCycleId_status_idx" ON "Invoice"("tenantId", "rentalCycleId", "status");
CREATE INDEX "Payment_tenantId_rentalCycleId_status_idx" ON "Payment"("tenantId", "rentalCycleId", "status");
CREATE INDEX "ContractSettlement_tenantId_rentalCycleId_idx" ON "ContractSettlement"("tenantId", "rentalCycleId");

ALTER TABLE "RentalCycle" ADD CONSTRAINT "RentalCycle_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RentalCycle" ADD CONSTRAINT "RentalCycle_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_rentalCycleId_fkey" FOREIGN KEY ("rentalCycleId") REFERENCES "RentalCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Deposit" ADD CONSTRAINT "Deposit_rentalCycleId_fkey" FOREIGN KEY ("rentalCycleId") REFERENCES "RentalCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Occupancy" ADD CONSTRAINT "Occupancy_rentalCycleId_fkey" FOREIGN KEY ("rentalCycleId") REFERENCES "RentalCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_rentalCycleId_fkey" FOREIGN KEY ("rentalCycleId") REFERENCES "RentalCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_rentalCycleId_fkey" FOREIGN KEY ("rentalCycleId") REFERENCES "RentalCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContractSettlement" ADD CONSTRAINT "ContractSettlement_rentalCycleId_fkey" FOREIGN KEY ("rentalCycleId") REFERENCES "RentalCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
