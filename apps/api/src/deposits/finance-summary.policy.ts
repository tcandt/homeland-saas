/**
 * The financial read model deliberately derives cash from allocations, never
 * from Invoice.paidAmount or Payment.amount. Those fields are operational
 * caches/documents; an allocation backed by a confirmed, non-deleted payment
 * is the only cash evidence that may reduce a receivable.
 */
export type FinanceInvoiceRow = {
  id: string;
  code?: string | null;
  customerId: string;
  contractId?: string | null;
  rentalCycleId?: string | null;
  adjustmentOfInvoiceId?: string | null;
  billingKind?: string | null;
  status: string;
  total: unknown;
  creditAmount?: unknown;
  allocations?: Array<{
    id?: string;
    paymentId?: string;
    invoiceId?: string;
    amount: unknown;
    payment?: { id?: string; status: string; deletedAt?: Date | string | null; provider?: string | null } | null;
  }>;
};

export type FinanceDepositLedgerRow = {
  id?: string;
  depositId: string;
  type: string;
  amount: unknown;
  balanceEffect: unknown;
  createdAt?: Date | string;
};

export type AuthoritativeInvoiceFamily = {
  rootInvoiceId: string;
  customerId: string;
  contractId: string | null;
  rentalCycleId: string | null;
  total: number;
  cashReceived: number;
  creditApplied: number;
  writtenOff: number;
  outstanding: number;
  sourceEntities: Array<{ entity: 'Invoice'; id: string; code: string | null }>;
  allocations: Array<{
    source: { entity: 'PaymentAllocation'; id: string | null; code: null };
    paymentSource: { entity: 'Payment'; id: string | null; code: null };
    invoiceSource: { entity: 'Invoice'; id: string; code: string | null };
    amount: number;
  }>;
};

export type ExcludedFinanceDocument = {
  entity: 'Invoice';
  id: string;
  code: string | null;
  reason: 'ORPHAN_ADJUSTMENT' | 'ADJUSTMENT_CUSTOMER_MISMATCH';
};

const ZERO_VALUE_STATUSES = new Set(['DRAFT', 'CANCELLED']);

function money(value: unknown): number {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round((numeric + Number.EPSILON) * 100) / 100;
}

function sum(values: unknown[]): number {
  return money(values.reduce<number>((total, value) => total + money(value), 0));
}

function signedInvoiceTotal(invoice: FinanceInvoiceRow): number {
  if (ZERO_VALUE_STATUSES.has(invoice.status)) return 0;
  const total = money(invoice.total);
  return invoice.billingKind === 'CREDIT_ADJUSTMENT' ? -total : total;
}

function confirmedAllocatedCash(invoice: FinanceInvoiceRow): number {
  if (ZERO_VALUE_STATUSES.has(invoice.status)) return 0;
  return sum((invoice.allocations || [])
    .filter((allocation) => allocation.payment?.status === 'CONFIRMED' && !allocation.payment.deletedAt)
    .map((allocation) => allocation.amount));
}

function appliedCredit(invoice: FinanceInvoiceRow): number {
  if (ZERO_VALUE_STATUSES.has(invoice.status) || invoice.billingKind === 'CREDIT_ADJUSTMENT') return 0;
  // A corrupt legacy row must not turn an invoice into a negative credit pool.
  return Math.min(Math.max(0, money(invoice.creditAmount)), Math.max(0, money(invoice.total)));
}

/**
 * Collapses roots and their direct adjustments into independently payable
 * invoice families. Families are never netted against another customer or
 * another root invoice. This makes an over-credit/paid family unable to hide
 * an unrelated customer's debt in a room-level total.
 */
