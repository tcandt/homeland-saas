import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { AuditAction, LeadStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { SalesStageService } from './sales-stage.service';

const key = '70c7e0e1-4ef4-4f54-b060-5a8f8d9a7c1c';
const lead = {
  id: 'lead-1',
  tenantId: 'tenant-a',
  status: LeadStatus.NEW,
  deletedAt: null,
};

function createPrisma({ currentLead = lead, audit = null }: { currentLead?: any; audit?: any } = {}) {
  const tx: any = {
    auditLog: {
      findUnique: vi.fn().mockResolvedValue(audit),
      create: vi.fn().mockResolvedValue({}),
    },
    salesLead: {
      findFirst: vi.fn().mockResolvedValue(currentLead),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
  return {
    tx,
    prisma: {
      $transaction: vi.fn((callback: any) => callback(tx)),
      auditLog: tx.auditLog,
      salesLead: tx.salesLead,
    } as any,
  };
}

describe('SalesStageService', () => {
  it('does not update a lead outside the current tenant', async () => {
    const { prisma, tx } = createPrisma({ currentLead: null });

    await expect(new SalesStageService(prisma).updateStage(
      'tenant-a', 'user-a', 'lead-in-tenant-b', { status: 'CONTACTED' }, key,
    )).rejects.toBeInstanceOf(NotFoundException);

    expect(tx.salesLead.findFirst).toHaveBeenCalledWith({
      where: { id: 'lead-in-tenant-b', tenantId: 'tenant-a', deletedAt: null },
    });
    expect(tx.salesLead.updateMany).not.toHaveBeenCalled();
  });

  it('rejects skipped and terminal stage transitions', async () => {
    const { prisma } = createPrisma();
    const service = new SalesStageService(prisma);

    await expect(service.updateStage('tenant-a', 'user-a', 'lead-1', { status: 'QUALIFIED' }, key))
      .rejects.toBeInstanceOf(BadRequestException);

    const { prisma: terminalPrisma } = createPrisma({
      currentLead: { ...lead, status: LeadStatus.WON },
    });
    await expect(new SalesStageService(terminalPrisma).updateStage(
      'tenant-a', 'user-a', 'lead-1', { status: 'LOST' }, '14a88c22-ae1e-4b9f-8097-9c7ec0044cf7',
    )).rejects.toBeInstanceOf(BadRequestException);
  });

  it('replays an identical command and rejects a reused key with a different stage', async () => {
    const replayAudit = {
      tenantId: 'tenant-a',
      module: 'Sales',
      entity: 'SalesLead',
      entityId: 'lead-1',
      action: AuditAction.UPDATE,
      after: { idempotencyKey: key, status: LeadStatus.CONTACTED },
    };
    const { prisma, tx } = createPrisma({
      currentLead: { ...lead, status: LeadStatus.CONTACTED },
      audit: replayAudit,
    });
    const service = new SalesStageService(prisma);

    await expect(service.updateStage('tenant-a', 'user-a', 'lead-1', { status: 'CONTACTED' }, key))
      .resolves.toMatchObject({ status: LeadStatus.CONTACTED });
    await expect(service.updateStage('tenant-a', 'user-a', 'lead-1', { status: 'QUALIFIED' }, key))
      .rejects.toBeInstanceOf(ConflictException);
    expect(tx.salesLead.updateMany).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('writes an UPDATE audit in the same transaction as a permitted stage change', async () => {
    const { prisma, tx } = createPrisma({
      currentLead: { ...lead, status: LeadStatus.NEW },
    });

    await expect(new SalesStageService(prisma).updateStage(
      'tenant-a', 'user-a', 'lead-1', { status: 'CONTACTED' }, key,
    )).resolves.toMatchObject({ id: 'lead-1' });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.salesLead.updateMany).toHaveBeenCalledWith({
      where: { id: 'lead-1', tenantId: 'tenant-a', deletedAt: null, status: LeadStatus.NEW },
      data: { status: LeadStatus.CONTACTED },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        tenantId: 'tenant-a',
        userId: 'user-a',
        action: AuditAction.UPDATE,
        before: { status: LeadStatus.NEW },
        after: { idempotencyKey: key, status: LeadStatus.CONTACTED },
      }),
    }));
  });
});
