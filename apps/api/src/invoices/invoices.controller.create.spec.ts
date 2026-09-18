import { describe, expect, it, vi } from "vitest";
import { CreateInvoiceSchema } from "@homeland/shared";
import { InvoicesController } from "./invoices.controller";

describe("InvoicesController CORE-07.08 create scope", () => {
  const body = {
    tenantId: "untrusted-tenant",
    customerId: "customer-1",
    roomId: "room-1",
    contractId: "contract-1",
    rentalCycleId: "cycle-1",
    period: "2026-09",
    dueDate: "2026-09-30",
    totalAmount: 50_000,
    paidAmount: 0,
    status: "PAID",
    items: [{ type: "RENT", description: "September rent", amount: 50_000 }],
  };

  it("keeps rentalCycleId optional in the create schema for legacy commands", () => {
    const legacyBody = { ...body };
    delete (legacyBody as any).rentalCycleId;

    expect(CreateInvoiceSchema.safeParse(legacyBody).success).toBe(true);
  });

  it("forwards the authenticated tenant, requested room, and exact optional cycle as scope", async () => {
    const create = vi.fn().mockResolvedValue({ id: "invoice-1" });
    const controller = new InvoicesController({ create } as any);

    await controller.create(body, "user-1", "tenant-authenticated");

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: "customer-1",
        contractId: "contract-1",
        dueDate: expect.any(Date),
        total: 50_000,
        subtotal: 50_000,
        items: {
          create: [
            expect.objectContaining({
              tenantId: "tenant-authenticated",
              description: "September rent",
            }),
          ],
        },
      }),
      "user-1",
      "Invoices",
      {
        tenantId: "tenant-authenticated",
        roomId: "room-1",
        rentalCycleId: "cycle-1",
      },
    );
  });

  it("forwards an omitted optional cycle as undefined so the service can derive it", async () => {
    const create = vi.fn().mockResolvedValue({ id: "invoice-legacy-1" });
    const controller = new InvoicesController({ create } as any);
    const legacyBody = { ...body };
    delete (legacyBody as any).rentalCycleId;

    await controller.create(legacyBody, "user-1", "tenant-authenticated");

    expect(create).toHaveBeenCalledWith(
      expect.any(Object),
      "user-1",
      "Invoices",
      {
        tenantId: "tenant-authenticated",
        roomId: "room-1",
        rentalCycleId: undefined,
      },
    );
  });
});
