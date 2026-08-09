import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { FinanceReportingService } from './finance-reporting.service';

describe('FinanceReportingService', () => {
  function createService(prismaOverrides: Record<string, any> = {}) {
    const prisma = {
      expense: {
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      journalEntry: {
        findFirst: vi.fn(),
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
