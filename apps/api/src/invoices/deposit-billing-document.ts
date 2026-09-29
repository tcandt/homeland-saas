type DepositLedgerRow = {
  id: string;
  type: string;
  balanceEffect: unknown;
  reversalOfId?: string | null;
};

export function buildDepositBillingDocument(deposit: any, invoiceCoveredCashEntryIds = new Set<string>()) {
  const security = deposit.type === "SECURITY";
  const ledger: DepositLedgerRow[] = deposit.ledgerEntries || [];
  const reversed = new Set(ledger.map((entry) => entry.reversalOfId).filter(Boolean));
  const activeEntries = ledger.filter((entry) => entry.type !== "REVERSAL" && !reversed.has(entry.id));
  const sum = (type: string) => activeEntries
    .filter((entry) => entry.type === type)
    .reduce((total, entry) => total + Number(entry.balanceEffect || 0), 0);
  // Transfers remain reported on the source booking document or its linked invoice.
  const transferredAmount = Math.max(0, sum("TRANSFER_IN"));
  const invoiceCoveredAmount = activeEntries
    .filter((entry) => entry.type === "CASH_IN" && invoiceCoveredCashEntryIds.has(entry.id))
    .reduce((total, entry) => total + Number(entry.balanceEffect || 0), 0);
  const total = Math.max(0, Number(deposit.amount) - transferredAmount - invoiceCoveredAmount);
  const paidAmount = Math.max(0, sum("CASH_IN") - invoiceCoveredAmount);
  const refundedAmount = Math.max(0, -sum("REFUND"));
  const terminal = ["CANCELLED", "REFUNDED", "CONVERTED_TO_CONTRACT"].includes(deposit.status);
  const status = terminal ? deposit.status
    : paidAmount >= total ? "PAID"
    : deposit.status === "PAID" ? "RECONCILIATION_PENDING"
    : paidAmount > 0 ? "PARTIALLY_PAID"
    : deposit.status === "DRAFT" ? "DRAFT" : "ISSUED";
  const { ledgerEntries: _ledger, ...sourceDeposit } = deposit;
  return {
    id: `deposit:${deposit.id}`,
    documentType: "DEPOSIT" as const,
    sourceId: deposit.id,
    deposit: sourceDeposit,
    code: deposit.code,
    title: security ? "Phiếu cọc hợp đồng" : "Phiếu cọc giữ phòng",
    period: security ? "Cọc hợp đồng" : "Cọc giữ phòng",
    category: security ? "CONTRACT_DEPOSIT" : "HOLDING_DEPOSIT",
    status,
    total,
    paidAmount,
    creditAmount: 0,
    transferredAmount,
    invoiceCoveredAmount,
    refundedAmount,
    depositRequiredAmount: Number(deposit.amount),
    dueDate: deposit.contract?.firstPaymentDate || deposit.contract?.startDate || deposit.expiredAt,
    createdAt: deposit.createdAt,
    customer: deposit.customer,
    room: deposit.room,
    contract: deposit.contract,
    customerId: deposit.customerId,
    contractId: deposit.contractId,
    rentalCycleId: deposit.rentalCycleId,
  };
}
