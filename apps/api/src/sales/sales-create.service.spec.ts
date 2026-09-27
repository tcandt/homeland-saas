import { BadRequestException, ConflictException } from '@nestjs/common';
import { AuditAction, LeadStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { SalesCreateService } from './sales-create.service';

const key = '70c7e0e1-4ef4-4f54-b060-5a8f8d9a7c1c';
const payload = {
  name: '  Nguyen   Van   A ',
  phone: '0901 234-567',
  email: ' TEST@EXAMPLE.COM ',
  notes: '  Gọi lại   sau 18h ',
};

function createPrisma(existing: any = null) {
  const tx: any = {
    salesLead: {
      findFirst: vi.fn().mockResolvedValue(existing),
      create: vi.fn().mockImplementation(async ({ data }: any) => ({
        ...data,
        status: LeadStatus.NEW,
      })),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  };
  return {
    tx,
    prisma: {
      $transaction: vi.fn(async (callback: any) => callback(tx)),
      salesLead: { findFirst: vi.fn().mockResolvedValue(existing) },
    } as any,
  };
}

describe('SalesCreateService', () => {
  it('normalizes input, creates a deterministic lead, and writes a CREATE audit', async () => {
    const { prisma, tx } = createPrisma();
    const service = new SalesCreateService(prisma);

    const result = await service.createLead('tenant-a', 'user-a', payload, key);

    expect(result).toMatchObject({
      name: 'Nguyen Van A',
      phone: '0901234567',
      email: 'test@example.com',
      notes: 'Gọi lại sau 18h',
      status: LeadStatus.NEW,
    });
    expect(tx.salesLead.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ tenantId: 'tenant-a' }),
    }));
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        tenantId: 'tenant-a',
        userId: 'user-a',
        action: AuditAction.CREATE,
        entity: 'SalesLead',
      }),
    }));
  });

  it('replays the same normalized command without another create or audit', async () => {
    const { prisma, tx } = createPrisma({
      id: 'lead-1',
      name: 'Nguyen Van A',
      phone: '0901234567',
      email: 'test@example.com',
      notes: 'Gọi lại sau 18h',
      status: LeadStatus.NEW,
    });
    const service = new SalesCreateService(prisma);

    await expect(service.createLead('tenant-a', 'user-a', payload, key)).resolves.toMatchObject({ id: 'lead-1' });
    expect(tx.salesLead.create).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('rejects an idempotency replay with a different normalized payload', async () => {
    const { prisma } = createPrisma({
      id: 'lead-1', name: 'Nguyen Van A', phone: '0901234567', email: null, notes: null,
    });
    const service = new SalesCreateService(prisma);

    await expect(service.createLead('tenant-a', 'user-a', { ...payload, notes: 'Khác' }, key))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('requires a UUID idempotency key and valid customer fields', async () => {
    const { prisma } = createPrisma();
    const service = new SalesCreateService(prisma);

    await expect(service.createLead('tenant-a', 'user-a', payload, 'not-a-uuid'))
      .rejects.toBeInstanceOf(BadRequestException);
    await expect(service.createLead('tenant-a', 'user-a', { ...payload, phone: '12' }, key))
      .rejects.toBeInstanceOf(BadRequestException);
  });
});
