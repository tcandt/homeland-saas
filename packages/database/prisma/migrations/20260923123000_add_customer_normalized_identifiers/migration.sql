ALTER TABLE "Customer"
  ADD COLUMN IF NOT EXISTS "phoneNormalized" TEXT,
  ADD COLUMN IF NOT EXISTS "identityNoNormalized" TEXT;

UPDATE "Customer"
SET
  "phoneNormalized" = NULLIF(regexp_replace("phone", '[^0-9]', '', 'g'), ''),
  "identityNoNormalized" = NULLIF(
    regexp_replace(upper(normalize(COALESCE("identityNo", ''), NFKC)), '[^[:alnum:]]', '', 'g'),
    ''
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Customer"
    WHERE "deletedAt" IS NULL
      AND "phoneNormalized" IS NULL
  ) THEN
    RAISE EXCEPTION
      'Customer normalized identifier migration stopped: active customers with no canonical phone must be corrected before retrying.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "Customer"
    WHERE "deletedAt" IS NULL
      AND "phoneNormalized" IS NOT NULL
    GROUP BY "tenantId", "phoneNormalized"
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Customer normalized identifier migration stopped: active duplicate canonical phone values exist within a tenant. Resolve the listed business records before retrying.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "Customer"
    WHERE "deletedAt" IS NULL
      AND "identityNoNormalized" IS NOT NULL
    GROUP BY "tenantId", "identityNoNormalized"
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Customer normalized identifier migration stopped: active duplicate canonical identity numbers exist within a tenant. Resolve the listed business records before retrying.';
  END IF;
END $$;

UPDATE "Customer"
SET "phoneNormalized" = ''
WHERE "phoneNormalized" IS NULL;

ALTER TABLE "Customer"
  ALTER COLUMN "phoneNormalized" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Customer_tenantId_phoneNormalized_active_key"
  ON "Customer"("tenantId", "phoneNormalized")
  WHERE "deletedAt" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Customer_tenantId_identityNoNormalized_active_key"
  ON "Customer"("tenantId", "identityNoNormalized")
  WHERE "deletedAt" IS NULL
    AND "identityNoNormalized" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "Customer_tenantId_phoneNormalized_lookup_idx"
  ON "Customer"("tenantId", "phoneNormalized");

CREATE INDEX IF NOT EXISTS "Customer_tenantId_identityNoNormalized_lookup_idx"
  ON "Customer"("tenantId", "identityNoNormalized");
