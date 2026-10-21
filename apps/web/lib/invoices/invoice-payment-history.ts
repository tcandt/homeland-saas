export function getInvoicePaymentMethod(payment: any): string {
  const provider = String(payment?.provider || "").toUpperCase();
  const reference = String(payment?.providerRef || "").toUpperCase();
  if (provider === "MANUAL" && reference.startsWith("CASH:")) return "Tiền mặt";
  if (provider === "MANUAL" && reference.startsWith("BANK_TRANSFER:")) return "Chuyển khoản do Admin xác nhận";
  if (provider === "SEPAY") return "Chuyển khoản SePay";
  return provider === "MANUAL" ? "Thu thủ công" : provider || "Chưa rõ phương thức";
}

/** Allocation amounts belong to this invoice; a payment can cover several invoices. */
export function getInvoicePaymentHistory(invoice: any) {
  const records = new Map<string, { id: string; amount: number; paidAt: string | null; method: string }>();
  const add = (payment: any, amount: unknown, allocated: boolean) => {
    if (!payment?.id || payment.deletedAt || payment.status !== "CONFIRMED") return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return;
    const existing = records.get(payment.id);
    if (existing && !allocated) return;
    records.set(payment.id, {
      id: payment.id,
      amount: (existing?.amount || 0) + value,
      paidAt: payment.paidAt || null,
      method: getInvoicePaymentMethod(payment),
    });
  };
  for (const allocation of invoice?.allocations || []) {
    if (allocation.invoiceId && allocation.invoiceId !== invoice.id) continue;
    add(allocation.payment, allocation.amount, true);
  }
  for (const payment of invoice?.payments || []) {
    if (payment.invoiceId && payment.invoiceId !== invoice.id) continue;
    add(payment, payment.amount, false);
  }
  return [...records.values()].sort((a, b) =>
    (Date.parse(a.paidAt || "") || 0) - (Date.parse(b.paidAt || "") || 0));
}
