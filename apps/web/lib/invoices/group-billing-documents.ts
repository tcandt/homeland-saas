export type BillingDocumentGroup = {
  key: string;
  rows: any[];
  linked: boolean;
};

const money = (value: unknown) => Math.max(0, Number(value || 0) || 0);

function projectCombinedEntryRows(invoice: any, deposit: any) {
  const combinedTotal = money(invoice.total ?? invoice.totalAmount);
  const combinedPaid = money(invoice.paidAmount ?? invoice.paid);
  const depositPayable = Math.min(combinedTotal, money(deposit.invoiceObligationAmount));
  const rentPayable = Math.max(0, combinedTotal - depositPayable);
  const rentPaid = Math.min(rentPayable, combinedPaid);
  const depositPaid = Math.min(depositPayable, Math.max(0, combinedPaid - rentPaid));
  const groupId = `entry:${invoice.id}`;

  return [
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
      groups.push({ key: `entry:${invoice.id}`, rows: projectCombinedEntryRows(invoice, deposit), linked: true });
      used.add(invoice.id);
      used.add(deposit.id);
      continue;
    }
    groups.push({ key: document.billingGroupId || document.id, rows: [document], linked: false });
    used.add(document.id);
  }
  return groups;
}
