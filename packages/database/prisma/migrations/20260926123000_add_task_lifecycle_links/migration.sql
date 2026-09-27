ALTER TABLE "Task"
  ADD COLUMN "contractId" TEXT,
  ADD COLUMN "rentalCycleId" TEXT,
  ADD COLUMN "customerId" TEXT;

CREATE INDEX "Task_tenantId_contractId_idx" ON "Task"("tenantId", "contractId");
CREATE INDEX "Task_tenantId_rentalCycleId_idx" ON "Task"("tenantId", "rentalCycleId");
CREATE INDEX "Task_tenantId_customerId_idx" ON "Task"("tenantId", "customerId");
