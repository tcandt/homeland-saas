import { describe, expect, it, vi } from "vitest";
import { InvoicesRepository } from "./invoices.repository";

describe("InvoicesRepository cursor pagination", () => {
  it("uses a stable keyset condition and never issues count/skip queries", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { id: "invoice-2", createdAt: new Date("2026-09-30T10:00:00.000Z") },
      { id: "invoice-1", createdAt: new Date("2026-09-30T10:00:00.000Z") },
      { id: "invoice-0", createdAt: new Date("2026-09-29T10:00:00.000Z") },
    ]);
    const repository = new InvoicesRepository({
      tx: { invoice: { findMany } },
    } as any);
    const cursorDate = new Date("2026-09-30T10:00:00.000Z");

    const result = await repository.paginateCursor(
      { tenantId: "tenant-1", AND: [{ status: "ISSUED" }] },
      2,
      { createdAt: cursorDate, id: "invoice-3" },
      { customer: true },
    );

    expect(findMany).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-1",
        deletedAt: null,
        AND: [
          { status: "ISSUED" },
          {
            OR: [
              { createdAt: { lt: cursorDate } },
              { createdAt: cursorDate, id: { lt: "invoice-3" } },
            ],
          },
        ],
      },
      take: 3,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: { customer: true },
    });
    expect(result).toEqual({
      data: [
        { id: "invoice-2", createdAt: new Date("2026-09-30T10:00:00.000Z") },
        { id: "invoice-1", createdAt: new Date("2026-09-30T10:00:00.000Z") },
      ],
      hasNextPage: true,
    });
    expect(findMany.mock.calls[0][0]).not.toHaveProperty("skip");
  });
});
