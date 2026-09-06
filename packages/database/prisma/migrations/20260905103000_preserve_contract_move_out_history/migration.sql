ALTER TABLE "Contract"
ADD COLUMN IF NOT EXISTS "actualMoveOutAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "terminationReason" TEXT,
ADD COLUMN IF NOT EXISTS "customerSnapshot" JSONB,
ADD COLUMN IF NOT EXISTS "roomSnapshot" JSONB,
ADD COLUMN IF NOT EXISTS "termsSnapshot" JSONB;

CREATE TABLE "ContractParty" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "customerId" TEXT,
    "role" TEXT NOT NULL,
    "identitySnapshot" JSONB NOT NULL,
    "signedAt" TIMESTAMP(3),
    "leftAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContractParty_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Occupancy" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "contractId" TEXT,
    "role" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "leaveReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Occupancy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContractSettlement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "actualMoveOutAt" TIMESTAMP(3) NOT NULL,
    "roomTurnoverStatus" "RoomStatus" NOT NULL,
    "chargeTotal" DECIMAL(14,2) NOT NULL,
    "creditTotal" DECIMAL(14,2) NOT NULL,
    "netReceivable" DECIMAL(14,2) NOT NULL,
    "refundToCustomer" DECIMAL(14,2) NOT NULL,
    "utilitySnapshot" JSONB,
    "details" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContractSettlement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContractParty_contractId_customerId_role_key"
ON "ContractParty"("contractId", "customerId", "role");
CREATE INDEX "ContractParty_tenantId_contractId_idx"
ON "ContractParty"("tenantId", "contractId");
CREATE INDEX "ContractParty_tenantId_customerId_idx"
ON "ContractParty"("tenantId", "customerId");

CREATE INDEX "Occupancy_tenantId_roomId_leftAt_idx"
ON "Occupancy"("tenantId", "roomId", "leftAt");
CREATE INDEX "Occupancy_tenantId_customerId_leftAt_idx"
ON "Occupancy"("tenantId", "customerId", "leftAt");
CREATE INDEX "Occupancy_tenantId_contractId_leftAt_idx"
ON "Occupancy"("tenantId", "contractId", "leftAt");

CREATE UNIQUE INDEX "ContractSettlement_contractId_key"
ON "ContractSettlement"("contractId");
CREATE INDEX "ContractSettlement_tenantId_actualMoveOutAt_idx"
ON "ContractSettlement"("tenantId", "actualMoveOutAt");

ALTER TABLE "ContractParty"
ADD CONSTRAINT "ContractParty_contractId_fkey"
FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ContractParty"
ADD CONSTRAINT "ContractParty_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Occupancy"
ADD CONSTRAINT "Occupancy_roomId_fkey"
FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Occupancy"
ADD CONSTRAINT "Occupancy_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Occupancy"
ADD CONSTRAINT "Occupancy_contractId_fkey"
FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ContractSettlement"
ADD CONSTRAINT "ContractSettlement_contractId_fkey"
FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

UPDATE "Contract" AS contract
SET
  "customerSnapshot" = COALESCE(
    contract."customerSnapshot",
    jsonb_build_object(
      'id', customer."id",
      'fullName', customer."fullName",
      'phone', customer."phone",
      'email', customer."email",
      'identityNo', customer."identityNo",
      'gender', customer."gender",
      'birthDate', customer."birthDate",
      'nationality', customer."nationality",
      'address', customer."address",
      'emergencyPhone', customer."emergencyPhone",
      'idImages', customer."idImages"
    )
  ),
  "roomSnapshot" = COALESCE(
    contract."roomSnapshot",
    jsonb_build_object(
      'id', room."id",
      'code', room."code",
      'name', room."name",
      'rentalType', room."rentalType",
      'building', jsonb_build_object(
        'id', building."id",
        'code', building."code",
        'name', building."name",
        'address', building."address"
      ),
      'floor', jsonb_build_object(
        'id', floor."id",
        'name', floor."name",
        'level', floor."level"
      )
    )
  ),
  "termsSnapshot" = COALESCE(
    contract."termsSnapshot",
    jsonb_build_object(
      'code', contract."code",
      'status', contract."status",
      'startDate', contract."startDate",
      'endDate', contract."endDate",
      'signedAt', contract."signedAt",
      'firstPaymentDate', contract."firstPaymentDate",
      'monthlyRent', contract."monthlyRent",
      'depositMoney', contract."depositMoney",
      'memberCount', contract."memberCount",
      'purpose', contract."purpose",
      'coRepresentativeIds', contract."coRepresentativeIds",
      'attachments', contract."attachments"
    )
  )
