-- Room-level receiving account routing with historical validity windows.

CREATE TABLE "RoomPaymentAccountRoute" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "bankAccountId" TEXT NOT NULL,
  "validFrom" TIMESTAMP(3) NOT NULL,
  "validTo" TIMESTAMP(3),
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RoomPaymentAccountRoute_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RoomPaymentAccountRoute_tenantId_roomId_validFrom_key"
ON "RoomPaymentAccountRoute"("tenantId", "roomId", "validFrom");

CREATE INDEX "RoomPaymentAccountRoute_tenantId_roomId_validFrom_idx"
ON "RoomPaymentAccountRoute"("tenantId", "roomId", "validFrom");

CREATE INDEX "RoomPaymentAccountRoute_tenantId_bankAccountId_validFrom_idx"
ON "RoomPaymentAccountRoute"("tenantId", "bankAccountId", "validFrom");

CREATE INDEX "RoomPaymentAccountRoute_tenantId_validFrom_validTo_idx"
ON "RoomPaymentAccountRoute"("tenantId", "validFrom", "validTo");

ALTER TABLE "RoomPaymentAccountRoute"
ADD CONSTRAINT "RoomPaymentAccountRoute_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "TenantOrg"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RoomPaymentAccountRoute"
ADD CONSTRAINT "RoomPaymentAccountRoute_roomId_fkey"
FOREIGN KEY ("roomId") REFERENCES "Room"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RoomPaymentAccountRoute"
ADD CONSTRAINT "RoomPaymentAccountRoute_bankAccountId_fkey"
FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
