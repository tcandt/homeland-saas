-- Recover contracts hidden by the legacy "remove occupant" flow.
-- A history-free DRAFT remains deleted; every other contract, or a DRAFT with
-- financial records, is restored as a terminal record instead of disappearing.
UPDATE "Contract" AS contract
SET
  "status" = CASE
    WHEN contract."status" IN ('ACTIVE', 'EXPIRING') THEN 'TERMINATED'::"ContractStatus"
    WHEN contract."status" IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED') THEN 'CANCELLED'::"ContractStatus"
    ELSE contract."status"
  END,
  "actualMoveOutAt" = COALESCE(contract."actualMoveOutAt", contract."deletedAt", contract."updatedAt"),
  "terminationReason" = COALESCE(
    contract."terminationReason",
    'Khôi phục từ luồng xóa khách cũ; hợp đồng được bảo toàn trong lịch sử'
  ),
  "deletedAt" = NULL,
  "deletedBy" = NULL,
  "deleteReason" = NULL
WHERE contract."deletedAt" IS NOT NULL
  AND (
    contract."status" <> 'DRAFT'
    OR EXISTS (
      SELECT 1
      FROM "Invoice" AS invoice
      WHERE invoice."contractId" = contract."id"
    )
    OR EXISTS (
      SELECT 1
      FROM "Deposit" AS deposit
      WHERE deposit."contractId" = contract."id"
    )
  );

-- Restore customers that now belong to preserved contracts, or that have direct
-- invoice/deposit history. Customers removed by the old 30-day cleanup with no
-- legal or financial history remain archived as before.
UPDATE "Customer" AS customer
SET
  "roomId" = CASE
    WHEN EXISTS (
      SELECT 1
      FROM "Contract" AS current_contract
      WHERE current_contract."deletedAt" IS NULL
        AND current_contract."status" IN ('ACTIVE', 'EXPIRING')
        AND (
          current_contract."customerId" = customer."id"
          OR customer."id" = ANY(current_contract."coRepresentativeIds")
        )
    ) THEN customer."roomId"
    ELSE NULL
  END,
  "deletedAt" = NULL,
  "deletedBy" = NULL,
  "deleteReason" = NULL
WHERE customer."deletedAt" IS NOT NULL
  AND (
    EXISTS (
      SELECT 1
      FROM "Contract" AS preserved_contract
      WHERE preserved_contract."deletedAt" IS NULL
        AND (
          preserved_contract."customerId" = customer."id"
          OR customer."id" = ANY(preserved_contract."coRepresentativeIds")
        )
    )
    OR EXISTS (
      SELECT 1
      FROM "Invoice" AS invoice
      WHERE invoice."customerId" = customer."id"
    )
    OR EXISTS (
      SELECT 1
      FROM "Deposit" AS deposit
      WHERE deposit."customerId" = customer."id"
    )
  );

-- The first migration backfills before legacy records are restored. Create the
-- legal party and occupancy snapshots for records recovered above.
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
  contract."actualMoveOutAt",
  contract."createdAt",
  contract."updatedAt"
FROM "Contract" AS contract
JOIN "Customer" AS customer ON customer."id" = contract."customerId"
WHERE contract."terminationReason" = 'Khôi phục từ luồng xóa khách cũ; hợp đồng được bảo toàn trong lịch sử'
ON CONFLICT ("contractId", "customerId", "role") DO UPDATE
SET
  "identitySnapshot" = EXCLUDED."identitySnapshot",
  "leftAt" = EXCLUDED."leftAt",
  "updatedAt" = EXCLUDED."updatedAt";

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
  contract."actualMoveOutAt",
  contract."createdAt",
  contract."updatedAt"
FROM "Contract" AS contract
CROSS JOIN LATERAL unnest(contract."coRepresentativeIds") AS co_rep("customerId")
JOIN "Customer" AS customer ON customer."id" = co_rep."customerId"
WHERE contract."terminationReason" = 'Khôi phục từ luồng xóa khách cũ; hợp đồng được bảo toàn trong lịch sử'
ON CONFLICT ("contractId", "customerId", "role") DO UPDATE
SET
  "identitySnapshot" = EXCLUDED."identitySnapshot",
  "leftAt" = EXCLUDED."leftAt",
  "updatedAt" = EXCLUDED."updatedAt";

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
  contract."actualMoveOutAt",
  contract."terminationReason",
  contract."createdAt",
  contract."updatedAt"
FROM "Contract" AS contract
WHERE contract."terminationReason" = 'Khôi phục từ luồng xóa khách cũ; hợp đồng được bảo toàn trong lịch sử'
ON CONFLICT ("id") DO NOTHING;

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
  contract."actualMoveOutAt",
  contract."terminationReason",
  contract."createdAt",
  contract."updatedAt"
FROM "Contract" AS contract
CROSS JOIN LATERAL unnest(contract."coRepresentativeIds") AS co_rep("customerId")
JOIN "Customer" AS customer ON customer."id" = co_rep."customerId"
WHERE contract."terminationReason" = 'Khôi phục từ luồng xóa khách cũ; hợp đồng được bảo toàn trong lịch sử'
ON CONFLICT ("id") DO NOTHING;

UPDATE "Contract" AS contract
SET
  "customerSnapshot" = COALESCE(
    contract."customerSnapshot",
    party."identitySnapshot"
  ),
  "roomSnapshot" = COALESCE(
    contract."roomSnapshot",
    jsonb_build_object(
      'id', room."id",
      'code', room."code",
      'name', room."name",
      'rentalType', room."rentalType",
      'building', jsonb_build_object('id', building."id", 'code', building."code", 'name', building."name"),
      'floor', jsonb_build_object('id', floor."id", 'name', floor."name", 'level', floor."level")
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
FROM "ContractParty" AS party, "Room" AS room
JOIN "Building" AS building ON building."id" = room."buildingId"
JOIN "Floor" AS floor ON floor."id" = room."floorId"
WHERE party."contractId" = contract."id"
  AND party."role" = 'PRIMARY'
  AND room."id" = contract."roomId"
  AND contract."terminationReason" = 'Khôi phục từ luồng xóa khách cũ; hợp đồng được bảo toàn trong lịch sử';