FROM "Customer" AS customer, "Room" AS room
JOIN "Building" AS building ON building."id" = room."buildingId"
JOIN "Floor" AS floor ON floor."id" = room."floorId"
WHERE customer."id" = contract."customerId"
  AND room."id" = contract."roomId";

INSERT INTO "ContractParty" (
  "id", "tenantId", "contractId", "customerId", "role", "identitySnapshot",
  "signedAt", "leftAt", "createdAt", "updatedAt"
)
SELECT
  'cp_' || md5(contract."id" || ':' || customer."id" || ':PRIMARY'),
  contract."tenantId",
  contract."id",
  customer."id",
  'PRIMARY',
  jsonb_build_object(
    'id', customer."id",
    'fullName', customer."fullName",
    'phone', customer."phone",
    'email', customer."email",
    'identityNo', customer."identityNo",
    'gender', customer."gender",
    'birthDate', customer."birthDate",
    'nationality', customer."nationality",
    'address', customer."address",
    'emergencyPhone', customer."emergencyPhone",
    'idImages', customer."idImages"
  ),
  contract."signedAt",
  CASE WHEN contract."status" IN ('TERMINATED', 'EXPIRED', 'CANCELLED')
    THEN COALESCE(contract."actualMoveOutAt", contract."updatedAt")
    ELSE NULL
  END,
  contract."createdAt",
  contract."updatedAt"
FROM "Contract" AS contract
JOIN "Customer" AS customer ON customer."id" = contract."customerId";

INSERT INTO "ContractParty" (
  "id", "tenantId", "contractId", "customerId", "role", "identitySnapshot",
  "signedAt", "leftAt", "createdAt", "updatedAt"
)
SELECT
  'cp_' || md5(contract."id" || ':' || customer."id" || ':CO_REPRESENTATIVE'),
  contract."tenantId",
  contract."id",
  customer."id",
  'CO_REPRESENTATIVE',
  jsonb_build_object(
    'id', customer."id",
    'fullName', customer."fullName",
    'phone', customer."phone",
    'email', customer."email",
    'identityNo', customer."identityNo",
    'gender', customer."gender",
    'birthDate', customer."birthDate",
    'nationality', customer."nationality",
    'address', customer."address",
    'emergencyPhone', customer."emergencyPhone",
    'idImages', customer."idImages"
  ),
  contract."signedAt",
  CASE WHEN contract."status" IN ('TERMINATED', 'EXPIRED', 'CANCELLED')
    THEN COALESCE(contract."actualMoveOutAt", contract."updatedAt")
    ELSE NULL
  END,
  contract."createdAt",
  contract."updatedAt"
FROM "Contract" AS contract
CROSS JOIN LATERAL unnest(contract."coRepresentativeIds") AS co_rep("customerId")
JOIN "Customer" AS customer ON customer."id" = co_rep."customerId";

