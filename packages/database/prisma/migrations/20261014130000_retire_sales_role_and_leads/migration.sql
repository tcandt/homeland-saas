-- Retire the unused Sales role and CRM lead storage.
-- This forward migration is intentionally additive to the immutable history:
-- historical migrations remain unchanged for checksum/recovery verification.

BEGIN;

-- Remove role assignments first so the role and its permissions can be dropped.
DELETE FROM "RolePermission"
WHERE "roleId" IN (SELECT "id" FROM "Role" WHERE "code"::text = 'SALES')
   OR "permissionId" IN (SELECT "id" FROM "Permission" WHERE "key" LIKE 'sales.%');

DELETE FROM "UserRole"
WHERE "roleId" IN (SELECT "id" FROM "Role" WHERE "code"::text = 'SALES');

DELETE FROM "Role"
WHERE "code"::text = 'SALES';

DELETE FROM "Permission"
WHERE "key" LIKE 'sales.%';

-- CRM data is no longer part of the application domain.
DROP TABLE IF EXISTS "SalesLead";
DROP TYPE IF EXISTS "LeadStatus";

-- PostgreSQL enum values cannot be removed in place. Rebuild RoleCode after
-- all SALES rows are gone; this preserves ADMIN/MANAGER/FINANCE values.
ALTER TYPE "RoleCode" RENAME TO "RoleCode_retired_sales";
CREATE TYPE "RoleCode" AS ENUM ('ADMIN', 'MANAGER', 'FINANCE');
ALTER TABLE "Role"
  ALTER COLUMN "code" TYPE "RoleCode"
  USING "code"::text::"RoleCode";
DROP TYPE "RoleCode_retired_sales";

COMMIT;
