import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoicesApi } from "../../lib/api/invoices.api";
import { invoiceKeys, useInvoicesQuery } from "../../lib/queries/invoices.queries";

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: any) => options,
  useMutation: vi.fn(), useQueryClient: vi.fn(),
}));

describe("complete invoice list for combined billing documents", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("loads subsequent pages so invoice-backed cash is counted on the original invoice", async () => {
    const list = vi.spyOn(invoicesApi, "list")
      .mockResolvedValueOnce({ items: [{ id: "invoice-1" }], total: 3 } as any)
      .mockResolvedValueOnce({ items: [{ id: "invoice-2" }], total: 3 } as any)
      .mockResolvedValueOnce({ items: [{ id: "invoice-3" }], total: 3 } as any);
    const query = useInvoicesQuery({ limit: 1 }, { fetchAllPages: true }) as any;
    expect(await query.queryFn()).toMatchObject({
      data: [{ id: "invoice-1" }, { id: "invoice-2" }, { id: "invoice-3" }], meta: { total: 3 },
    });
    expect(list).toHaveBeenNthCalledWith(2, { page: 2, limit: 1 });
    expect(list).toHaveBeenNthCalledWith(3, { page: 3, limit: 1 });
    expect(query.queryKey).toEqual([...invoiceKeys.list({ limit: 1 }), "all-pages"]);
  });

  it("preserves single-page callers and their cache key", async () => {
    const list = vi.spyOn(invoicesApi, "list").mockResolvedValue({ items: [{ id: "invoice-1" }], total: 3 } as any);
    const query = useInvoicesQuery({ limit: 1 }) as any;
    expect((await query.queryFn()).data).toHaveLength(1);
    expect(list).toHaveBeenCalledTimes(1);
    expect(query.queryKey).toEqual(invoiceKeys.list({ limit: 1 }));
  });

  it("stops when a subsequent page is empty", async () => {
    const list = vi.spyOn(invoicesApi, "list")
      .mockResolvedValueOnce({ items: [{ id: "invoice-1" }], total: 3 } as any)
      .mockResolvedValueOnce({ items: [], total: 3 } as any);
    const query = useInvoicesQuery({ limit: 1 }, { fetchAllPages: true }) as any;
    expect((await query.queryFn()).data).toHaveLength(1);
    expect(list).toHaveBeenCalledTimes(2);
  });
});
