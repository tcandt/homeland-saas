import { describe, expect, it, vi } from 'vitest';
import { ReportsService } from './reports.service';

describe('ReportsService', () => {
  it('uses seeded cash accounts for cashflow totals', async () => {
    const aggregate = vi.fn()
      .mockResolvedValueOnce({ _sum: { amount: 5_000_000 } })
      .mockResolvedValueOnce({ _sum: { amount: 1_500_000 } });
    const prisma: any = { journalLine: { aggregate } };

    const report = await new ReportsService(prisma).getCashFlow('tenant-1');

    expect(aggregate).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: expect.objectContaining({
        tenantId: 'tenant-1',
        journalEntry: expect.objectContaining({ tenantId: 'tenant-1', status: { in: ['POSTED', 'REVERSED'] } }),
        account: expect.objectContaining({ tenantId: 'tenant-1', type: 'ASSET' }),
        type: 'DEBIT',
      }),
    }));
    expect(aggregate).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: expect.objectContaining({ type: 'CREDIT' }),
    }));
    expect(report).toMatchObject({ totalInflow: 5_000_000, totalOutflow: 1_500_000, netCashFlow: 3_500_000 });
  });

  it('uses account types for profit and loss totals', async () => {
    const findMany = vi.fn()
      .mockResolvedValueOnce([{ type: 'CREDIT', amount: 4_000_000 }, { type: 'DEBIT', amount: 200_000 }])
      .mockResolvedValueOnce([{ type: 'DEBIT', amount: 1_000_000 }]);
    const prisma: any = { journalLine: { findMany }, invoice: { findMany: vi.fn().mockResolvedValue([]) } };

    const report = await new ReportsService(prisma).getProfitLoss('tenant-1');

    expect(findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: expect.objectContaining({
        tenantId: 'tenant-1',
        journalEntry: expect.objectContaining({ tenantId: 'tenant-1', status: { in: ['POSTED', 'REVERSED'] } }),
        account: { tenantId: 'tenant-1', type: 'REVENUE' },
      }),
    }));
    expect(findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: expect.objectContaining({ account: { tenantId: 'tenant-1', type: 'EXPENSE' } }),
    }));
    expect(report).toMatchObject({ revenue: 3_800_000, expenses: 1_000_000, netProfit: 2_800_000 });
  });

  it('excludes legacy booking-hold invoice revenue journals from profit and loss', async () => {
    const journalFindMany = vi.fn()
      .mockResolvedValueOnce([{ type: 'CREDIT', amount: 5_000_000 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ type: 'CREDIT', amount: 1_000_000 }]);
    const prisma: any = {
      journalLine: { findMany: journalFindMany },
      invoice: { findMany: vi.fn().mockResolvedValue([{ id: 'booking-invoice-1' }]) },
    };

    const report = await new ReportsService(prisma).getProfitLoss('tenant-1');

    expect(report).toMatchObject({ revenue: 4_000_000, expenses: 0, netProfit: 4_000_000 });
    expect(journalFindMany).toHaveBeenNthCalledWith(3, expect.objectContaining({
      where: expect.objectContaining({
        journalEntry: expect.objectContaining({
          sourceType: 'INVOICE',
          sourceId: { in: ['booking-invoice-1'] },
        }),
      }),
    }));
  });

  it('subtracts invoice credits from receivable aging balances', async () => {
    const prisma: any = {
      invoice: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'invoice-1',
            code: 'INV-001',
            total: 1_000_000,
            paidAmount: 300_000,
            creditAmount: 200_000,
            dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            customer: { fullName: 'Khách A' },
          },
        ]),
      },
    };

    const rows = await new ReportsService(prisma).getReceivableAging('tenant-1');

    expect(rows[0]).toMatchObject({
      invoiceCode: 'INV-001',
      totalAmount: 1_000_000,
      remainingAmount: 500_000,
    });
    expect(prisma.invoice.findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] } },
      include: { customer: true },
    });
  });

  it('returns revenue by building and excludes booking-hold deposit invoices', async () => {
    const prisma: any = {
      invoice: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'invoice-rent',
            total: 3_000_000,
            paidAmount: 2_000_000,
            creditAmount: 500_000,
            period: '2026-09',
            items: [
              { type: 'RENT', amount: 2_500_000 },
              { type: 'UTILITY_ELECTRICITY', amount: 500_000 },
            ],
            contract: { room: { building: { id: 'building-1', code: 'B1', name: 'Tòa 1' } } },
          },
          {
            id: 'booking-hold',
            total: 1_000_000,
            paidAmount: 1_000_000,
            creditAmount: 0,
            period: 'Cọc giữ phòng',
            items: [{ type: 'RENT', amount: 1_000_000 }],
            contract: { room: { building: { id: 'building-1', code: 'B1', name: 'Tòa 1' } } },
          },
        ]),
      },
    };

    const rows = await new ReportsService(prisma).getRevenueByBuilding('tenant-1');

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      buildingId: 'building-1',
      totalAmount: 3_000_000,
      paidAmount: 2_000_000,
      creditAmount: 500_000,
      remainingAmount: 500_000,
      revenueBreakdown: { rent: 2_500_000, electricity: 500_000 },
    });
  });

  it('returns revenue by room and excludes booking-hold deposit invoices', async () => {
    const prisma: any = {
      invoice: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'invoice-rent',
            customerId: 'customer-1',
            total: 2_000_000,
            paidAmount: 1_500_000,
            creditAmount: 0,
            period: '2026-09',
            items: [{ type: 'SERVICE', amount: 2_000_000 }],
            customer: { fullName: 'Khách A' },
            contract: {
              room: {
                id: 'room-1',
                code: 'P101',
                building: { id: 'building-1', code: 'B1', name: 'Tòa 1' },
              },
            },
          },
          {
            id: 'booking-hold',
            customerId: 'customer-1',
            total: 1_000_000,
            paidAmount: 1_000_000,
            creditAmount: 0,
            period: 'Cọc giữ phòng',
            items: [{ type: 'RENT', amount: 1_000_000 }],
            customer: { fullName: 'Khách A' },
            contract: {
              room: {
                id: 'room-1',
                code: 'P101',
                building: { id: 'building-1', code: 'B1', name: 'Tòa 1' },
              },
            },
          },
        ]),
      },
    };

    const rows = await new ReportsService(prisma).getRevenueByRoom('tenant-1');

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      roomId: 'room-1',
      roomCode: 'P101',
      totalAmount: 2_000_000,
      paidAmount: 1_500_000,
      remainingAmount: 500_000,
      revenueBreakdown: { waterAndService: 2_000_000 },
    });
  });
});