INSERT INTO "Occupancy" (
  "id", "tenantId", "roomId", "customerId", "contractId", "role",
  "joinedAt", "leftAt", "leaveReason", "createdAt", "updatedAt"
)
SELECT
  'occ_' || md5(contract."id" || ':' || contract."customerId" || ':PRIMARY'),
  contract."tenantId",
  contract."roomId",
  contract."customerId",
  contract."id",
  'PRIMARY',
  contract."startDate",
  CASE WHEN contract."status" IN ('TERMINATED', 'EXPIRED', 'CANCELLED')
    THEN COALESCE(contract."actualMoveOutAt", contract."updatedAt")
    ELSE NULL
  END,
  CASE WHEN contract."status" IN ('TERMINATED', 'EXPIRED', 'CANCELLED')
    THEN COALESCE(contract."terminationReason", 'Hợp đồng đã kết thúc')
    ELSE NULL
  END,
  contract."createdAt",
  contract."updatedAt"
FROM "Contract" AS contract
WHERE contract."status" IN ('ACTIVE', 'EXPIRING', 'TERMINATED', 'EXPIRED', 'CANCELLED');

INSERT INTO "Occupancy" (
  "id", "tenantId", "roomId", "customerId", "contractId", "role",
  "joinedAt", "leftAt", "leaveReason", "createdAt", "updatedAt"
)
SELECT
  'occ_' || md5(contract."id" || ':' || co_rep."customerId" || ':CO_REPRESENTATIVE'),
  contract."tenantId",
  contract."roomId",
  co_rep."customerId",
  contract."id",
  'CO_REPRESENTATIVE',
  contract."startDate",
  CASE WHEN contract."status" IN ('TERMINATED', 'EXPIRED', 'CANCELLED')
    THEN COALESCE(contract."actualMoveOutAt", contract."updatedAt")
    ELSE NULL
  END,
  CASE WHEN contract."status" IN ('TERMINATED', 'EXPIRED', 'CANCELLED')
    THEN COALESCE(contract."terminationReason", 'Hợp đồng đã kết thúc')
    ELSE NULL
  END,
  contract."createdAt",
  contract."updatedAt"
FROM "Contract" AS contract
CROSS JOIN LATERAL unnest(contract."coRepresentativeIds") AS co_rep("customerId")
JOIN "Customer" AS customer ON customer."id" = co_rep."customerId"
WHERE contract."status" IN ('ACTIVE', 'EXPIRING', 'TERMINATED', 'EXPIRED', 'CANCELLED');

INSERT INTO "Occupancy" (
  "id", "tenantId", "roomId", "customerId", "contractId", "role",
  "joinedAt", "leftAt", "leaveReason", "createdAt", "updatedAt"
)
SELECT
  'occ_' || md5(customer."id" || ':' || customer."roomId" || ':ROOMMATE'),
  customer."tenantId",
  customer."roomId",
  customer."id",
  NULL,
  'ROOMMATE',
  customer."createdAt",
  NULL,
  NULL,
  customer."createdAt",
  customer."updatedAt"
FROM "Customer" AS customer
WHERE customer."roomId" IS NOT NULL
  AND customer."deletedAt" IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "Occupancy" AS occupancy
    WHERE occupancy."roomId" = customer."roomId"
      AND occupancy."customerId" = customer."id"
      AND occupancy."leftAt" IS NULL
  );

INSERT INTO "Permission" ("id", "key", "description")
VALUES
  ('perm_' || md5('contract.submit'), 'contract.submit', 'Submit contracts for approval'),
  ('perm_' || md5('contract.approve'), 'contract.approve', 'Approve contracts'),
  ('perm_' || md5('contract.activate'), 'contract.activate', 'Activate approved contracts'),
  ('perm_' || md5('contract.terminate'), 'contract.terminate', 'Move occupants out and terminate contracts')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT DISTINCT existing_grant."roleId", new_permission."id"
FROM "RolePermission" AS existing_grant
JOIN "Permission" AS update_permission
  ON update_permission."id" = existing_grant."permissionId"
CROSS JOIN "Permission" AS new_permission
WHERE update_permission."key" = 'contract.update'
  AND new_permission."key" IN (
    'contract.submit',
    'contract.approve',
    'contract.activate',
    'contract.terminate'
  )
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
