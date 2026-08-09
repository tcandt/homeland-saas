-- CreateTable
CREATE TABLE "HunonicMeterMapping" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "buildingId" TEXT,
    "roomId" TEXT,
    "buildingCode" TEXT NOT NULL,
    "roomCode" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'hunonic',
    "providerMeterId" TEXT NOT NULL,
    "providerDeviceId" TEXT,
    "providerRootId" TEXT,
    "providerHomeId" TEXT,
    "providerRoomId" TEXT,
    "homeName" TEXT,
    "roomName" TEXT,
    "deviceName" TEXT NOT NULL,
    "rootType" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastStatus" TEXT,
    "lastReadingKwh" DECIMAL(14,3),
    "lastAmountVnd" DECIMAL(14,0),
    "lastSyncedAt" TIMESTAMP(3),
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HunonicMeterMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HunonicMeterReading" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "meterMappingId" TEXT NOT NULL,
    "roomId" TEXT,
    "readingAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT,
    "powerCurrentW" DECIMAL(14,3),
    "energyMonthKwh" DECIMAL(14,3),
    "moneyMonthVnd" DECIMAL(14,0),
    "energyPrevMonthKwh" DECIMAL(14,3),
    "moneyPrevMonthVnd" DECIMAL(14,0),
    "currentMonth" TEXT,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HunonicMeterReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HunonicSyncLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "source" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "metersFound" INTEGER NOT NULL DEFAULT 0,
    "readingsSaved" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HunonicSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HunonicMeterMapping_tenantId_providerMeterId_key" ON "HunonicMeterMapping"("tenantId", "providerMeterId");

-- CreateIndex
CREATE INDEX "HunonicMeterMapping_tenantId_buildingCode_roomCode_idx" ON "HunonicMeterMapping"("tenantId", "buildingCode", "roomCode");

-- CreateIndex
CREATE INDEX "HunonicMeterMapping_tenantId_buildingId_idx" ON "HunonicMeterMapping"("tenantId", "buildingId");

-- CreateIndex
CREATE INDEX "HunonicMeterMapping_tenantId_roomId_idx" ON "HunonicMeterMapping"("tenantId", "roomId");

-- CreateIndex
CREATE UNIQUE INDEX "HunonicMeterReading_tenantId_meterMappingId_readingAt_key" ON "HunonicMeterReading"("tenantId", "meterMappingId", "readingAt");

-- CreateIndex
CREATE INDEX "HunonicMeterReading_tenantId_roomId_readingAt_idx" ON "HunonicMeterReading"("tenantId", "roomId", "readingAt");

-- CreateIndex
CREATE INDEX "HunonicMeterReading_tenantId_readingAt_idx" ON "HunonicMeterReading"("tenantId", "readingAt");

-- CreateIndex
CREATE INDEX "HunonicSyncLog_tenantId_startedAt_idx" ON "HunonicSyncLog"("tenantId", "startedAt");

-- CreateIndex
CREATE INDEX "HunonicSyncLog_tenantId_status_idx" ON "HunonicSyncLog"("tenantId", "status");

-- AddForeignKey
ALTER TABLE "HunonicMeterMapping" ADD CONSTRAINT "HunonicMeterMapping_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HunonicMeterMapping" ADD CONSTRAINT "HunonicMeterMapping_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HunonicMeterReading" ADD CONSTRAINT "HunonicMeterReading_meterMappingId_fkey" FOREIGN KEY ("meterMappingId") REFERENCES "HunonicMeterMapping"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HunonicMeterReading" ADD CONSTRAINT "HunonicMeterReading_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;
