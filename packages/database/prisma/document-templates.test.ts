import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { seedDocumentTemplates } from './document-templates';

describe('Required document seed', () => {
  it('adds missing tenant templates/folders and preserves customized data on replay', async () => {
    const templates = new Map<string, any>([['tenant-a:CONTRACT_TEMPLATE', { content: 'CUSTOM', name: 'Custom contract' }]]);
    const folders: Array<{ tenantId: string; name: string }> = [{ tenantId: 'tenant-a', name: 'Contracts' }];
    const db = {
      documentTemplate: { upsert: async ({ where, update, create }: any) => {
        expect(update).toEqual({});
        const key = `${where.tenantId_code.tenantId}:${where.tenantId_code.code}`;
        if (!templates.has(key)) templates.set(key, create);
      } },
      documentFolder: {
        findFirst: async ({ where }: any) => folders.find((f) => f.tenantId === where.tenantId && f.name === where.name),
        create: async ({ data }: any) => { folders.push(data); },
      },
    } as unknown as PrismaClient;
    await seedDocumentTemplates(db, 'tenant-a');
    await seedDocumentTemplates(db, 'tenant-a');
    expect(templates.size).toBe(5);
    expect(folders).toHaveLength(5);
    expect(templates.get('tenant-a:CONTRACT_TEMPLATE')).toEqual({ content: 'CUSTOM', name: 'Custom contract' });
    await seedDocumentTemplates(db, 'tenant-b');
    expect(templates.size).toBe(10);
    expect(folders.filter((f) => f.tenantId === 'tenant-b')).toHaveLength(5);
  });
  it('provisions templates before production or existing-contract early exits', () => {
    const source = readFileSync(new URL('./seed.ts', import.meta.url), 'utf8');
    const call = source.indexOf('await seedDocumentTemplates(prisma, org.id)');
    expect(call).toBeGreaterThan(0);
    expect(call).toBeLessThan(source.indexOf('if (productionMode)'));
    expect(call).toBeLessThan(source.indexOf('if (existingContracts > 0)'));
    expect(source.match(/await seedDocumentTemplates\(prisma, org.id\)/g)).toHaveLength(1);
  });
});
