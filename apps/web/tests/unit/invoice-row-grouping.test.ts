import { describe, expect, it } from "vitest";
import { groupBillingDocuments } from "../../lib/invoices/group-billing-documents";
import { getBillingDocumentCashflow } from "../../lib/invoices/invoice-financials";

const invoice = {
  id: "invoice-entry-1",
  code: "INV-ENTRY-1",
  total: 7_266_667,
  paidAmount: 7_266_667,
  status: "PAID",
};
const deposit = {
  id: "deposit:security-1",
  documentType: "DEPOSIT",
  sourceId: "security-1",
  code: "SECURITY-1",
  category: "CONTRACT_DEPOSIT",
  total: 0,
  paidAmount: 0,
  depositRequiredAmount: 8_000_000,
  transferredAmount: 1_000_000,
  invoiceObligationAmount: 7_000_000,
  linkedInvoiceId: "invoice-entry-1",
  status: "CONVERTED_TO_CONTRACT",
};

describe("combined ENTRY invoice table grouping", () => {
  it("projects one payment into two linked rows under one group", () => {
    const groups = groupBillingDocuments([deposit, invoice]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ key: "entry:invoice-entry-1", linked: true });
    expect(groups[0].rows).toMatchObject([
      { id: "invoice-entry-1", presentationCategory: "RENT", displayTotal: 266_667, displayPaidAmount: 266_667 },
      { id: "deposit:security-1", presentationCategory: "CONTRACT_DEPOSIT", displayTotal: 7_000_000, displayPaidAmount: 7_000_000 },
    ]);
    expect(new Set(groups[0].rows.map((row) => row.billingGroupId))).toEqual(new Set(["entry:invoice-entry-1"]));
  });

  it("keeps authoritative cashflow at one combined payment", () => {
    const rows = groupBillingDocuments([invoice, deposit])[0].rows;
    const totalCashflow = rows.reduce((sum, row) => sum + getBillingDocumentCashflow(row, "INCOME").paidIncome, 0);
    expect(totalCashflow).toBe(7_266_667);
    expect(rows[0].total).toBe(7_266_667);
    expect(rows[1].total).toBe(0);
  });

  it("keeps unrelated documents in separate numbered groups", () => {
    const groups = groupBillingDocuments([invoice, { id: "invoice-2", total: 500_000 }]);
    expect(groups.map((group) => group.rows.map((row) => row.id))).toEqual([
      ["invoice-entry-1"],
      ["invoice-2"],
    ]);
  });

  it("does not fabricate identifiers, dates, locations, or statuses when source fields are absent", () => {
    const sparseInvoice = { id: "invoice-sparse", total: 100_000, paidAmount: 0 };
    const sparseDeposit = {
      id: "deposit-sparse",
      documentType: "DEPOSIT",
      linkedInvoiceId: "invoice-sparse",
      invoiceObligationAmount: 50_000,
    };

    const group = groupBillingDocuments([sparseInvoice, sparseDeposit])[0];

    expect(group.bundleData).toMatchObject({
      invoiceId: "invoice-sparse",
      bundleCode: "PAYMENT-BUNDLE-invoice-sparse",
      dueDate: "",
      period: "",
      room: { roomCode: "", buildingName: "" },
      activities: [],
      steps: [],
      paymentMethod: "",
      transactionRef: "",
      paymentCode: "",
    });
    expect(group.bundleData.vouchers).toMatchObject([
      { code: "invoice-sparse", badge: "Chờ thanh toán" },
      { code: "deposit-sparse", badge: "Chờ thanh toán" },
    ]);
  });

  it("uses real payment timestamps and allocation values in the projected bundle", () => {
    const paidInvoice = {
      ...invoice,
      createdAt: "2026-10-03T08:00:00+07:00",
      paidAmount: 6_000_000,
      status: "PARTIALLY_PAID",
      payments: [{
        status: "CONFIRMED",
        provider: "MANUAL",
        providerRef: "REAL-REF-1",
        paidAt: "2026-10-03T09:15:00+07:00",
      }],
    };
    const group = groupBillingDocuments([paidInvoice, deposit])[0];

    expect(group.childRows?.[1]).toMatchObject({
      displayTotal: 8_000_000,
      displayPaidAmount: 5_733_333,
      displayRemaining: 2_266_667,
    });
    expect(group.bundleData).toMatchObject({
      paymentMethod: "MANUAL",
      transactionRef: "REAL-REF-1",
    });
    expect(group.bundleData.activities).toHaveLength(2);
    expect(group.bundleData.activities[0].time).toContain("03/10/2026");
    expect(group.bundleData.activities[0].time).toContain("09:15");
    expect(group.bundleData.activities[1].time).toContain("08:00");
  });

  it("uses GMT+7 at the UTC day boundary regardless of the machine timezone", () => {
    const paidInvoice = {
      ...invoice,
      createdAt: "2026-10-04T16:30:00Z",
      payments: [{ status: "CONFIRMED", paidAt: "2026-10-04T17:30:00Z" }],
    };
    const group = groupBillingDocuments([paidInvoice, deposit])[0];
    expect(group.bundleData.activities[0].time).toContain("05/10/2026");
    expect(group.bundleData.activities[0].time).toContain("00:30");
    expect(group.bundleData.activities[1].time).toContain("04/10/2026");
    expect(group.bundleData.activities[1].time).toContain("23:30");
  });
});
