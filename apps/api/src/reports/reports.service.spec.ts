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
      where: expect.objectContaining({ account: { code: { in: ['1000', '1100'] } }, type: 'DEBIT' }),
    }));
    expect(aggregate).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: expect.objectContaining({ account: { code: { in: ['1000', '1100'] } }, type: 'CREDIT' }),
    }));
    expect(report).toMatchObject({ totalInflow: 5_000_000, totalOutflow: 1_500_000, netCashFlow: 3_500_000 });
  });

  it('uses account types for profit and loss totals', async () => {
    const findMany = vi.fn()
      .mockResolvedValueOnce([{ type: 'CREDIT', amount: 4_000_000 }, { type: 'DEBIT', amount: 200_000 }])
      .mockResolvedValueOnce([{ type: 'DEBIT', amount: 1_000_000 }]);
    const prisma: any = { journalLine: { findMany } };

    const report = await new ReportsService(prisma).getProfitLoss('tenant-1');

    expect(findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: expect.objectContaining({ account: { type: 'REVENUE' } }),
    }));
    expect(findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: expect.objectContaining({ account: { type: 'EXPENSE' } }),
    }));
    expect(report).toMatchObject({ revenue: 3_800_000, expenses: 1_000_000, netProfit: 2_800_000 });
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
});
