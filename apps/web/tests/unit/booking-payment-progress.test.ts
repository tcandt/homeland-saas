import { describe, expect, it } from "vitest";
import { getBookingCollectionProgress, getBookingDepositRefreshInterval } from "../../lib/contracts/booking-conversion";
import { getInvoicePaymentHistory } from "../../lib/invoices/invoice-payment-history";

describe("booking collection evidence", () => {
  const deposit = { type: "BOOKING", amount: 1_000_000, status: "PENDING", bookingHold: { isActive: true } };
  it("never treats a future room hold or a payment request as collected cash", () => {
    expect(getBookingCollectionProgress({ ...deposit, paymentRequest: { id: "qr", status: "CONFIRMED" } }))
      .toEqual({ fullyCollected: false, qrSent: false });
  });
  it("keeps partial collection pending and requires cash, not invoice credits", () => {
    const bookingInvoice = { id: "invoice", paidAmount: 400_000, remainingAmount: 600_000 };
    expect(getBookingCollectionProgress({ ...deposit, bookingInvoice }).fullyCollected).toBe(false);
    expect(getBookingCollectionProgress({ ...deposit, status: "PAID", bookingInvoice: { ...bookingInvoice, remainingAmount: 0 } }).fullyCollected).toBe(false);
    expect(getBookingCollectionProgress({ ...deposit, status: "PAID", bookingInvoice: { ...bookingInvoice, paidAmount: 1_000_000, remainingAmount: 0 } }).fullyCollected).toBe(true);
  });
  it("uses actual Zalo delivery metadata, not QR creation", () => {
    expect(getBookingCollectionProgress({ paymentRequest: { metadata: { zaloDispatchStartedAt: "now" } } }).qrSent).toBe(false);
    expect(getBookingCollectionProgress({ paymentRequest: { metadata: { zaloSentAt: "now" } } }).qrSent).toBe(true);
  });
  it("polls cash-only pending bookings without requiring a SePay request", () => {
    expect(getBookingDepositRefreshInterval(deposit)).toBe(5000);
    expect(getBookingDepositRefreshInterval({ ...deposit, status: "PAID" })).toBe(false);
  });
});

describe("invoice receipt history", () => {
  const cash = { id: "cash", status: "CONFIRMED", amount: 1_000_000, provider: "MANUAL", providerRef: "CASH:receipt", paidAt: "2026-10-21T02:00:00Z" };
  it("reads allocated receipts and does not double-count direct payments", () => {
    expect(getInvoicePaymentHistory({ id: "invoice", allocations: [{ invoiceId: "invoice", amount: 400_000, payment: cash }], payments: [cash] }))
      .toEqual([{ id: "cash", amount: 400_000, paidAt: cash.paidAt, method: "Tiền mặt" }]);
  });
  it("shows partial cash then transfer with actual timestamps and methods", () => {
    const transfer = { ...cash, id: "bank", providerRef: "BANK_TRANSFER:receipt", paidAt: "2026-10-21T03:00:00Z" };
    const history = getInvoicePaymentHistory({ allocations: [{ amount: 600_000, payment: transfer }, { amount: 400_000, payment: cash }] });
    expect(history.map(row => [row.amount, row.method])).toEqual([[400_000, "Tiền mặt"], [600_000, "Chuyển khoản do Admin xác nhận"]]);
  });
  it("does not count unconfirmed, deleted, invalid, or foreign allocated receipts", () => {
    expect(getInvoicePaymentHistory({ id: "invoice", payments: [{ ...cash, status: "PENDING" }, { ...cash, deletedAt: "now" }, { ...cash, amount: "invalid" }], allocations: [{ invoiceId: "other", amount: 10, payment: cash }] })).toEqual([]);
  });
});
