import { describe, expect, it, vi } from 'vitest';
import { FinanceLedgerService } from './ledger.service';

describe('FinanceLedgerService journal effect scope', () => {
  it('calculates a tenant-scoped balance from posted/reversed effects only', async () => {
    const aggregate = vi.fn()
      .mockResolvedValueOnce({ _sum: { amount: 1_000 } })
      .mockResolvedValueOnce({ _sum: { amount: 250 } });
    const prisma: any = {
      journalLine: { aggregate },
      chartOfAccount: { findFirst: vi.fn().mockResolvedValue({ id: 'cash-a', type: 'ASSET' }) },
    };

    await expect(new FinanceLedgerService(prisma).getAccountBalance('tenant-a', 'cash-a')).resolves.toBe(750);
    expect(aggregate).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        tenantId: 'tenant-a',
        journalEntry: { tenantId: 'tenant-a', status: { in: ['POSTED', 'REVERSED'] } },
      }),
    }));
    expect(prisma.chartOfAccount.findFirst).toHaveBeenCalledWith({ where: { tenantId: 'tenant-a', id: 'cash-a' } });
  });
});
