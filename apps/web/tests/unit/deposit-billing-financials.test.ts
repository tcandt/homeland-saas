import { describe, expect, it } from "vitest";
import { getBillingDocumentCashflow, getInvoiceFinancials } from "../../lib/invoices/invoice-financials";

describe("deposit documents on the invoice list", () => {
  it("counts 1M booking and 7M additional cash once, not the transferred credit", () => {
    const documents = [
      { total: 1_000_000, paidAmount: 1_000_000, status: "PAID" },
      { documentType: "DEPOSIT", total: 7_000_000, paidAmount: 7_000_000, transferredAmount: 1_000_000, status: "PAID" },
    ];
    expect(documents.reduce((sum, doc) => sum + getBillingDocumentCashflow(doc, "INCOME").paidIncome, 0)).toBe(8_000_000);
  });

  it("does not add linked invoice cash a second time", () => {
    const invoice = { total: 8_000_000, paidAmount: 8_000_000, status: "PAID" };
    const deposit = { documentType: "DEPOSIT", total: 0, paidAmount: 0, invoiceCoveredAmount: 8_000_000, status: "PAID" };
    const amounts = [invoice, deposit].map((doc) => getBillingDocumentCashflow(doc, "INCOME"));
    expect(amounts.reduce((sum, doc) => sum + doc.totalIncome, 0)).toBe(8_000_000);
    expect(amounts.reduce((sum, doc) => sum + doc.paidIncome, 0)).toBe(8_000_000);
  });

  it("preserves directly collected booking cash after transfer to security", () => {
    const documents = [
      { documentType: "DEPOSIT", total: 1_000_000, paidAmount: 1_000_000, status: "CONVERTED_TO_CONTRACT" },
      { documentType: "DEPOSIT", total: 7_000_000, paidAmount: 7_000_000, transferredAmount: 1_000_000, status: "PAID" },
    ];
    expect(documents.reduce((sum, doc) => sum + getBillingDocumentCashflow(doc, "INCOME").paidIncome, 0)).toBe(8_000_000);
    expect(getInvoiceFinancials(documents[0]).remaining).toBe(0);
  });

  it("subtracts security refunds including transferred booking cash from net cashflow", () => {
    const documents = [
      { total: 1_000_000, paidAmount: 1_000_000 },
      { documentType: "DEPOSIT", total: 7_000_000, paidAmount: 7_000_000, refundedAmount: 8_000_000, status: "REFUNDED" },
    ];
    const net = documents.reduce((sum, doc) => {
      const cashflow = getBillingDocumentCashflow(doc, "INCOME");
      return sum + cashflow.paidIncome - cashflow.paidExpense;
    }, 0);
    expect(net).toBe(0);
    expect(getInvoiceFinancials(documents[1])).toMatchObject({ refunded: 8_000_000, remaining: 0 });
  });

  it.each(["REFUNDED", "CANCELLED"])("does not show collection debt for a %s deposit", (status) => {
    expect(getInvoiceFinancials({ documentType: "DEPOSIT", total: 7_000_000, paidAmount: 2_000_000, status }).remaining).toBe(0);
  });

  it("keeps existing invoice expense behavior unchanged", () => {
    expect(getBillingDocumentCashflow({ total: 500_000, paidAmount: 500_000 }, "EXPENSE"))
      .toEqual({ totalIncome: 0, paidIncome: 0, totalExpense: 500_000, paidExpense: 500_000 });
  });
});
