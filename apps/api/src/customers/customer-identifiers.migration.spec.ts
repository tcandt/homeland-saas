import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  __dirname,
  '../../../../packages/database/prisma/migrations/20260923123000_add_customer_normalized_identifiers/migration.sql',
);

describe('customer normalized identifiers migration', () => {
  it('backfills the runtime-compatible canonical values and enforces active tenant-scoped uniqueness', () => {
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('regexp_replace("phone", \'[^0-9]\', \'\', \'g\')');
    expect(sql).toContain("normalize(COALESCE(\"identityNo\", ''), NFKC)");
    expect(sql).toContain("regexp_replace(upper(normalize(COALESCE(\"identityNo\", ''), NFKC)), '[^[:alnum:]]', '', 'g')");
    expect(sql).toContain('"Customer"("tenantId", "phoneNormalized")\n  WHERE "deletedAt" IS NULL');
    expect(sql).toContain('"Customer"("tenantId", "identityNoNormalized")\n  WHERE "deletedAt" IS NULL');
    expect(sql).toContain('HAVING count(*) > 1');
  });

  it('is retry-safe after its indexes have been created', () => {
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "phoneNormalized" TEXT');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "identityNoNormalized" TEXT');
    expect(sql.match(/CREATE(?: UNIQUE)? INDEX IF NOT EXISTS/g)).toHaveLength(4);
  });
});
