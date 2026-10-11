import { getInvoiceFinancials, getInvoicePaymentPresentation } from "./invoice-financials";

export type BillingDocumentGroup = {
  key: string;
  rows: any[];
  linked: boolean;
  childRows?: any[];
  bundleData?: any;
};


const money = (value: unknown) => Math.max(0, Number(value || 0) || 0);

const realText = (...values: unknown[]) => {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
};

const formatEventTime = (value: unknown) => {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
};

const voucherStatus = (document: any) => {
  const presentation = getInvoicePaymentPresentation({
    ...document,
    total: document?.total ?? document?.totalAmount ?? document?.invoiceObligationAmount,
  });
  const tone = presentation.tone === "success" ? "success" : presentation.tone === "muted" ? "info" : "warning";
  return { badge: presentation.label, badgeType: tone as "success" | "info" | "warning" };
};

function projectCombinedEntryRows(invoice: any, deposit: any) {
  const invoiceFinancials = getInvoiceFinancials(invoice);
  const combinedTotal = invoiceFinancials.total;
  const combinedPaid = invoiceFinancials.paid;
  const combinedCredit = invoiceFinancials.credit;
  const depositObligation = money(deposit.invoiceObligationAmount);
  const depositPayable = Math.min(combinedTotal, depositObligation > 0 ? depositObligation : money(deposit.total));
  const rentPayable = Math.max(0, combinedTotal - depositPayable);
  const rentPaid = Math.min(rentPayable, combinedPaid);
  const depositPaid = Math.min(depositPayable, Math.max(0, combinedPaid - rentPaid));
  const groupId = `entry:${invoice.id}`;

  const baseRows = [
    {
      ...invoice,
      billingGroupId: groupId,
      billingGroupSize: 2,
      linkedBillingDocumentId: deposit.id,
      presentationCategory: "RENT",
      presentationTitle: "Hóa đơn tiền phòng kỳ đầu",
      displayTotal: rentPayable,
      displayPaidAmount: rentPaid,
      displayRemaining: Math.max(0, rentPayable - rentPaid),
      combinedPaymentTotal: combinedTotal,
      combinedPaymentPaid: combinedPaid,
    },
    {
      ...deposit,
      billingGroupId: groupId,
      billingGroupSize: 2,
      linkedBillingDocumentId: invoice.id,
      presentationCategory: "CONTRACT_DEPOSIT",
      presentationTitle: "Hóa đơn cọc hợp đồng",
      displayTotal: depositPayable,
      displayPaidAmount: depositPaid,
      displayRemaining: Math.max(0, depositPayable - depositPaid),
      combinedPaymentTotal: combinedTotal,
      combinedPaymentPaid: combinedPaid,
    },
  ];

  // Derive explicit 3-voucher child rows if holding deposit deduction exists
  const transferred = money(
    deposit.transferredAmount ||
      invoice.contract?.termsSnapshot?.initialEntryInvoice?.transferredAmount ||
      invoice.contract?.termsSnapshot?.convertedFromBookingHold?.bookingDepositConversion?.transferAmount ||
      (Array.isArray(invoice.items)
        ? Math.abs(Number(invoice.items.find((it: any) => it.type === "DISCOUNT" || Number(it.amount || 0) < 0)?.amount || 0))
        : 0)
  );

  const securityRequired = money(
    deposit.depositRequiredAmount ||
      deposit.securityRequired ||
      invoice.contract?.termsSnapshot?.initialEntryInvoice?.securityRequired ||
      (transferred > 0 ? depositPayable + transferred : depositPayable)
  );

  const room = invoice.contract?.room || invoice.room || deposit.room || {};
  const building = room.building || invoice.building || deposit.building || {};
  const roomCode = realText(room.code, room.number, room.name);
  const buildingName = realText(building.code, building.name);
  const period = realText(invoice.period, invoice.billingPeriod, invoice.usagePeriod);
  const bundleCode = `PAYMENT-BUNDLE-${realText(invoice.code, invoice.id)}`;

  const sourceDepositCode =
    deposit.sourceDepositCode ||
    realText(deposit.code, deposit.id);

  let childRows = baseRows;
  if (transferred > 0) {
    childRows = [
      {
        ...invoice,
        id: invoice.id,
        code: realText(invoice.code, invoice.id),
        billingGroupId: groupId,
        linkedBillingDocumentId: deposit.id,
        presentationCategory: "RENT",
        presentationTitle: "Hóa đơn tiền phòng kỳ đầu",
        typeBadge: "Hóa đơn",
        typeLabel: "Hóa đơn",
        displayTotal: rentPayable,
        displayPaidAmount: rentPaid,
        displayRemaining: Math.max(0, rentPayable - rentPaid),
        combinedPaymentTotal: combinedTotal,
        combinedPaymentPaid: combinedPaid,
        period,
        dueDate: invoice.dueDate,
        status: invoice.status,
      },
      {
        ...deposit,
        id: deposit.id,
        code: realText(deposit.code, deposit.id),
        billingGroupId: groupId,
        linkedBillingDocumentId: invoice.id,
        presentationCategory: "CONTRACT_DEPOSIT",
        presentationTitle: "Phiếu cọc hợp đồng",
        typeBadge: "Phiếu cọc",
        typeLabel: "Phiếu cọc",
        displayTotal: securityRequired,
        displayPaidAmount: depositPaid,
        displayRemaining: Math.max(0, securityRequired - depositPaid),
        linkedContractCode: realText(invoice.contract?.code, deposit.contract?.code),
        linkSubtype: "Hợp đồng",
        dueDate: deposit.dueDate || invoice.dueDate,
        status: deposit.status,
      },
      {
        ...deposit,
        id: `dep-deduction:${deposit.id}`,
        code: sourceDepositCode,
        documentType: "DEPOSIT",
        billingGroupId: groupId,
        linkedBillingDocumentId: invoice.id,
        presentationCategory: "HOLDING_DEPOSIT",
        presentationTitle: "Trừ cọc giữ phòng đã thanh toán",
        typeBadge: "Phiếu cọc",
        typeLabel: "Phiếu cọc",
        displayTotal: -transferred,
        displayPaidAmount: -transferred,
        displayRemaining: 0,
        linkedContractCode: realText(invoice.contract?.code, deposit.contract?.code),
        linkSubtype: "Giữ phòng",
        dueDate: deposit.dueDate || invoice.dueDate,
        status: deposit.status,
        isDeduction: true,
      },
    ];
  }

  const confirmedPayment = Array.isArray(invoice.payments)
    ? invoice.payments.find((payment: any) => payment?.status === "CONFIRMED")
    : undefined;
  const settledRequest = Array.isArray(invoice.paymentRequests)
    ? invoice.paymentRequests.find((request: any) => request?.status === "PAID")
    : undefined;
  const createdAt = realText(invoice.createdAt, deposit.createdAt);
  const paidAt = realText(confirmedPayment?.paidAt, settledRequest?.paidAt);
  const invoiceVoucherStatus = voucherStatus(invoice);
  const depositVoucherStatus = voucherStatus(deposit);
  const bundlePresentation = getInvoicePaymentPresentation({
    ...invoice,
    total: combinedTotal,
    paidAmount: combinedPaid,
    creditAmount: combinedCredit,
  });
  const activities = [
    ...(paidAt
      ? [{ time: formatEventTime(paidAt), text: `Đã ghi nhận thanh toán ${combinedPaid.toLocaleString("vi-VN")} đ` }]
      : []),
    ...(createdAt
      ? [{ time: formatEventTime(createdAt), text: "Đã tạo nghĩa vụ thanh toán đầu tiên" }]
      : []),
  ].filter((activity) => activity.time);

  const bundleData = {
    invoiceId: invoice.id,
    bundleCode,
    title: "Đợt thanh toán đầu tiên",
    modalTitle: "Chi tiết đợt thanh toán đầu tiên",
    badgeLabel: transferred > 0 ? "3 liên kết" : "2 liên kết",
    subtitle:
      transferred > 0
        ? "Tiền phòng kỳ đầu + Cọc hợp đồng - Trừ cọc giữ phòng"
        : "Tiền phòng kỳ đầu + Cọc hợp đồng",
    bannerText:
      transferred > 0
        ? "Đã gộp 3 phiếu liên kết • Tiền phòng kỳ đầu + Cọc hợp đồng - Cọc giữ phòng đã thanh toán"
        : "Đã gộp 2 phiếu liên kết • Tiền phòng kỳ đầu + Cọc hợp đồng",
    total: combinedTotal,
    paid: combinedPaid,
    remaining: bundlePresentation.remaining,
    credit: combinedCredit,
    status: invoice.status,
    statusLabel: bundlePresentation.label,
    dueDate: invoice.dueDate || "",
    period,
    createdAt,
    customer: invoice.customer || deposit.customer,
    room: { roomCode, buildingName },
    contract: invoice.contract || deposit.contract,
    items: [
      {
        stt: 1,
        name: "Tiền thuê tháng đầu (ACTUAL_DAYS_V1)",
        amount: rentPayable,
      },
      {
        stt: 2,
        name: "Tiền cọc hợp đồng",
        amount: securityRequired,
      },
      ...(transferred > 0
        ? [
            {
              stt: 3,
              name: "Trừ cọc giữ phòng đã thanh toán",
              amount: -transferred,
              isNegative: true,
            },
          ]
        : []),
    ],
    vouchers: [
      {
        id: invoice.id,
        code: realText(invoice.code, invoice.id),
        title: "Tiền phòng kỳ đầu",
        ...invoiceVoucherStatus,
        type: "INVOICE" as const,
      },
      {
        id: deposit.id,
        code: realText(deposit.code, deposit.id),
        title: "Cọc hợp đồng",
        ...depositVoucherStatus,
        type: "DEPOSIT" as const,
      },
      ...(transferred > 0
        ? [
            {
              id: `dep-deduct:${deposit.id}`,
              code: sourceDepositCode,
              title: "Trừ cọc giữ phòng",
              badge: "Đã bù trừ",
              badgeType: "info" as const,
              type: "DEPOSIT" as const,
            },
          ]
        : []),
    ],
    paymentMethod: realText(confirmedPayment?.provider, settledRequest ? "SEPAY" : ""),
    transactionRef: realText(confirmedPayment?.providerRef, settledRequest?.providerTransactionId),
    paymentCode: realText(settledRequest?.paymentCode, invoice.paymentRequests?.[0]?.paymentCode),
    steps: [
      ...(createdAt ? [{ label: "Tạo nghĩa vụ thanh toán", time: formatEventTime(createdAt), done: true }] : []),
      ...(paidAt ? [{ label: "Xác nhận nhận tiền", time: formatEventTime(paidAt), done: true }] : []),
    ],
    activities,
  };

  return { baseRows, childRows, bundleData };
}
/**
 * A combined ENTRY remains one authoritative invoice/payment. This helper only
 * projects its rent and security components into two linked table rows.
 */
