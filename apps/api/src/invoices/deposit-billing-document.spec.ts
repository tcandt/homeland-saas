import { describe, expect, it } from "vitest";
import { buildDepositBillingDocument as buildSecurityDepositBillingDocument } from "./deposit-billing-document";

const entry = (id: string, type: string, balanceEffect: number, reversalOfId?: string) =>
  ({ id, type, balanceEffect, reversalOfId });
const deposit = (overrides: Record<string, unknown> = {}) => ({
  id: "security-1", code: "SEC-001", type: "SECURITY", amount: 8_000_000, status: "PENDING",
  customerId: "customer-1", contractId: "contract-1", rentalCycleId: "cycle-1",
  createdAt: new Date("2026-09-29"), ledgerEntries: [], ...overrides,
});

describe("security deposit billing document", () => {
  it("reports only new cash, with the transferred booking credit separately", () => {
    const source = deposit({ status: "PAID", ledgerEntries: [
      entry("transfer", "TRANSFER_IN", 1_000_000), entry("cash", "CASH_IN", 7_000_000),
    ] });
    const document = buildSecurityDepositBillingDocument(source);
    expect(document).toMatchObject({
      id: "deposit:security-1", sourceId: "security-1", documentType: "DEPOSIT",
      total: 7_000_000, paidAmount: 7_000_000, transferredAmount: 1_000_000,
      depositRequiredAmount: 8_000_000, creditAmount: 0, status: "PAID",
    });
    expect(document.deposit.ledgerEntries).toBeUndefined();
    expect(source.ledgerEntries).toHaveLength(2);
  });

  it.each([
    [0, "ISSUED"], [2_000_000, "PARTIALLY_PAID"], [7_000_000, "PAID"],
  ])("reports a %s cash collection as %s", (cash, status) => {
    expect(buildSecurityDepositBillingDocument(deposit({ ledgerEntries: [
      entry("transfer", "TRANSFER_IN", 1_000_000), entry("cash", "CASH_IN", cash),
    ] }))).toMatchObject({ total: 7_000_000, paidAmount: cash, status });
  });

  it("does not infer cash from a legacy PAID flag", () => {
    expect(buildSecurityDepositBillingDocument(deposit({ status: "PAID" })))
      .toMatchObject({ paidAmount: 0, total: 8_000_000, status: "RECONCILIATION_PENDING" });
  });

  it("excludes cash already recorded on its linked invoice", () => {
    expect(buildSecurityDepositBillingDocument(deposit({ status: "PAID", ledgerEntries: [
      entry("transfer", "TRANSFER_IN", 1_000_000), entry("cash", "CASH_IN", 7_000_000),
    ] }), new Set(["cash"]))).toMatchObject({
      total: 0, paidAmount: 0, invoiceCoveredAmount: 7_000_000, transferredAmount: 1_000_000, status: "PAID",
    });
  });

  it("reports refund cash-out separately from gross collection", () => {
    expect(buildSecurityDepositBillingDocument(deposit({ status: "REFUNDED", ledgerEntries: [
      entry("transfer", "TRANSFER_IN", 1_000_000), entry("cash", "CASH_IN", 7_000_000),
      entry("refund", "REFUND", -8_000_000),
    ] }))).toMatchObject({ total: 7_000_000, paidAmount: 7_000_000, refundedAmount: 8_000_000, status: "REFUNDED" });
  });

  it("does not count pending refunds, deductions or reversed refunds as cash-out", () => {
    expect(buildSecurityDepositBillingDocument(deposit({ ledgerEntries: [
      entry("cash", "CASH_IN", 8_000_000), entry("refund", "REFUND", -8_000_000),
      entry("deduct", "DEDUCT", -500_000), entry("reverse", "REVERSAL", 8_000_000, "refund"),
    ] }))).toMatchObject({ paidAmount: 8_000_000, refundedAmount: 0 });
  });

  it("removes reversed cash collections", () => {
    expect(buildSecurityDepositBillingDocument(deposit({ status: "PAID", ledgerEntries: [
      entry("transfer", "TRANSFER_IN", 1_000_000), entry("cash", "CASH_IN", 7_000_000),
      entry("reverse", "REVERSAL", -7_000_000, "cash"),
    ] }))).toMatchObject({ total: 7_000_000, paidAmount: 0, status: "RECONCILIATION_PENDING" });
  });

  it("removes reversed transfers from the booking credit", () => {
    expect(buildSecurityDepositBillingDocument(deposit({ ledgerEntries: [
      entry("transfer", "TRANSFER_IN", 1_000_000), entry("cash", "CASH_IN", 7_000_000),
      entry("reverse", "REVERSAL", -1_000_000, "transfer"),
    ] }))).toMatchObject({ total: 8_000_000, paidAmount: 7_000_000, transferredAmount: 0 });
  });

  it("does not report new cash when fully funded by transfer", () => {
    expect(buildSecurityDepositBillingDocument(deposit({ ledgerEntries: [
      entry("transfer", "TRANSFER_IN", 8_000_000),
    ] }))).toMatchObject({ total: 0, paidAmount: 0, transferredAmount: 8_000_000, status: "PAID" });
  });

  it("preserves directly collected booking cash after conversion", () => {
    expect(buildSecurityDepositBillingDocument(deposit({
      type: "BOOKING", amount: 1_000_000, status: "CONVERTED_TO_CONTRACT", ledgerEntries: [
        entry("cash", "CASH_IN", 1_000_000), entry("transfer", "TRANSFER_OUT", -1_000_000),
      ],
    }))).toMatchObject({ total: 1_000_000, paidAmount: 1_000_000, status: "CONVERTED_TO_CONTRACT", category: "HOLDING_DEPOSIT", title: "Phiếu cọc giữ phòng" });
  });

  it.each(["CANCELLED", "REFUNDED"])("preserves terminal status %s", (status) => {
    expect(buildSecurityDepositBillingDocument(deposit({ status }))).toMatchObject({ status });
  });

  it("preserves draft and uses the contract's first payment date", () => {
    const firstPaymentDate = new Date("2026-10-01");
    expect(buildSecurityDepositBillingDocument(deposit({ status: "DRAFT", contract: {
      firstPaymentDate, startDate: new Date("2026-09-29"),
    } }))).toMatchObject({ status: "DRAFT", dueDate: firstPaymentDate });
  });
});
