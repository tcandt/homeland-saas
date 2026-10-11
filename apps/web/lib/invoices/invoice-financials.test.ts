import { describe, expect, it } from 'vitest';
import {
  getInvoiceDocumentCounts,
  getInvoiceFinancials,
  getInvoicePaymentPresentation,
  getInvoiceOperationsSummary,
  getInvoicesFinancialSummary,
} from './invoice-financials';

describe('getInvoiceFinancials', () => {
  it('subtracts both cash payments and credits from the remaining balance', () => {
    expect(getInvoiceFinancials({ total: 1_000_000, paidAmount: 300_000, creditAmount: 200_000 })).toEqual({
      total: 1_000_000,
      confirmedPaid: 300_000,
      pendingReviewReceived: 0,
      paid: 300_000,
      credit: 200_000,
      settled: 500_000,
      overpaid: 0,
      refunded: 0,
      remaining: 500_000,
      settledPercent: 50,
    });
  });

  it('keeps SePay review money separate from confirmed paid balance', () => {
    expect(getInvoiceFinancials({
      total: 1_500_000,
      paidAmount: 0,
      pendingReviewReceivedAmount: 1_350_000,
    })).toMatchObject({
      total: 1_500_000,
      confirmedPaid: 0,
      pendingReviewReceived: 1_350_000,
      paid: 0,
      remaining: 1_500_000,
      settledPercent: 0,
    });
  });

  it('caps settled values at the invoice total', () => {
    expect(getInvoiceFinancials({ totalAmount: 500_000, paid: 400_000, credit: 200_000 })).toMatchObject({
      settled: 500_000,
      overpaid: 100_000,
      remaining: 0,
      settledPercent: 100,
    });
  });

  it('aggregates cash, credits, and remaining balances across invoices', () => {
    expect(
      getInvoicesFinancialSummary([
        { total: 1_000_000, paidAmount: 300_000, creditAmount: 200_000 },
        { total: 500_000, paidAmount: 500_000, creditAmount: 100_000 },
      ]),
    ).toEqual({
      total: 1_500_000,
      paid: 800_000,
      credit: 300_000,
      settled: 1_000_000,
      remaining: 500_000,
    });
  });
});

describe('invoice payment presentation', () => {
  it('does not treat PAID metadata with an outstanding balance as paid', () => {
    expect(getInvoicePaymentPresentation({ total: 13_709_677, paidAmount: 0, status: 'PAID' })).toMatchObject({
      label: 'Chờ thanh toán', isFullyPaid: false, isSettled: false, canCollect: true,
    });
  });

  it('distinguishes partial cash, full cash, and credit settlement', () => {
    expect(getInvoicePaymentPresentation({ total: 100, paidAmount: 40, status: 'PARTIALLY_PAID' }).label).toBe('Đã thu một phần');
    expect(getInvoicePaymentPresentation({ total: 100, paidAmount: 100, status: 'ISSUED' }).label).toBe('Đã thu đủ');
    expect(getInvoicePaymentPresentation({ total: 100, paidAmount: 40, creditAmount: 60, status: 'PAID' }).label).toBe('Đã tất toán');
  });

  it('does not report success for review, zero, invalid, or terminal documents', () => {
    expect(getInvoicePaymentPresentation({ total: 100, pendingReviewReceivedAmount: 50, status: 'PAID' })).toMatchObject({ label: 'Cần đối soát', canCollect: false });
    expect(getInvoicePaymentPresentation({ total: 100, status: 'RECONCILIATION_PENDING' })).toMatchObject({ label: 'Cần đối soát', canCollect: false });
    expect(getInvoicePaymentPresentation({ total: 0, status: 'PAID' }).label).toBe('Không có nghĩa vụ thu');
    expect(getInvoicePaymentPresentation({ total: 'invalid', status: 'PAID' }).label).toBe('Dữ liệu không hợp lệ');
    expect(getInvoicePaymentPresentation({ total: 100, paidAmount: 100, status: 'CANCELLED' }).label).toBe('Đã hủy');
  });
});

describe('invoice operations dashboard data', () => {
  it('returns zero values instead of fabricated KPIs for an empty dataset', () => {
    expect(getInvoiceOperationsSummary([], [])).toEqual({
      totalIncome: 0,
      paidIncome: 0,
      pendingAmount: 0,
      overdueAmount: 0,
      recoveryRate: 0,
      pendingRate: 0,
      firstPaymentBundleTotal: 0,
      bundleCount: 0,
      totalCount: 0,
    });
    expect(getInvoiceDocumentCounts([])).toEqual({ totalAll: 0, invoiceOnly: 0, depositOnly: 0 });
  });

  it('calculates KPI totals, rates, and document counts from API documents', () => {
    const documents = [
      { id: 'issued', total: 1_000_000, paidAmount: 400_000, status: 'ISSUED' },
      { id: 'overdue', total: 500_000, paidAmount: 100_000, status: 'OVERDUE' },
      { id: 'expense', total: 300_000, paidAmount: 300_000, status: 'PAID', documentType: 'DEPOSIT' },
      { id: 'cancelled', total: 9_000_000, paidAmount: 0, status: 'CANCELLED' },
    ];

    expect(
      getInvoiceOperationsSummary(
        documents,
        [
          { linked: true, bundleData: { total: 1_500_000 } },
          { linked: true, bundleData: { total: 250_000 } },
          { linked: false },
        ],
        (document) => document.id === 'expense' ? 'EXPENSE' : 'INCOME',
      ),
    ).toEqual({
      totalIncome: 1_500_000,
      paidIncome: 500_000,
      pendingAmount: 1_000_000,
      overdueAmount: 400_000,
      recoveryRate: 33,
      pendingRate: 67,
      firstPaymentBundleTotal: 1_750_000,
      bundleCount: 2,
      totalCount: 4,
    });
    expect(getInvoiceDocumentCounts(documents)).toEqual({ totalAll: 4, invoiceOnly: 3, depositOnly: 1 });
  });

  it('keeps PAID metadata with debt in pending KPI totals', () => {
    expect(getInvoiceOperationsSummary([{ total: 13_709_677, paidAmount: 0, status: 'PAID' }])).toMatchObject({
      pendingAmount: 13_709_677,
      pendingRate: 100,
    });
  });
});
