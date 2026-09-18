import { BadRequestException, NotFoundException } from "@nestjs/common";
import { ContractStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { ContractsService } from "./contracts.service";

function previewFixture(options: { foreignCycle?: boolean } = {}) {
  const contract = {
    id: "contract-a",
    tenantId: "tenant-a",
    customerId: "customer-a",
    roomId: "room-a",
    rentalCycleId: "cycle-a",
    code: "CT-A",
    status: ContractStatus.ACTIVE,
    monthlyRent: 3_000_000,
    depositMoney: 9_999_999,
    deletedAt: null,
    customer: { id: "customer-a" },
    room: { id: "room-a" },
  };
  const tx: any = {
    contract: {
      findFirst: vi.fn(async ({ where }: any) =>
        where.id === contract.id && where.tenantId === contract.tenantId
          ? contract
          : null,
      ),
    },
    rentalCycle: {
      findFirst: vi.fn(async ({ where }: any) =>
        !options.foreignCycle &&
        where.id === "cycle-a" &&
        where.tenantId === "tenant-a" &&
        where.customerId === "customer-a" &&
        where.roomId === "room-a"
          ? { id: "cycle-a" }
          : null,
      ),
    },
    invoice: {
      findMany: vi.fn(async ({ where }: any) => {
        expect(where).toMatchObject({
          tenantId: "tenant-a",
          contractId: "contract-a",
          rentalCycleId: "cycle-a",
          customerId: "customer-a",
        });
        return [
          {
            id: "invoice-a",
            status: "ISSUED",
            billingKind: "MONTHLY_RENT",
            adjustmentOfInvoiceId: null,
            total: 500_000,
            paidAmount: 0,
            creditAmount: 0,
            dueDate: new Date("2026-08-01"),
          },
        ];
      }),
    },
    deposit: {
      findMany: vi.fn(async ({ where }: any) => {
        expect(where).toMatchObject({
          tenantId: "tenant-a",
          contractId: "contract-a",
          rentalCycleId: "cycle-a",
          customerId: "customer-a",
          roomId: "room-a",
        });
        return [{ id: "deposit-a" }];
      }),
    },
    depositLedgerEntry: {
      aggregate: vi.fn(async ({ where }: any) => {
        expect(where).toEqual({ tenantId: "tenant-a", depositId: "deposit-a" });
        return { _sum: { balanceEffect: 700_000 } };
      }),
    },
  };
  const prisma: any = {
    tx,
    hunonicMeterMapping: { findFirst: vi.fn(async () => null) },
  };
  const service = new ContractsService(
    {} as any,
    { log: vi.fn() } as any,
    prisma,
    { publish: vi.fn() } as any,
    { getRoomElectricityPricing: vi.fn(async () => null) } as any,
  );
  return { service, tx };
}

describe("GATE-09 confirmed findings", () => {
  it("builds a tenant-bound preview from authoritative debt and deposit records", async () => {
    const { service } = previewFixture();
    const result = await service.previewSettlement(
      "contract-a",
      {
        actualMoveOutDate: "2026-09-13",
        rentDaysCharged: 0,
        depositToRefund: 700_000,
      },
      "tenant-a",
    );
    expect(result.accountingBreakdown.priorOutstanding).toBe(500_000);
    expect(result.accountingBreakdown.depositAppliedAmount).toBe(500_000);
    expect(result.totals.refundToCustomer).toBe(200_000);
  });

  it("rejects a foreign contract before reading any financial data", async () => {
    const { service, tx } = previewFixture();
    await expect(
      service.previewSettlement(
        "contract-a",
        { actualMoveOutDate: "2026-09-13" },
        "tenant-b",
      ),
    ).rejects.toThrow(NotFoundException);
    expect(tx.invoice.findMany).not.toHaveBeenCalled();
    expect(tx.deposit.findMany).not.toHaveBeenCalled();
  });

  it("rejects mixed-tenant cycle bindings without leaking preview amounts", async () => {
    const { service, tx } = previewFixture({ foreignCycle: true });
    await expect(
      service.previewSettlement(
        "contract-a",
        { actualMoveOutDate: "2026-09-13", depositToRefund: 700_000 },
        "tenant-a",
      ),
    ).rejects.toThrow(BadRequestException);
    expect(tx.invoice.findMany).not.toHaveBeenCalled();
    expect(tx.deposit.findMany).not.toHaveBeenCalled();
  });
});
