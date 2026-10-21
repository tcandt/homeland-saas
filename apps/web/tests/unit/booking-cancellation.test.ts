import { describe, expect, it } from "vitest";
import {
  buildBookingCancellationAmounts,
  canCancelBookingContract,
} from "../../lib/contracts/booking-cancellation";

const contract = (overrides: Record<string, unknown> = {}) => ({
  id: "booking-contract-1",
  code: "HD-COC-001",
  isBookingHold: true,
  status: "PENDING_APPROVAL",
  rentalCycleId: "cycle-1",
  bookingInvoice: { id: "booking-invoice-1" },
  termsSnapshot: { bookingCommand: { depositId: "deposit-1", invoiceId: "booking-invoice-1" } },
  ...overrides,
});

const paidDeposit = (overrides: Record<string, unknown> = {}) => ({
  id: "deposit-1",
  type: "BOOKING",
  status: "PAID",
  contractId: "booking-contract-1",
  rentalCycleId: "cycle-1",
  ...overrides,
});

describe("booking cancellation amounts", () => {
  it.each([
    [800_000, "FULL", "", { refundAmount: 800_000, keepAmount: 0, deductAmount: 0 }],
    [800_000, "PARTIAL", "300000", { refundAmount: 300_000, keepAmount: 500_000, deductAmount: 0 }],
    [800_000, "NONE", "", { refundAmount: 0, keepAmount: 800_000, deductAmount: 0 }],
    [0, "FULL", "", { refundAmount: 0, keepAmount: 0, deductAmount: 0 }],
    [0, "NONE", "", { refundAmount: 0, keepAmount: 0, deductAmount: 0 }],
  ])("allocates canonical balance %i with %s", (balance, mode, input, expected) => {
    expect(buildBookingCancellationAmounts(balance, mode, input)).toEqual(expected);
  });

  it.each([
    [800_000, "", ""],
    [800_000, "PARTIAL", ""],
    [800_000, "PARTIAL", "0"],
    [800_000, "PARTIAL", "800000"],
    [800_000, "PARTIAL", "800001"],
    [0, "PARTIAL", "0"],
    [-1, "NONE", ""],
    [1.5, "NONE", ""],
    [Number.MAX_SAFE_INTEGER + 1, "NONE", ""],
  ])("rejects unsafe balance or allocation %o/%s/%s", (balance, mode, input) => {
    expect(() => buildBookingCancellationAmounts(balance, mode, input)).toThrow();
  });
});

describe("booking cancellation eligibility", () => {
  it("allows paid booking contracts, including an expired booking contract", () => {
    expect(canCancelBookingContract(contract(), paidDeposit())).toBe(true);
    expect(canCancelBookingContract(contract({ status: "EXPIRED" }), paidDeposit())).toBe(true);
  });

  it.each(["ACTIVE", "CONVERTED", "CANCELLED", "TERMINATED", "DRAFT_RENTAL"])("blocks non-booking lifecycle status %s", (status) => {
    expect(canCancelBookingContract(contract({ status }), paidDeposit())).toBe(false);
  });

  it("allows a pending deposit only when the current modern booking command points at its invoice", () => {
    expect(canCancelBookingContract(contract(), paidDeposit({ status: "PENDING" }))).toBe(true);
    expect(canCancelBookingContract(contract({ termsSnapshot: { bookingCommand: { depositId: "deposit-1", invoiceId: "other" } } }), paidDeposit({ status: "PENDING" }))).toBe(false);
    expect(canCancelBookingContract(contract({ bookingInvoice: { id: "other" } }), paidDeposit({ status: "PENDING" }))).toBe(false);
    expect(canCancelBookingContract(contract({ termsSnapshot: {} }), paidDeposit({ status: "PENDING" }))).toBe(false);
  });

  it.each([
    ["reconciliation error on contract", contract({ reconciliationError: "PROOF_INVALID" }), paidDeposit()],
    ["reconciliation error on deposit", contract(), paidDeposit({ reconciliationError: "PROOF_INVALID" })],
    ["security deposit", contract(), paidDeposit({ type: "SECURITY" })],
    ["foreign contract", contract(), paidDeposit({ contractId: "other-contract" })],
    ["foreign rental cycle", contract(), paidDeposit({ rentalCycleId: "other-cycle" })],
    ["converted booking with linked rental", contract({ bookingConversion: { rentalContract: { id: "rental-1" } } }), paidDeposit()],
    ["non-booking contract", contract({ isBookingHold: false, code: "HD-THUE-001" }), paidDeposit()],
    ["missing deposit id", contract(), paidDeposit({ id: "" })],
  ])("blocks %s", (_name, sourceContract, deposit) => {
    expect(canCancelBookingContract(sourceContract, deposit)).toBe(false);
  });
});
