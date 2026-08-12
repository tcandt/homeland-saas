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