export function groupBillingDocuments(documents: any[]): BillingDocumentGroup[] {
  const byId = new Map(documents.filter((document) => document?.id).map((document) => [document.id, document]));
  const linkedDepositByInvoice = new Map<string, any>();
  for (const document of documents) {
    if (document?.documentType === "DEPOSIT" && document.linkedInvoiceId && byId.has(document.linkedInvoiceId)) {
      linkedDepositByInvoice.set(document.linkedInvoiceId, document);
    }
  }

  const used = new Set<string>();
  const groups: BillingDocumentGroup[] = [];
  for (const document of documents) {
    if (!document?.id || used.has(document.id)) continue;
    const invoiceId = document.documentType === "DEPOSIT" ? document.linkedInvoiceId : document.id;
    const invoice = byId.get(invoiceId);
    const deposit = linkedDepositByInvoice.get(invoiceId);
    if (invoice && deposit && !used.has(invoice.id) && !used.has(deposit.id)) {
      const projection = projectCombinedEntryRows(invoice, deposit);
      groups.push({
        key: `entry:${invoice.id}`,
        rows: projection.baseRows,
        childRows: projection.childRows,
        bundleData: projection.bundleData,
        linked: true,
      });
      used.add(invoice.id);
      used.add(deposit.id);
      continue;
    }
    groups.push({ key: document.billingGroupId || document.id, rows: [document], linked: false });
    used.add(document.id);
  }
  return groups;
}
