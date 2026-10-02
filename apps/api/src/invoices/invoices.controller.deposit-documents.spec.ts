import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { InvoicesController } from "./invoices.controller";
import { PERMISSIONS_KEY } from "../shared/decorators/require-permissions.decorator";

describe("deposit document read endpoint", () => {
  it("requires invoice and deposit read access on the static route", () => {
    const handler = InvoicesController.prototype.listDepositDocuments;
    expect(Reflect.getMetadata(PERMISSIONS_KEY, handler)).toEqual(["invoice.read", "deposit.read"]);
    expect(Reflect.getMetadata("path", handler)).toBe("deposit-documents");
  });

  it("forwards authenticated tenant and validated paging with exact finance scope", () => {
    const listDepositBillingDocuments = vi.fn();
    const controller = new InvoicesController({ listDepositBillingDocuments } as any);
    controller.listDepositDocuments({
      tenantId: "untrusted", page: "2", limit: "100", roomId: "room-1", customerId: "customer-1",
      contractId: "contract-1", rentalCycleId: "cycle-1",
    }, "tenant-authenticated");
    expect(listDepositBillingDocuments).toHaveBeenCalledWith("tenant-authenticated", 2, 100, {
      roomId: "room-1", customerId: "customer-1", contractId: "contract-1", rentalCycleId: "cycle-1",
    });
  });

  it("forwards a bounded invoice window for tenant-scoped deposit grouping", () => {
    const listDepositBillingDocuments = vi.fn();
    const controller = new InvoicesController({ listDepositBillingDocuments } as any);
    controller.listDepositDocuments({ page: "1", limit: "100", invoiceIds: "invoice-1,invoice-2" }, "tenant-authenticated");
    expect(listDepositBillingDocuments).toHaveBeenCalledWith("tenant-authenticated", 1, 100, {
      roomId: undefined,
      customerId: undefined,
      contractId: undefined,
      rentalCycleId: undefined,
      invoiceIds: ["invoice-1", "invoice-2"],
    });
  });
});
