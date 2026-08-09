import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { FinanceReportingService } from './finance-reporting.service';

describe('FinanceReportingService', () => {
  function createService(prismaOverrides: Record<string, any> = {}) {
    const prisma = {
      expense: {
        findFirst: vi.fn(),
        create: vi.fn(),
        count: vi.fn().mockResolvedValue(0),
        update: vi.fn(),
      },
      journalEntry: {
        findFirst: vi.fn(),
      },
      building: {
        findFirst: vi.fn(),
      },
      costCenter: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
      ...prismaOverrides,
    };

    return {
      prisma,
      service: new FinanceReportingService(prisma as any),
    };
  }

  it('creates an expense with owner and audit metadata', async () => {
    const currentYear = new Date().getFullYear();
    const createdExpense = {
      id: 'expense-1',
      tenantId: 'tenant-1',
      ownerId: 'owner-1',
      amount: 250000,
      status: 'PENDING',
      attachmentUrls: ['https://example.test/proof.jpg'],
    };
    const { service, prisma } = createService({
      expense: {
        findFirst: vi.fn(),
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue(createdExpense),
        update: vi.fn(),
      },
      building: {
        findFirst: vi.fn().mockResolvedValue({ id: 'building-1', tenantId: 'tenant-1', ownerId: 'owner-1', code: 'LK01-31' }),
      },
      costCenter: {
        findFirst: vi.fn().mockResolvedValue({ id: 'cost-center-1', ownerId: 'owner-1', buildingId: 'building-1' }),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    });

    await expect(
      service.createExpense('tenant-1', 'user-1', {
        ownerId: 'owner-1',
        buildingId: 'building-1',
        category: 'SUPPLIES',
        amount: 250000,
        description: 'Buy tools',
        attachmentUrls: ['https://example.test/proof.jpg'],
      }),
    ).resolves.toMatchObject(createdExpense);

    expect(prisma.expense.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        code: `EXP-${currentYear}-0001`,
        costCenterId: 'cost-center-1',
        ownerId: 'owner-1',
        buildingId: 'building-1',
        category: 'SUPPLIES',
        amount: 250000,
        status: 'PENDING',
        attachmentUrls: ['https://example.test/proof.jpg'],
      }),
    }));
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: 'CREATE',
        entity: 'Expense',
        entityId: 'expense-1',
      }),
    }));
  });

  it('approves a pending expense without posting a payment journal', async () => {
    const pendingExpense = {
      id: 'expense-1',
      tenantId: 'tenant-1',
      ownerId: 'owner-1',
      amount: 250000,
      status: 'PENDING',
      deletedAt: null,
      approvedAt: null,
    };
    const approvedExpense = {
      ...pendingExpense,
      status: 'APPROVED',
      approvedBy: 'user-1',
      approvedAt: new Date('2026-08-09T00:00:00.000Z'),
    };
    const { service, prisma } = createService({
      expense: {
        findFirst: vi.fn().mockResolvedValue(pendingExpense),
        create: vi.fn(),
        update: vi.fn().mockResolvedValue(approvedExpense),
      },
    });

    await expect(service.approveExpense('tenant-1', 'user-1', 'expense-1', false)).resolves.toMatchObject({
      status: 'APPROVED',
      approvedBy: 'user-1',
    });

    expect(prisma.expense.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'expense-1' },
      data: expect.objectContaining({
        status: 'APPROVED',
        approvedBy: 'user-1',
        approvedAt: expect.any(Date),
      }),
    }));
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: 'UPDATE',
        entityId: 'expense-1',
      }),
    }));
  });

  it('locks expense amount after a posted journal exists', async () => {
    const { service, prisma } = createService({
      expense: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'expense-1',
          tenantId: 'tenant-1',
          ownerId: 'owner-1',
          amount: 100000,
          status: 'PAID',
          deletedAt: null,
          attachmentUrls: [],
          date: new Date('2026-08-01T00:00:00.000Z'),
        }),
        update: vi.fn(),
      },
      journalEntry: {
        findFirst: vi.fn().mockResolvedValue({ id: 'journal-1', status: 'POSTED' }),
      },
    });

    await expect(
      service.updateExpense('tenant-1', 'user-1', 'expense-1', { amount: 120000 }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.expense.update).not.toHaveBeenCalled();
  });

  it('allows non-amount expense edits after posting when amount is unchanged', async () => {
    const existingExpense = {
      id: 'expense-1',
      tenantId: 'tenant-1',
      ownerId: 'owner-1',
      buildingId: 'building-1',
      roomId: null,
      paidByOwnerId: null,
      paidByName: null,
      category: 'OTHER',
      vendor: null,
      amount: 100000,
      status: 'PAID',
      deletedAt: null,
      description: 'Old note',
      attachmentUrls: [],
      date: new Date('2026-08-01T00:00:00.000Z'),
    };
    const updatedExpense = { ...existingExpense, description: 'Updated note' };
    const { service, prisma } = createService({
      expense: {
        findFirst: vi.fn().mockResolvedValue(existingExpense),
        update: vi.fn().mockResolvedValue(updatedExpense),
      },
      journalEntry: {
        findFirst: vi.fn().mockResolvedValue({ id: 'journal-1', status: 'POSTED' }),
      },
    });

    await expect(
      service.updateExpense('tenant-1', 'user-1', 'expense-1', {
        amount: 100000,
        description: 'Updated note',
      }),
    ).resolves.toMatchObject({ description: 'Updated note' });

    expect(prisma.expense.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'expense-1' },
      data: expect.objectContaining({
        amount: 100000,
        description: 'Updated note',
      }),
    }));
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: 'UPDATE',
        entity: 'Expense',
        entityId: 'expense-1',
      }),
    }));
  });
});