export function inspectInvoiceFamilies(invoices: FinanceInvoiceRow[]) {
  const byId = new Map(invoices.map((invoice) => [invoice.id, invoice]));
  const groups = new Map<string, FinanceInvoiceRow[]>();
  const validDocuments: FinanceInvoiceRow[] = [];
  const excludedDocuments: ExcludedFinanceDocument[] = [];

  for (const invoice of invoices) {
    const parent = invoice.adjustmentOfInvoiceId ? byId.get(invoice.adjustmentOfInvoiceId) : null;
    // A direct adjustment without its root is invalid historical data. It is
    // excluded from the read model instead of becoming a standalone negative
    // receivable that could distort a room's total.
    if (invoice.adjustmentOfInvoiceId && !parent) {
      excludedDocuments.push({ entity: 'Invoice', id: invoice.id, code: invoice.code || null, reason: 'ORPHAN_ADJUSTMENT' });
      continue;
    }
    if (invoice.adjustmentOfInvoiceId && parent?.customerId !== invoice.customerId) {
      excludedDocuments.push({ entity: 'Invoice', id: invoice.id, code: invoice.code || null, reason: 'ADJUSTMENT_CUSTOMER_MISMATCH' });
      continue;
    }
    const rootId = parent ? parent.id : invoice.id;
    const family = groups.get(rootId) || [];
    family.push(invoice);
    groups.set(rootId, family);
    validDocuments.push(invoice);
  }

  const families: AuthoritativeInvoiceFamily[] = [];
  for (const [rootInvoiceId, family] of groups) {
    const root = family.find((invoice) => invoice.id === rootInvoiceId) || family[0];
    const total = sum(family.map(signedInvoiceTotal));
    const cashReceived = sum(family.map(confirmedAllocatedCash));
    const creditApplied = sum(family.map(appliedCredit));
    const hasWrittenOffDocument = family.some((invoice) => invoice.status === 'WRITTEN_OFF');
    // A written-off family carries its unpaid residual as an accounting loss,
    // rather than an open receivable. Cash already allocated remains cash.
    const residual = Math.max(0, money(total - cashReceived - creditApplied));
    const writtenOff = hasWrittenOffDocument ? residual : 0;
    const outstanding = hasWrittenOffDocument ? 0 : residual;
    families.push({
      rootInvoiceId,
      customerId: root.customerId,
      contractId: root.contractId || null,
      rentalCycleId: root.rentalCycleId || null,
      total,
      cashReceived,
      creditApplied,
      writtenOff,
      outstanding,
      sourceEntities: family.map((invoice) => ({ entity: 'Invoice' as const, id: invoice.id, code: invoice.code || null })),
      allocations: family.flatMap((invoice) => (invoice.allocations || [])
        .filter((allocation) => allocation.payment?.status === 'CONFIRMED' && !allocation.payment.deletedAt)
        .map((allocation) => ({
          source: { entity: 'PaymentAllocation' as const, id: allocation.id || null, code: null },
          paymentSource: { entity: 'Payment' as const, id: allocation.payment?.id || allocation.paymentId || null, code: null },
          invoiceSource: { entity: 'Invoice' as const, id: invoice.id, code: invoice.code || null },
          amount: money(allocation.amount),
        }))),
    });
  }

  return { families, validDocuments, excludedDocuments };
}

export function summarizeInvoiceFamilies(invoices: FinanceInvoiceRow[]) {
  return inspectInvoiceFamilies(invoices).families;
}

export function summarizeDepositLedger(entries: FinanceDepositLedgerRow[]) {
  const balances = new Map<string, number>();
  const totalsByType: Record<string, number> = {};
  const sources: Array<{ entity: 'DepositLedgerEntry'; id: string }> = [];
  for (const entry of entries) {
    balances.set(entry.depositId, money((balances.get(entry.depositId) || 0) + money(entry.balanceEffect)));
    totalsByType[entry.type] = money((totalsByType[entry.type] || 0) + money(entry.amount));
    if (entry.id) sources.push({ entity: 'DepositLedgerEntry', id: entry.id });
  }
  return {
    balances,
    totalsByType,
    balance: sum(Array.from(balances.values())),
    sourceEntities: sources.map((source) => ({ ...source, code: null })),
  };
}

export function summarizeAuthoritativeFinance(input: {
  invoices: FinanceInvoiceRow[];
  depositLedgerEntries: FinanceDepositLedgerRow[];
}) {
  const inspection = inspectInvoiceFamilies(input.invoices);
  const invoiceFamilies = inspection.families;
  const depositLedger = summarizeDepositLedger(input.depositLedgerEntries);
  return {
    invoiceFamilies,
    invoices: {
      count: inspection.validDocuments.length,
      total: sum(invoiceFamilies.map((family) => family.total)),
      paid: sum(invoiceFamilies.map((family) => family.cashReceived)),
      // `credit` preserves the legacy field meaning: credit already applied to
      // a positive invoice. Credit adjustments are included in `total` as a
      // signed document and exposed separately for auditability.
      credit: sum(invoiceFamilies.map((family) => family.creditApplied)),
      creditAdjustments: sum(inspection.validDocuments
        .filter((invoice) => invoice.billingKind === 'CREDIT_ADJUSTMENT' && !ZERO_VALUE_STATUSES.has(invoice.status))
        .map((invoice) => invoice.total)),
      writtenOff: sum(invoiceFamilies.map((family) => family.writtenOff)),
      outstanding: sum(invoiceFamilies.map((family) => family.outstanding)),
      families: invoiceFamilies,
      excludedDocuments: inspection.excludedDocuments,
    },
    depositLedger,
  };
}
