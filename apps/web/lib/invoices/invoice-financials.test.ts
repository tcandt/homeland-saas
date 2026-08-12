import { describe, expect, it } from 'vitest';
import { getInvoiceFinancials } from './invoice-financials';

describe('getInvoiceFinancials', () => {
  it('subtracts both cash payments and credits from the remaining balance', () => {
    expect(getInvoiceFinancials({ total: 1_000_000, paidAmount: 300_000, creditAmount: 200_000 })).toEqual({
      total: 1_000_000,
      paid: 300_000,
      credit: 200_000,
      settled: 500_000,
      remaining: 500_000,
      settledPercent: 50,
    });
  });

  it('caps settled values at the invoice total', () => {
    expect(getInvoiceFinancials({ totalAmount: 500_000, paid: 400_000, credit: 200_000 })).toMatchObject({
      settled: 500_000,
      remaining: 0,
      settledPercent: 100,
    });
  });
});
