import { ConflictException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import {
  COMBINED_ENTRY_POLICY,
  ENTRY_SECURITY_PERIOD,
  ENTRY_TRANSFER_PERIOD,
  assertCombinedEntryInvoice,
  getCombinedEntryInvoice,
} from "./combined-entry-invoice";

function fixture() {
  const contract = {
    id: "rental-1",
    tenantId: "tenant-1",
    customerId: "customer-1",
    rentalCycleId: "cycle-1",
    termsSnapshot: {
      convertedFromBookingHold: {
        bookingDepositConversion: {
          sourceDepositId: "booking-1",
          securityDepositId: "security-1",
          securityRequired: 8_000_000,
          transferAmount: 1_000_000,
          additionalCashRequired: 7_000_000,
        },
        initialEntryInvoice: {
          invoiceId: "entry-1",
          paymentPolicyVersion: COMBINED_ENTRY_POLICY,
          rentAmount: 4_000_000,
          securityRequired: 8_000_000,
          transferredAmount: 1_000_000,
          additionalCashRequired: 7_000_000,
          amount: 11_000_000,
          sourceDepositId: "booking-1",
          securityDepositId: "security-1",
        },
      },
    },
  };
  const invoice = {
    id: "entry-1",
    tenantId: "tenant-1",
    contractId: "rental-1",
    customerId: "customer-1",
    rentalCycleId: "cycle-1",
    billingKind: "ENTRY",
    total: 11_000_000,
    discount: 0,
    items: [
      { type: "RENT", amount: 4_000_000 },
      { type: "OTHER", amount: 8_000_000, servicePeriod: `${ENTRY_SECURITY_PERIOD}security-1` },
      { type: "DISCOUNT", amount: -1_000_000, servicePeriod: `${ENTRY_TRANSFER_PERIOD}booking-1` },
    ],
  };
  return { contract, invoice };
}

describe("combined ENTRY invoice invariants", () => {
  it("accepts one invoice for first rent + security less transferred booking cash", () => {
    const { contract, invoice } = fixture();
    expect(getCombinedEntryInvoice(contract)).toMatchObject({
      paymentPolicyVersion: COMBINED_ENTRY_POLICY,
      amount: 11_000_000,
    });
    expect(() => assertCombinedEntryInvoice(invoice, contract, getCombinedEntryInvoice(contract)!)).not.toThrow();
  });

  it("accepts one immediate-entry invoice for first rent plus the full security deposit", () => {
    const contract = {
      id: "rental-immediate",
      tenantId: "tenant-1",
      customerId: "customer-1",
      rentalCycleId: "cycle-1",
      termsSnapshot: {
        initialEntryInvoice: {
          invoiceId: "entry-immediate",
          paymentPolicyVersion: COMBINED_ENTRY_POLICY,
          rentAmount: 266_667,
          securityRequired: 8_000_000,
          transferredAmount: 0,
          additionalCashRequired: 8_000_000,
          amount: 8_266_667,
          sourceDepositId: null,
          securityDepositId: "security-immediate",
        },
      },
    };
    const invoice = {
      id: "entry-immediate",
      tenantId: "tenant-1",
      contractId: contract.id,
      customerId: contract.customerId,
      rentalCycleId: contract.rentalCycleId,
      billingKind: "ENTRY",
      total: 8_266_667,
      discount: 0,
      items: [
        { type: "RENT", amount: 266_667 },
        { type: "OTHER", amount: 8_000_000, servicePeriod: `${ENTRY_SECURITY_PERIOD}security-immediate` },
      ],
    };

    const entry = getCombinedEntryInvoice(contract);
    expect(entry).toMatchObject({ invoiceId: invoice.id, sourceDepositId: null });
    expect(() => assertCombinedEntryInvoice(invoice, contract, entry)).not.toThrow();
  });

  it.each([
    ["tenant", { tenantId: "tenant-other" }],
    ["total", { total: 10_000_000 }],
    ["security item", { items: [{ type: "RENT", amount: 4_000_000 }] }],
  ])("rejects a combined ENTRY scope mismatch in %s", (_label, override) => {
    const { contract, invoice } = fixture();
    expect(() => assertCombinedEntryInvoice({ ...invoice, ...override }, contract, getCombinedEntryInvoice(contract)!))
      .toThrow(ConflictException);
  });

  it("rejects a policy marker that does not identify the combined invoice", () => {
    const { contract } = fixture();
    expect(getCombinedEntryInvoice({
      ...contract,
      termsSnapshot: { convertedFromBookingHold: { initialEntryInvoice: { invoiceId: "entry-1", paymentPolicyVersion: "LEGACY" } } },
    })).toBeNull();
  });
});
