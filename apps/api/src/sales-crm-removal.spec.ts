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

  it('stops provisioning CRM leads and permissions without removing the SALES role', () => {
    const seed = read('packages/database/prisma/seed.ts');
    const permissions = read('packages/database/update-manager-permissions.ts');
    expect(seed).not.toMatch(/salesLead|LeadStatus|["']sales\./);
    expect(permissions).not.toMatch(/["']sales\./);
    expect(seed).toContain('RoleCode.SALES');
    const salesPermissions = seed.match(/const salesPerms = createdPermissions\.filter\(p =>([\s\S]*?)\n  \);/)?.[1];
    expect(salesPermissions).toBeDefined();
    for (const permission of ['room.', 'customer.', 'contract.', 'deposit.', 'invoice.read', 'task.']) {
      expect(salesPermissions).toContain(`p.key.startsWith('${permission}')`);
    }
    expect(salesPermissions).not.toContain('finance.');
  });

  it('keeps the legacy table compatible with backup and rollback without dropping data', () => {
    expect(read('packages/database/prisma/schema.prisma')).toContain('model SalesLead {');
    expect(read('apps/api/src/prisma.service.ts')).toContain("'SalesLead'");
  });
});
