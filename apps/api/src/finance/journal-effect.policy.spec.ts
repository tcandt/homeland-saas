import { describe, expect, it, vi } from 'vitest';
import { authoritativeJournalLineWhere, normalBalance } from './journal-effect.policy';
import { FinanceReportingService } from './finance-reporting.service';

describe('authoritative journal effects', () => {
  it('keeps posted and reversed history tenant-bound while reversal lines net the source to zero', () => {
    expect(authoritativeJournalLineWhere('tenant-a', { accountId: 'cash-a' }, {
      entryDate: { gte: new Date('2026-01-01') },
    })).toEqual({
      tenantId: 'tenant-a',
      accountId: 'cash-a',
      journalEntry: {
        tenantId: 'tenant-a',
        status: { in: ['POSTED', 'REVERSED'] },
        entryDate: { gte: new Date('2026-01-01') },
      },
    });

    // Original REVERSED credit and the POSTED REVERSAL debit both remain
    // traceable, but produce no revenue effect together.
    expect(normalBalance([
      { type: 'CREDIT', amount: 1_000 },
      { type: 'DEBIT', amount: 1_000 },
    ], 'CREDIT')).toBe(0);
  });

  it('uses normal and contra sides for payment, refund, credit, deposit, expense and adjustment sources', () => {
    const sources = ['PAYMENT', 'REFUND', 'CREDIT', 'DEPOSIT', 'EXPENSE', 'ADJUSTMENT'];
    expect(normalBalance(sources.map((_, index) => ({
      type: index % 2 ? 'DEBIT' : 'CREDIT',
      amount: 100,
    })), 'CREDIT')).toBe(0);
  });

  it('uses accounting entry date and tenant-scoped relations for the ledger trace', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const service = new FinanceReportingService(
      { journalLine: { findMany } } as any,
      {} as any,
    );
    await service.getLedger('tenant-a', {
      accountId: 'account-a',
      costCenterId: 'center-a',
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        tenantId: 'tenant-a',
        account: { id: 'account-a', tenantId: 'tenant-a' },
        costCenter: { id: 'center-a', tenantId: 'tenant-a' },
        journalEntry: expect.objectContaining({
          tenantId: 'tenant-a',
          status: { in: ['POSTED', 'REVERSED'] },
          entryDate: expect.objectContaining({ gte: expect.any(Date), lte: expect.any(Date) }),
        }),
      }),
      include: { account: true, costCenter: true, journalEntry: true },
      orderBy: { journalEntry: { entryDate: 'desc' } },
    }));
  });
});
