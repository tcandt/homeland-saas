import { describe, expect, it, vi } from 'vitest';
import { ReportsService } from './reports.service';
import { FinanceReportingService } from '../finance/finance-reporting.service';

const period = { year: 2026, month: 10 };
const bounds = { gte: new Date('2026-09-30T17:00:00.000Z'), lt: new Date('2026-10-31T17:00:00.000Z') };
const invoice = (id: string, extra: Record<string, unknown> = {}) => ({
  id, total: 100, paidAmount: 40, creditAmount: 10, period: '2026-10',
  createdAt: new Date('2026-10-02T00:00:00Z'), items: [{ type: 'RENT', amount: 100 }], ...extra,
});

describe('GMT+7 report period and truthful balances', () => {
  it('uses service period instead of invoice creation month, with half-open fallback dates', async () => {
    const prisma: any = { invoice: { findMany: vi.fn().mockResolvedValue([
      invoice('service-current', { createdAt: new Date('2026-09-01T00:00:00Z') }),
      invoice('service-previous', { period: '2026-09' }),
      invoice('fallback-at-start', { period: 'Entry', createdAt: bounds.gte }),
      invoice('fallback-before-start', { period: 'Entry', createdAt: new Date(bounds.gte.getTime() - 1) }),
      invoice('fallback-at-end', { period: 'Entry', createdAt: bounds.lt }),
      invoice('booking', { period: 'Cọc giữ phòng' }),
    ]) } };
    const rows = await new ReportsService(prisma).getRevenueByBuilding('tenant-1', period);
    expect(rows[0]).toMatchObject({ invoiceCount: 2, totalAmount: 200, operatingRevenueAmount: 200 });
    expect(prisma.invoice.findMany.mock.calls[0][0].where).toMatchObject({ tenantId: 'tenant-1', deletedAt: null });
  });
  it('does not guess rent allocations when a mixed rent/deposit invoice is partially paid', async () => {
    const prisma: any = { invoice: { findMany: vi.fn().mockResolvedValue([
      invoice('mixed', { total: 500, paidAmount: 200, creditAmount: 0, items: [
        { type: 'RENT', amount: 300 }, { type: 'OTHER', amount: 400, description: 'Tiền cọc hợp đồng' },
        { type: 'DISCOUNT', amount: -200, servicePeriod: 'ENTRY_BOOKING_TRANSFER:deposit-1' },
      ] }),
    ]) } };
    const rows = await new ReportsService(prisma).getRevenueByBuilding('tenant-1', period);
    expect(rows[0]).toMatchObject({ totalAmount: 500, operatingRevenueAmount: 300, paidAmount: 200, remainingAmount: 300, revenueBreakdown: { rent: 300, other: 0 } });
  });
  it('applies the same selected bounds to cash-flow journal queries', async () => {
    const prisma: any = { journalLine: { aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }) } };
    await new ReportsService(prisma).getCashFlow('tenant-1', period);
    for (const [query] of prisma.journalLine.aggregate.mock.calls) {
      expect(JSON.stringify(query.where)).toContain(bounds.gte.toISOString());
      expect(JSON.stringify(query.where)).toContain(bounds.lt.toISOString());
    }
  });
  it.each([{ year: 2026, month: 13 }, { year: 2026, month: 1.5 }, { startDate: 'invalid', endDate: '2026-10-01' }, { startDate: '2026-11-01', endDate: '2026-10-01' }])('rejects invalid report input %j before querying', async (options) => {
    const prisma: any = { invoice: { findMany: vi.fn() } };
    await expect(new ReportsService(prisma).getRevenueByBuilding('tenant-1', options)).rejects.toThrow();
    expect(prisma.invoice.findMany).not.toHaveBeenCalled();
  });
  it('keeps aging current, tenant-scoped and restricted to positive balances', async () => {
    const prisma: any = { invoice: { findMany: vi.fn().mockResolvedValue([
      invoice('old-open', { period: '2025-01', dueDate: new Date('2025-02-01'), total: 100, paidAmount: 0, creditAmount: 0 }),
      invoice('settled', { dueDate: new Date(), paidAmount: 100, creditAmount: 0 }),
    ]) } };
    const rows = await new ReportsService(prisma).getReceivableAging('tenant-1');
    expect(rows.map((row) => row.invoiceId)).toEqual(['old-open']);
    expect(prisma.invoice.findMany.mock.calls[0][0].where).toMatchObject({ tenantId: 'tenant-1', deletedAt: null });
  });
  it('keeps finance legacy end inclusive and supports GMT+7 leap-month/range boundaries', () => {
    const service: any = new FinanceReportingService({} as any, {} as any);
    expect(service.buildPeriodRange('2024', '2')).toEqual({ gte: new Date('2024-01-31T17:00:00Z'), lte: new Date('2024-02-29T16:59:59.999Z') });
    expect(service.buildPeriodRange(undefined, undefined, { startYear: '2025', startMonth: '12', endYear: '2026', endMonth: '1' })).toEqual({ gte: new Date('2025-11-30T17:00:00Z'), lte: new Date('2026-01-31T16:59:59.999Z') });
  });
  it.each([{ startMonth: '10' }, { startMonth: '1.5', endMonth: '10' }, { startYear: '2026', startMonth: '10', endYear: '2026', endMonth: '9' }])('rejects incomplete/reversed finance range %j', (options) => {
    const service: any = new FinanceReportingService({} as any, {} as any);
    expect(() => service.buildPeriodRange('2026', undefined, options)).toThrow();
  });
  it('validates export/ledger dates before querying and preserves inclusive end', async () => {
    const prisma: any = { journalLine: { findMany: vi.fn().mockResolvedValue([]) } };
    const service = new FinanceReportingService(prisma, {} as any);
    await expect(service.getLedger('tenant-1', { startDate: 'bad-date' })).rejects.toThrow();
    await expect(service.getLedger('tenant-1', { startDate: '2026-11-01', endDate: '2026-10-01' })).rejects.toThrow();
    expect(prisma.journalLine.findMany).not.toHaveBeenCalled();
    await service.getLedger('tenant-1', { startDate: bounds.gte.toISOString(), endDate: '2026-10-31T16:59:59.999Z' });
    const where = prisma.journalLine.findMany.mock.calls[0][0].where;
    expect(JSON.stringify(where)).toContain('2026-10-31T16:59:59.999Z');
    expect(JSON.stringify(where)).toContain('"lte"');
  });
});
