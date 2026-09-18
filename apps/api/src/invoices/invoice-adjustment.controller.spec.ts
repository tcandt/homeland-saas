import { describe, expect, it, vi } from "vitest";
import { InvoicesController } from "./invoices.controller";

describe("InvoicesController CORE-07.01 adjustment contract", () => {
  const body = {
    type: "CREDIT" as const,
    reason: "Giảm tiền điện sau đối soát",
    items: [
      {
        type: "UTILITY_ELECTRICITY" as const,
        description: "Giảm tiền điện tháng 2026-08",
        amount: 50_000,
      },
    ],
  };

  it("forwards the mandatory Idempotency-Key header and authenticated tenant/user", async () => {
    const createAdjustment = vi.fn().mockResolvedValue({ replayed: false });
    const controller = new InvoicesController({ createAdjustment } as any);

    await controller.createAdjustment(
      "base-1",
      "adjustment-header-key",
      body,
      "tenant-1",
      "user-1",
    );

    expect(createAdjustment).toHaveBeenCalledWith(
      "tenant-1",
      "base-1",
      "adjustment-header-key",
      expect.objectContaining({
        type: body.type,
        reason: body.reason,
        items: [
          expect.objectContaining({
            ...body.items[0],
            quantity: 1,
          }),
        ],
      }),
      "user-1",
    );
  });

  it("does not accept idempotency or period scope in the request body", () => {
    const controller = new InvoicesController({
      createAdjustment: vi.fn(),
    } as any);

    expect(() =>
      controller.createAdjustment(
        "base-1",
        undefined,
        { ...body, idempotencyKey: "body-key-not-allowed" },
        "tenant-1",
        "user-1",
      ),
    ).toThrow();
    expect(() =>
      controller.createAdjustment(
        "base-1",
        "adjustment-header-key",
        { ...body, usagePeriod: "2026-10" },
        "tenant-1",
        "user-1",
      ),
    ).toThrow();
  });
});
