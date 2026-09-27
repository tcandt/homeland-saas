import { beforeEach, describe, expect, it, vi } from "vitest";

const { invalidateQueries, mutationOptions } = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
  mutationOptions: { current: undefined as unknown },
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
  useQueryClient: vi.fn(() => ({ invalidateQueries })),
  useMutation: vi.fn((options) => {
    mutationOptions.current = options;
    return options;
  }),
}));

vi.mock("../api/invoices.api", () => ({
  invoicesApi: { pay: vi.fn() },
}));

import { financeKeys } from "./finance.queries";
import { invoiceKeys, usePayInvoiceMutation } from "./invoices.queries";

type PayInvoiceMutationOptions = {
  onSuccess: (
    data: unknown,
    variables: {
      id: string;
      amount: number;
      provider: "MANUAL";
      providerRef: string;
    },
  ) => void;
};

describe("usePayInvoiceMutation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mutationOptions.current = undefined;
    usePayInvoiceMutation();
  });

  it("refreshes invoice lists, the paid invoice, and all finance queries", () => {
    const options = mutationOptions.current as PayInvoiceMutationOptions;

    options.onSuccess(undefined, {
      id: "invoice-123",
      amount: 500_000,
      provider: "MANUAL",
      providerRef: "manual-receipt-123",
    });

    expect(invalidateQueries).toHaveBeenNthCalledWith(1, {
      queryKey: invoiceKeys.lists(),
    });
    expect(invalidateQueries).toHaveBeenNthCalledWith(2, {
      queryKey: invoiceKeys.detail("invoice-123"),
    });
    expect(invalidateQueries).toHaveBeenNthCalledWith(3, {
      queryKey: financeKeys.all,
    });
    expect(invalidateQueries).toHaveBeenCalledTimes(3);
  });
});
