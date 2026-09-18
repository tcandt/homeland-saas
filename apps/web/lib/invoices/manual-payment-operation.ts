export type ManualPaymentOperation = {
  key: string;
  providerRef: string;
  invoiceId?: string;
  issueConfirmed: boolean;
  amount: number;
  autoIssue: boolean;
};

type ResumeManualPaymentArgs = {
  operation: ManualPaymentOperation;
  createInvoice: () => Promise<string | undefined>;
  issueInvoice: (invoiceId: string) => Promise<unknown>;
  payInvoice: (input: {
    id: string;
    amount: number;
    provider: "MANUAL";
    providerRef: string;
  }) => Promise<unknown>;
};

/**
 * Persists the invoice id and provider reference in the caller-owned operation.
 * A retry therefore resumes the existing financial operation instead of creating
 * a second invoice or minting another payment reference.
 */
export async function resumeManualPaymentOperation({
  operation,
  createInvoice,
  issueInvoice,
  payInvoice,
}: ResumeManualPaymentArgs) {
  if (!operation.invoiceId) {
    operation.invoiceId = await createInvoice();
  }
  if (!operation.invoiceId) {
    throw new Error("Không tìm thấy hóa đơn để tiếp tục thanh toán");
  }

  if (operation.autoIssue && !operation.issueConfirmed) {
    await issueInvoice(operation.invoiceId);
    operation.issueConfirmed = true;
  }

  await payInvoice({
    id: operation.invoiceId,
    amount: operation.amount,
    provider: "MANUAL",
    providerRef: operation.providerRef,
  });
}
