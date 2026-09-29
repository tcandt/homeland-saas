export function getInvoiceFinancials(invoice: any) {
  const total = Math.max(0, Number(invoice?.total ?? invoice?.totalAmount ?? invoice?.amount ?? 0) || 0);
  const confirmedPaid = Math.max(0, Number(invoice?.paidAmount ?? invoice?.paid ?? 0) || 0);
  const pendingReviewReceived = Math.max(
    0,
    Number(invoice?.pendingReviewReceivedAmount ?? invoice?.sepayPendingReviewAmount ?? 0) || 0,
  );
  const paid = confirmedPaid;
  const credit = Math.max(0, Number(invoice?.creditAmount ?? invoice?.credit ?? 0) || 0);
  const settled = Math.min(total, paid + credit);
  const reportedOverpaid = Math.max(0, Number(invoice?.overpaymentAmount ?? invoice?.overpaidAmount ?? 0) || 0);
  const overpaid = Math.max(reportedOverpaid, paid + credit - total);
  const depositDocument = invoice?.documentType === "DEPOSIT";
  const refunded = depositDocument ? Math.max(0, Number(invoice.refundedAmount) || 0) : 0;
  const closedDeposit = depositDocument && ["CANCELLED", "REFUNDED", "CONVERTED_TO_CONTRACT"].includes(invoice.status);

  return {
    total,
    confirmedPaid,
    pendingReviewReceived,
    paid,
    credit,
    settled,
    overpaid,
    refunded,
    remaining: closedDeposit ? 0 : Math.max(0, total - settled),
    settledPercent: total > 0 ? Math.min(100, Math.round((settled / total) * 100)) : 0,
  };
}

export function getBillingDocumentCashflow(invoice: any, direction: "INCOME" | "EXPENSE") {
  const { total, paid, refunded } = getInvoiceFinancials(invoice);
  return direction === "EXPENSE"
    ? { totalIncome: 0, paidIncome: 0, totalExpense: total, paidExpense: paid }
    : { totalIncome: total, paidIncome: paid, totalExpense: refunded, paidExpense: refunded };
}

export function isBookingHoldInvoice(invoice: any) {
  const period = String(invoice?.period || invoice?.usagePeriod || "").trim().toLowerCase();
  const billingKind = String(invoice?.billingKind || "").trim().toUpperCase();
  return (
    period === "cọc giữ phòng" ||
    billingKind === "BOOKING_HOLD" ||
    billingKind === "BOOKING_DEPOSIT"
  );
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
