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

export type InvoicePaymentPresentation = {
  label: string;
  tone: "success" | "warning" | "info" | "muted" | "danger";
  isFullyPaid: boolean;
  isSettled: boolean;
  isPartial: boolean;
  isPendingReview: boolean;
  isTerminal: boolean;
  canCollect: boolean;
  hasValidAmounts: boolean;
  total: number;
  paid: number;
  credit: number;
  remaining: number;
};

const terminalPaymentStatuses = new Set([
  "DRAFT",
  "CANCELLED",
  "REFUNDED",
  "CONVERTED_TO_CONTRACT",
  "WRITTEN_OFF",
]);

const terminalLabels: Record<string, string> = {
  DRAFT: "Bản nháp",
  CANCELLED: "Đã hủy",
  REFUNDED: "Đã hoàn",
  CONVERTED_TO_CONTRACT: "Đã chuyển đổi",
  WRITTEN_OFF: "Đã xóa nợ",
};

function hasInvalidAmount(invoice: any, fields: string[]) {
  return fields.some((field) => {
    const value = invoice?.[field];
    return value !== undefined && value !== null && value !== "" && !Number.isFinite(Number(value));
  });
}

/** Presentation-only payment state. Lifecycle metadata never overrides balances. */
export function getInvoicePaymentPresentation(invoice: any): InvoicePaymentPresentation {
  const status = String(invoice?.status || "").trim().toUpperCase();
  const hasValidAmounts = !hasInvalidAmount(invoice, [
    "total", "totalAmount", "amount", "paidAmount", "paid", "creditAmount", "credit",
    "pendingReviewReceivedAmount", "sepayPendingReviewAmount",
  ]);
  const financials = getInvoiceFinancials(invoice);
  const { total, paid, credit, remaining, pendingReviewReceived } = financials;
  const isTerminal = terminalPaymentStatuses.has(status);
  const isZero = total <= 0;
  const isSettled = hasValidAmounts && !isTerminal && total > 0 && remaining <= 0;
  const isFullyPaid = isSettled && paid >= total;
  const isPartial = hasValidAmounts && !isTerminal && total > 0 && !isSettled && (paid > 0 || credit > 0);
  const isPendingReview = hasValidAmounts && !isTerminal && !isSettled && (
    pendingReviewReceived > 0 || status === "RECONCILIATION_PENDING"
  );

  if (!hasValidAmounts) {
    return { label: "Dữ liệu không hợp lệ", tone: "danger", isFullyPaid: false, isSettled: false, isPartial: false, isPendingReview: false, isTerminal, canCollect: false, hasValidAmounts, total, paid, credit, remaining };
  }
  if (isTerminal) {
    return { label: terminalLabels[status] || "Đã kết thúc", tone: "muted", isFullyPaid: false, isSettled: false, isPartial: false, isPendingReview: false, isTerminal, canCollect: false, hasValidAmounts, total, paid, credit, remaining };
  }
  if (isZero) {
    return { label: "Không có nghĩa vụ thu", tone: "muted", isFullyPaid: false, isSettled: false, isPartial: false, isPendingReview: false, isTerminal: false, canCollect: false, hasValidAmounts, total, paid, credit, remaining };
  }
  if (isFullyPaid) {
    return { label: "Đã thu đủ", tone: "success", isFullyPaid, isSettled, isPartial: false, isPendingReview: false, isTerminal: false, canCollect: false, hasValidAmounts, total, paid, credit, remaining };
  }
  if (isSettled) {
    return { label: "Đã tất toán", tone: "success", isFullyPaid: false, isSettled, isPartial: false, isPendingReview: false, isTerminal: false, canCollect: false, hasValidAmounts, total, paid, credit, remaining };
  }
  if (isPendingReview) {
    return { label: "Cần đối soát", tone: "warning", isFullyPaid: false, isSettled: false, isPartial, isPendingReview, isTerminal: false, canCollect: false, hasValidAmounts, total, paid, credit, remaining };
  }
  if (isPartial) {
    return { label: credit > 0 && paid === 0 ? "Đã bù trừ một phần" : "Đã thu một phần", tone: "info", isFullyPaid: false, isSettled: false, isPartial, isPendingReview: false, isTerminal: false, canCollect: true, hasValidAmounts, total, paid, credit, remaining };
  }
  if (["", "PAID"].includes(status) || !["ISSUED", "OVERDUE", "PARTIALLY_PAID", "RECONCILIATION_PENDING"].includes(status)) {
    return { label: "Chờ thanh toán", tone: "warning", isFullyPaid: false, isSettled: false, isPartial: false, isPendingReview: false, isTerminal: false, canCollect: true, hasValidAmounts, total, paid, credit, remaining };
  }
  return { label: status === "OVERDUE" ? "Quá hạn" : "Chờ thanh toán", tone: status === "OVERDUE" ? "danger" : "warning", isFullyPaid: false, isSettled: false, isPartial: false, isPendingReview: false, isTerminal: false, canCollect: true, hasValidAmounts, total, paid, credit, remaining };
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

export function getInvoiceDocumentTitle(invoice: any) {
  if (invoice?.presentationTitle) return invoice.presentationTitle;
  if (isBookingHoldInvoice(invoice)) return "Hóa đơn cọc giữ phòng";
  return invoice?.documentType === "DEPOSIT" ? "Hóa đơn cọc hợp đồng" : "Hóa đơn tiền phòng kỳ đầu";
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

export type InvoiceOperationsSummary = {
  totalIncome: number;
  paidIncome: number;
  pendingAmount: number;
  overdueAmount: number;
  recoveryRate: number;
  pendingRate: number;
  firstPaymentBundleTotal: number;
  bundleCount: number;
  totalCount: number;
};

export function getInvoiceOperationsSummary(
  invoices: any[] = [],
  billingGroups: Array<{ linked?: boolean; bundleData?: { total?: number }; rows?: any[] }> = [],
  getDirection: (invoice: any) => "INCOME" | "EXPENSE" = () => "INCOME",
): InvoiceOperationsSummary {
  let totalIncome = 0;
  let paidIncome = 0;
  let pendingAmount = 0;
  let overdueAmount = 0;
  let firstPaymentBundleTotal = 0;
  let bundleCount = 0;

  for (const group of billingGroups) {
    if (!group.linked) continue;
    bundleCount += 1;
    const groupTotal = Math.max(0, Number(group.bundleData?.total ?? 0) || 0);
    firstPaymentBundleTotal += groupTotal;
  }

  for (const invoice of invoices) {
    if (["CANCELLED", "WRITTEN_OFF"].includes(String(invoice?.status || "").toUpperCase())) continue;
    const direction = getDirection(invoice);
    const cashflow = getBillingDocumentCashflow(invoice, direction);
    totalIncome += cashflow.totalIncome;
    paidIncome += cashflow.paidIncome;

    if (direction !== "INCOME") continue;
    const remaining = getInvoiceFinancials(invoice).remaining;
    const paymentState = getInvoicePaymentPresentation(invoice);
    if (invoice?.status === "OVERDUE") {
      overdueAmount += remaining;
      pendingAmount += remaining;
    } else if (!paymentState.isTerminal && remaining > 0 && paymentState.hasValidAmounts) {
      pendingAmount += remaining;
    }
  }

  const recoveryRate = totalIncome > 0 ? Math.min(100, Math.round((paidIncome / totalIncome) * 100)) : 0;

  return {
    totalIncome,
    paidIncome,
    pendingAmount,
    overdueAmount,
    recoveryRate,
    pendingRate: totalIncome > 0 ? Math.min(100, Math.round((pendingAmount / totalIncome) * 100)) : 0,
    firstPaymentBundleTotal,
    bundleCount,
    totalCount: invoices.length,
  };
}

export function getInvoiceDocumentCounts(invoices: any[] = []) {
  return {
    totalAll: invoices.length,
    invoiceOnly: invoices.filter((invoice) => invoice?.documentType !== "DEPOSIT").length,
    depositOnly: invoices.filter((invoice) => invoice?.documentType === "DEPOSIT").length,
  };
}
