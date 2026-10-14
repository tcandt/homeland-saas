import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('retired Sales CRM boundary', () => {
  it('removes the API module and Web route, components, clients and helpers', () => {
    for (const file of [
      'apps/api/src/sales/sales.module.ts',
      'apps/web/app/sales/page.tsx',
      'apps/web/components/sales/CreateSalesLeadModal.tsx',
      'apps/web/lib/api/sales.api.ts',
      'apps/web/lib/queries/sales.queries.ts',
      'apps/web/lib/sales/lead-list-filters.ts',
    ]) expect(existsSync(resolve(root, file)), file).toBe(false);
    expect(read('apps/api/src/app.module.ts')).not.toMatch(/SalesModule|\.\/sales\//);
    for (const file of [
      'apps/web/components/layout/Header.tsx',
      'apps/web/components/layout/FloatingActionButton.tsx',
      'apps/web/components/layout/Sidebar.tsx',
    ]) expect(read(file), file).not.toMatch(/["']\/sales(?:["'?/]|$)/);
  });

  it('stops provisioning CRM leads, permissions, and the retired SALES role', () => {
    const seed = read('packages/database/prisma/seed.ts');
    const permissions = read('packages/database/update-manager-permissions.ts');
    expect(seed).not.toMatch(/salesLead|LeadStatus|["']sales\./);
    expect(permissions).not.toMatch(/["']sales\./);
    expect(seed).not.toContain('RoleCode.SALES');
    expect(seed).not.toMatch(/salesPerms|SALES/);
  });

  it('removes retired role and CRM model from the active runtime schema', () => {
    const schema = read('packages/database/prisma/schema.prisma');
    expect(schema).not.toMatch(/model SalesLead\s*\{/);
    expect(schema).not.toMatch(/enum LeadStatus\s*\{/);
    expect(schema).not.toMatch(/\bSALES\b/);
    expect(read('apps/api/src/prisma.service.ts')).not.toContain("'SalesLead'");
  });

  it('rejects the retired role in team DTOs', () => {
    const dto = read('packages/shared/src/auth/auth.dto.ts');
    expect(dto).not.toMatch(/z\.enum\(\[[^\]]*SALES/);
  });

  it('ships a forward-only cleanup migration without rewriting historical migrations', () => {
    const migration = read('packages/database/prisma/migrations/20261014130000_retire_sales_role_and_leads/migration.sql');
    expect(migration).toContain('DROP TABLE IF EXISTS "SalesLead"');
    expect(migration).toContain('DROP TYPE IF EXISTS "LeadStatus"');
    expect(migration).toContain('CREATE TYPE "RoleCode" AS ENUM (\'ADMIN\', \'MANAGER\', \'FINANCE\')');
    expect(migration).toContain('DELETE FROM "Permission"');
  });
});
