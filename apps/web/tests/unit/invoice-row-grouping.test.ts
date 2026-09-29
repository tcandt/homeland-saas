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
});
