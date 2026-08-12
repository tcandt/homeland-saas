export function getInvoiceFinancials(invoice: any) {
  const total = Math.max(0, Number(invoice?.total ?? invoice?.totalAmount ?? invoice?.amount ?? 0) || 0);
  const paid = Math.max(0, Number(invoice?.paidAmount ?? invoice?.paid ?? 0) || 0);
  const credit = Math.max(0, Number(invoice?.creditAmount ?? invoice?.credit ?? 0) || 0);
  const settled = Math.min(total, paid + credit);

  return {
    total,
    paid,
    credit,
    settled,
    remaining: Math.max(0, total - settled),
    settledPercent: total > 0 ? Math.min(100, Math.round((settled / total) * 100)) : 0,
  };
}

export function getInvoicesFinancialSummary(invoices: any[] = []) {
  return invoices.reduce(
    (summary, invoice) => {
      const financials = getInvoiceFinancials(invoice);

      summary.total += financials.total;
      summary.paid += financials.paid;
      summary.credit += financials.credit;
      summary.settled += financials.settled;
      summary.remaining += financials.remaining;

      return summary;
    },
    {
      total: 0,
      paid: 0,
      credit: 0,
      settled: 0,
      remaining: 0,
    },
  );
}
