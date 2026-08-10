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
      invoice: {
        findMany: vi.fn(),
        count: vi.fn(),
      },
      invoiceItem: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      building: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
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

  it('summarizes open invoice debt by customer, room, building, and owner', async () => {
    const { service, prisma } = createService({
      invoice: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'invoice-1',
            tenantId: 'tenant-1',
            customerId: 'customer-1',
            status: 'ISSUED',
            total: 1000000,
            paidAmount: 250000,
            creditAmount: 0,
            dueDate: new Date('2026-01-01T00:00:00.000Z'),
            customer: { id: 'customer-1', fullName: 'Khách A', phone: '0901' },
            contract: {
              room: {
                id: 'room-1',
                code: '31-01',
                name: '31-01',
                building: {
                  id: 'building-1',
                  code: 'LK01-31',
                  name: 'LK01-31',
                  owner: { id: 'owner-1', code: 'TINH', name: 'Tính' },
                },
              },
            },
          },
          {
            id: 'invoice-2',
            tenantId: 'tenant-1',
            customerId: 'customer-1',
            status: 'PARTIALLY_PAID',
            total: 500000,
            paidAmount: 100000,
            creditAmount: 50000,
            dueDate: new Date('2099-01-01T00:00:00.000Z'),
            customer: { id: 'customer-1', fullName: 'Khách A', phone: '0901' },
            contract: {
              room: {
                id: 'room-1',
                code: '31-01',
                name: '31-01',
                building: {
                  id: 'building-1',
                  code: 'LK01-31',
                  name: 'LK01-31',
                  owner: { id: 'owner-1', code: 'TINH', name: 'Tính' },
                },
              },
            },
          },
        ]),
      },
    });

    const summary = await service.getDebtSummary('tenant-1');

    expect(prisma.invoice.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        tenantId: 'tenant-1',
        deletedAt: null,
        status: { notIn: ['PAID', 'CANCELLED', 'WRITTEN_OFF'] },
      }),
    }));
    expect(summary.totals).toMatchObject({
      invoiceCount: 2,
      debt: 1100000,
      overdueDebt: 750000,
    });
    expect(summary.customers[0]).toMatchObject({ id: 'customer-1', debt: 1100000, invoiceCount: 2 });
    expect(summary.rooms[0]).toMatchObject({ id: 'room-1', debt: 1100000, buildingCode: 'LK01-31' });
    expect(summary.buildings[0]).toMatchObject({ id: 'building-1', debt: 1100000, ownerName: 'Tính' });
    expect(summary.owners[0]).toMatchObject({ id: 'owner-1', debt: 1100000, ownerCode: 'TINH' });
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

  it('returns building revenue breakdown for rent, electricity, and water-service', async () => {
    const { service, prisma } = createService({
      building: {
        findFirst: vi.fn(),
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'building-1',
            code: 'LK01-31',
            name: 'LK01-31',
            owner: { id: 'owner-1', code: 'TINH', name: 'Tinh' },
            rooms: [
              { id: 'room-1', status: 'RENTED' },
              { id: 'room-2', status: 'AVAILABLE' },
            ],
          },
        ]),
      },
      journalLine: {
        aggregate: vi
          .fn()
          .mockResolvedValueOnce({ _sum: { amount: 2500000 } })
          .mockResolvedValueOnce({ _sum: { amount: 600000 } }),
      },
      expense: {
        findFirst: vi.fn(),
        create: vi.fn(),
        count: vi.fn().mockResolvedValue(0),
        update: vi.fn(),
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 500000 } }),
      },
      invoice: {
        findMany: vi.fn(),
        count: vi.fn().mockResolvedValue(2),
      },
      invoiceItem: {
        findMany: vi.fn().mockResolvedValue([
          {
            type: 'RENT',
            amount: 1800000,
            invoice: { contract: { room: { id: 'room-1', code: '31-01', name: '31-01', status: 'RENTED' } } },
          },
          {
            type: 'UTILITY_ELECTRICITY',
            amount: 350000,
            invoice: { contract: { room: { id: 'room-1', code: '31-01', name: '31-01', status: 'RENTED' } } },
          },
          {
            type: 'UTILITY_WATER',
            amount: 150000,
            invoice: { contract: { room: { id: 'room-1', code: '31-01', name: '31-01', status: 'RENTED' } } },
          },
          {
            type: 'SERVICE',
            amount: 120000,
            invoice: { contract: { room: { id: 'room-1', code: '31-01', name: '31-01', status: 'RENTED' } } },
          },
          {
            type: 'OTHER',
            amount: 80000,
            invoice: { contract: { room: { id: 'room-1', code: '31-01', name: '31-01', status: 'RENTED' } } },
          },
        ]),
      },
    });

    const summary = await service.getBuildingProfitSummary('tenant-1', { year: '2026', month: '8' });

    expect(summary).toHaveLength(1);
    expect(summary[0]).toMatchObject({
      revenue: 2500000,
      expense: 600000,
      profit: 1900000,
      overdueInvoices: 2,
      revenueBreakdown: {
        rent: 1800000,
        electricity: 350000,
        waterAndService: 270000,
        other: 80000,
      },
    });
    expect(summary[0].roomBreakdown).toHaveLength(2);
    expect(summary[0].roomBreakdown[0]).toMatchObject({
      room: { id: 'room-1', status: 'RENTED' },
      revenue: 2500000,
      revenueBreakdown: {
        rent: 1800000,
        electricity: 350000,
        waterAndService: 270000,
        other: 80000,
      },
    });
    expect(summary[0].roomBreakdown[1]).toMatchObject({
      room: { id: 'room-2', status: 'AVAILABLE' },
      revenue: 0,
    });
    expect(prisma.invoiceItem.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        tenantId: 'tenant-1',
      }),
    }));
  });
});
