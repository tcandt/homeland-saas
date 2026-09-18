import { describe, expect, it, vi } from "vitest";
import {
  resumeManualPaymentOperation,
  type ManualPaymentOperation,
} from "../../lib/invoices/manual-payment-operation";

const paths = ["HOLDING_REFUND", "HOLDING_DEPOSIT", "INVOICE"] as const;

function operationFor(path: (typeof paths)[number]): ManualPaymentOperation {
  return {
    key: `${path}:room-1:customer-1:contract-1:1000000`,
    providerRef: "manual-operation-1",
    issueConfirmed: false,
    amount: 1_000_000,
    autoIssue: true,
  };
}

describe("CORE-08 manual auto-payment operation", () => {
  it.each(paths)("%s creates once and uses one explicit MANUAL providerRef", async (path) => {
    const operation = operationFor(path);
    const createInvoice = vi.fn().mockResolvedValue(`${path}-invoice-1`);
    const issueInvoice = vi.fn().mockResolvedValue(undefined);
    const payInvoice = vi.fn().mockResolvedValue(undefined);

    await resumeManualPaymentOperation({ operation, createInvoice, issueInvoice, payInvoice });

    expect(createInvoice).toHaveBeenCalledTimes(1);
    expect(issueInvoice).toHaveBeenCalledWith(`${path}-invoice-1`);
    expect(payInvoice).toHaveBeenCalledWith({
      id: `${path}-invoice-1`, amount: 1_000_000, provider: "MANUAL", providerRef: "manual-operation-1",
    });
  });

  it("response-lost payment retry reuses the invoice and reference with one financial effect", async () => {
    const operation = operationFor("INVOICE");
    const createInvoice = vi.fn().mockResolvedValue("invoice-1");
    const issueInvoice = vi.fn().mockResolvedValue(undefined);
    const recordedReferences = new Set<string>();
    let paymentAttempts = 0;
    const payInvoice = vi.fn().mockImplementation(async ({ providerRef }: { providerRef: string }) => {
      recordedReferences.add(providerRef); // first request commits, then its response is lost
      paymentAttempts += 1;
      if (paymentAttempts === 1) throw new Error("response lost");
    });

    await expect(resumeManualPaymentOperation({ operation, createInvoice, issueInvoice, payInvoice }))
      .rejects.toThrow("response lost");
    expect(operation.invoiceId).toBe("invoice-1");
    expect(operation.providerRef).toBe("manual-operation-1");

    await resumeManualPaymentOperation({ operation, createInvoice, issueInvoice, payInvoice });

    expect(createInvoice).toHaveBeenCalledTimes(1);
    expect(issueInvoice).toHaveBeenCalledTimes(1);
    expect(payInvoice.mock.calls.map(([input]) => input.providerRef)).toEqual([
      "manual-operation-1", "manual-operation-1",
    ]);
    expect(recordedReferences).toEqual(new Set(["manual-operation-1"]));
  });

  it("does not report completion when issue or payment has not been confirmed", async () => {
    const operation = operationFor("HOLDING_REFUND");
    const payInvoice = vi.fn().mockRejectedValue(new Error("payment unavailable"));

    await expect(resumeManualPaymentOperation({
      operation,
      createInvoice: vi.fn().mockResolvedValue("refund-invoice-1"),
      issueInvoice: vi.fn().mockResolvedValue(undefined),
      payInvoice,
    })).rejects.toThrow("payment unavailable");

    expect(operation.invoiceId).toBe("refund-invoice-1");
    expect(operation.issueConfirmed).toBe(true);
    expect(payInvoice).toHaveBeenCalledTimes(1);
  });
});
