import { describe, expect, it } from 'vitest';
import { applyTenantScope } from './prisma.service';

describe('applyTenantScope', () => {
  it('scopes throwing detail reads to the current tenant', () => {
    const args = applyTenantScope(
      'Invoice',
      'findUniqueOrThrow',
      { where: { id: 'invoice-1' } },
      'tenant-1',
    );

    expect(args.where).toEqual({ id: 'invoice-1', tenantId: 'tenant-1' });
  });

  it('overrides a caller supplied tenant on reads', () => {
    const args = applyTenantScope(
      'Invoice',
      'findFirst',
      { where: { tenantId: 'tenant-2', id: 'invoice-1' } },
      'tenant-1',
    );

    expect(args.where).toEqual({ id: 'invoice-1', tenantId: 'tenant-1' });
  });

  it('scopes both sides of an upsert', () => {
    const args = applyTenantScope(
      'PaymentRequest',
      'upsert',
      {
        where: { id: 'request-1' },
        create: { id: 'request-1' },
        update: { status: 'PENDING' },
      },
      'tenant-1',
    );

    expect(args.where).toEqual({ id: 'request-1', tenantId: 'tenant-1' });
    expect(args.create).toEqual({ id: 'request-1', tenantId: 'tenant-1' });
    expect(args.update).toEqual({ status: 'PENDING' });
  });

  it('does not modify global models', () => {
    const original = { where: { id: 'global-1' } };

    expect(applyTenantScope('GlobalModel', 'findUniqueOrThrow', original, 'tenant-1')).toBe(original);
    expect(original.where).toEqual({ id: 'global-1' });
  });
});
