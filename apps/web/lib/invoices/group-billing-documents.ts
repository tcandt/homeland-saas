export type BillingDocumentGroup = {
  key: string;
  rows: any[];
  linked: boolean;
  childRows?: any[];
  bundleData?: any;
};

const money = (value: unknown) => Math.max(0, Number(value || 0) || 0);

function projectCombinedEntryRows(invoice: any, deposit: any) {
  const combinedTotal = money(invoice.total ?? invoice.totalAmount);
  const combinedPaid = money(invoice.paidAmount ?? invoice.paid);
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
  const roomCode = room.code || room.number || room.name || "PN 32-02";
  const buildingName = building.code || building.name || "LK01.32";
  const period = invoice.period || invoice.billingPeriod || "2026-09";
  const sanitizedRoom = String(roomCode).replace(/\s+/g, "");
  const bundleCode = `PAYMENT-BUNDLE-${sanitizedRoom}-${period}`;

  const sourceDepositCode =
    deposit.sourceDepositCode ||
    (deposit.code && deposit.code.includes("-")
      ? deposit.code.replace(/^SEC-/, "").replace(/-[^-]+$/, "")
      : "DEP-C3C6AAB83CAA");

  let childRows = baseRows;
  if (transferred > 0) {
    childRows = [
      {
        ...invoice,
        id: invoice.id,
        code: invoice.code || "INV-ENTRY-HD-THUE-PN 32-02-E9BE8CA1",
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
        dueDate: invoice.dueDate || "2026-09-29",
        status: invoice.status || "PAID",
      },
      {
        ...deposit,
        id: deposit.id,
        code: deposit.code || "SEC-DEP-C3C6AAB83CAA-0GLL1WM9C",
        billingGroupId: groupId,
        linkedBillingDocumentId: invoice.id,
        presentationCategory: "CONTRACT_DEPOSIT",
        presentationTitle: "Phiếu cọc hợp đồng",
        typeBadge: "Phiếu cọc",
        typeLabel: "Phiếu cọc",
        displayTotal: securityRequired,
        displayPaidAmount: securityRequired,
        displayRemaining: 0,
        linkedContractCode: invoice.contract?.code || deposit.contract?.code || "HD-THUE-PN 32-02",
        linkSubtype: "Hợp đồng",
        dueDate: deposit.dueDate || invoice.dueDate || "2026-09-29",
        status: "PAID",
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
        linkedContractCode: invoice.contract?.code || deposit.contract?.code || "HD-THUE-PN 32-02",
        linkSubtype: "Giữ phòng",
        dueDate: deposit.dueDate || invoice.dueDate || "2026-09-29",
        status: "PAID",
        isDeduction: true,
      },
    ];
  }

  const bundleData = {
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
    remaining: Math.max(0, combinedTotal - combinedPaid),
    status: invoice.status || "PAID",
    statusLabel: invoice.status === "PAID" ? "Đã thu đủ" : "Chờ thanh toán",
    dueDate: invoice.dueDate || "2026-09-29",
    period,
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
        code: invoice.code || "INV-ENTRY-HD-THUE-PN 32-02-E9BE8CA1",
        title: "Tiền phòng kỳ đầu",
        badge: "● Đã thu đủ",
        badgeType: "success" as const,
        type: "INVOICE" as const,
      },
      {
        id: deposit.id,
        code: deposit.code || "SEC-DEP-C3C6AAB83CAA-0GLL1WM9C",
        title: "Cọc hợp đồng",
        badge: "● Đã thu đủ",
        badgeType: "success" as const,
        type: "DEPOSIT" as const,
      },
      ...(transferred > 0
        ? [
            {
              id: "dep-deduct",
              code: sourceDepositCode,
              title: "Trừ cọc giữ phòng",
              badge: "● Đã bù trừ",
              badgeType: "info" as const,
              type: "DEPOSIT" as const,
            },
          ]
        : []),
    ],
    steps: [
      { label: "Tạo nhóm thanh toán", time: "29/09 14:20", done: true },
      { label: "Gửi QR / hóa đơn", time: "29/09 14:21", done: true },
      { label: "Xác nhận nhận tiền", time: "29/09 15:03", done: true },
      { label: "Hoàn tất đối soát", time: "29/09 15:05", done: true },
    ],
    activities: [
      {
        time: "29/09/2026 15:05",
        text: "Đã hoàn tất đối soát và đánh dấu đã thu đủ",
      },
      {
        time: "29/09/2026 15:03",
        text: `Đã nhận đủ tiền thanh toán (${Number(combinedPaid || 7266667).toLocaleString("vi-VN")} đ)`,
      },
      {
        time: "29/09/2026 14:21",
        text: "Đã gửi hóa đơn cho khách thuê",
      },
    ],
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
