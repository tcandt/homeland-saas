import { describe, expect, it } from 'vitest';
import { summarizeAuthoritativeFinance, summarizeInvoiceFamilies } from './finance-summary.policy';

const payment = (status = 'CONFIRMED', deletedAt: Date | null = null) => ({ status, deletedAt });

describe('authoritative finance summary policy', () => {
  it('uses roots and direct adjustments, allocation evidence, and tracks a written-off residual', () => {
    const summary = summarizeAuthoritativeFinance({
      invoices: [
        { id: 'root', customerId: 'customer-a', contractId: 'contract-a', rentalCycleId: 'cycle-a', status: 'WRITTEN_OFF', total: 1_000_000,
          allocations: [{ amount: 250_000, payment: payment() }] },
        { id: 'debit', customerId: 'customer-a', contractId: 'contract-a', rentalCycleId: 'cycle-a', adjustmentOfInvoiceId: 'root', billingKind: 'DEBIT_ADJUSTMENT', status: 'ISSUED', total: 200_000 },
        { id: 'credit', customerId: 'customer-a', contractId: 'contract-a', rentalCycleId: 'cycle-a', adjustmentOfInvoiceId: 'root', billingKind: 'CREDIT_ADJUSTMENT', status: 'ISSUED', total: 100_000 },
      ],
      depositLedgerEntries: [],
    });

    expect(summary.invoices).toMatchObject({ total: 1_100_000, paid: 250_000, writtenOff: 850_000, outstanding: 0 });
    expect(summary.invoices.families[0]).toMatchObject({
      rootInvoiceId: 'root',
      sourceEntities: [
        { entity: 'Invoice', id: 'root', code: null },
        { entity: 'Invoice', id: 'debit', code: null },
        { entity: 'Invoice', id: 'credit', code: null },
      ],
    });
  });

  it('gives drafts and cancelled invoices no obligation or cash effect', () => {
    const summary = summarizeAuthoritativeFinance({
      invoices: [
        { id: 'draft', customerId: 'customer-a', status: 'DRAFT', total: 500_000, allocations: [{ amount: 500_000, payment: payment() }] },
        { id: 'cancelled', customerId: 'customer-a', status: 'CANCELLED', total: 400_000, allocations: [{ amount: 400_000, payment: payment() }] },
      ],
      depositLedgerEntries: [],
    });
    expect(summary.invoices).toMatchObject({ total: 0, paid: 0, outstanding: 0, writtenOff: 0 });
  });

  it('counts only allocations whose payment is confirmed and not deleted', () => {
    const summary = summarizeAuthoritativeFinance({
      invoices: [{
        id: 'root', customerId: 'customer-a', status: 'ISSUED', total: 500_000,
        allocations: [
          { amount: 100_000, payment: payment('PENDING') },
          { amount: 100_000, payment: payment('CONFIRMED', new Date()) },
          { amount: 200_000, payment: payment() },
        ],
      }],
      depositLedgerEntries: [],
    });
    expect(summary.invoices).toMatchObject({ paid: 200_000, outstanding: 300_000 });
  });

  it('does not net one customer family credit against another customer family debt', () => {
    const families = summarizeInvoiceFamilies([
      { id: 'a', customerId: 'customer-a', status: 'ISSUED', total: 1_000_000 },
      { id: 'b', customerId: 'customer-b', status: 'ISSUED', total: 1_000_000, allocations: [{ amount: 1_000_000, payment: payment() }] },
      { id: 'b-credit', customerId: 'customer-b', adjustmentOfInvoiceId: 'b', billingKind: 'CREDIT_ADJUSTMENT', status: 'ISSUED', total: 500_000 },
    ]);
    expect(families.map((family) => family.outstanding)).toEqual([1_000_000, 0]);
    expect(families.reduce((total, family) => total + family.outstanding, 0)).toBe(1_000_000);
  });

  it('derives deposit balance only from immutable ledger balance effects', () => {
    const summary = summarizeAuthoritativeFinance({
      invoices: [],
      depositLedgerEntries: [
        { id: 'cash-in', depositId: 'deposit-a', type: 'CASH_IN', amount: 1_000_000, balanceEffect: 1_000_000 },
        { id: 'transfer-out', depositId: 'deposit-a', type: 'TRANSFER_OUT', amount: 200_000, balanceEffect: -200_000 },
      ],
    });
    expect(summary.depositLedger).toMatchObject({ balance: 800_000, totalsByType: { CASH_IN: 1_000_000, TRANSFER_OUT: 200_000 } });
    expect(summary.depositLedger.sourceEntities).toEqual([
      { entity: 'DepositLedgerEntry', id: 'cash-in', code: null },
      { entity: 'DepositLedgerEntry', id: 'transfer-out', code: null },
    ]);
  });

  it('reduces an open family by explicitly applied invoice credit', () => {
    const summary = summarizeAuthoritativeFinance({
      invoices: [{ id: 'root', customerId: 'customer-a', status: 'PARTIALLY_PAID', total: 1_000_000, creditAmount: 250_000 }],
      depositLedgerEntries: [],
    });
    expect(summary.invoices).toMatchObject({ total: 1_000_000, credit: 250_000, paid: 0, outstanding: 750_000 });
  });

  it('ignores an orphan credit adjustment instead of making a negative standalone family', () => {
    const families = summarizeInvoiceFamilies([
      { id: 'orphan-credit', customerId: 'customer-a', adjustmentOfInvoiceId: 'missing-root', billingKind: 'CREDIT_ADJUSTMENT', status: 'ISSUED', total: 1_000_000 },
      { id: 'valid-root', customerId: 'customer-b', status: 'ISSUED', total: 500_000 },
    ]);
    expect(families).toHaveLength(1);
    expect(families[0]).toMatchObject({ rootInvoiceId: 'valid-root', total: 500_000, outstanding: 500_000 });
  });
});
