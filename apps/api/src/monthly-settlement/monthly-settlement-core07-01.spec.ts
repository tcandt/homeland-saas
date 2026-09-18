import { InvoiceStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MonthlySettlementService } from "./monthly-settlement.service";

describe("MonthlySettlementService CORE-07.01 canonical base invoice", () => {
  let service: MonthlySettlementService;
  let prisma: any;
  let auditService: any;
  let hunonicService: any;
  let storedBillingSnapshot: any;

  const overviewItem = {
    roomId: "room-1",
    roomCode: "101",
    buildingCode: "A",
    contractId: "contract-1",
    rentalCycleId: "cycle-1",
    representative: { id: "customer-1" },
    hasContract: true,
    totalAmount: 1_000_000,
    roomPrice: 1_000_000,
    waterEligible: false,
    electricityEligible: false,
    serviceEligible: false,
    waterAmount: 0,
    electricityAmount: 0,
    serviceAmount: 0,
    roomElectricityKwh: 0,
    roomElectricityAmount: 0,
    membersCount: 1,
    members: [],
    meterReading: null,
    invoiceId: "manual-or-adjustment-projection-id",
    invoiceCode: "INV-202609-101-HD-1",
    utilityShareRatio: 1,
    occupancySource: "OPEN_OCCUPANCY",
  };

  beforeEach(() => {
    storedBillingSnapshot = null;
    prisma = {
      invoice: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(async ({ data }: any) => ({
          id: "monthly-base-1",
          ...data,
        })),
        update: vi.fn().mockImplementation(async ({ data }: any) => ({
          id: "monthly-base-1",
          code: overviewItem.invoiceCode,
          ...data,
        })),
      },
      invoiceItem: {
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      billingSnapshot: {
        createMany: vi.fn().mockImplementation(async ({ data }: any) => {
          if (!storedBillingSnapshot && data?.[0]) {
            storedBillingSnapshot = { id: "snapshot-1", ...data[0] };
          }
          return { count: storedBillingSnapshot ? 1 : 0 };
        }),
        findUnique: vi.fn().mockImplementation(async () => storedBillingSnapshot),
      },
      $queryRaw: vi.fn().mockResolvedValue([{ lock: "" }]),
      $transaction: vi.fn(async (callback: any) => callback(prisma)),
    };
    auditService = { log: vi.fn().mockResolvedValue(undefined) };
    hunonicService = {
      lockPeriods: vi.fn().mockResolvedValue({ success: true }),
    };
    service = new MonthlySettlementService(
      prisma,
      {} as any,
      {} as any,
      {} as any,
      hunonicService,
      auditService,
    );
    vi.spyOn(service, "getOverview").mockResolvedValue({
      items: [overviewItem],
    } as any);
  });

  it("ignores projected manual/ENTRY/adjustment identity and looks up only exact MONTHLY_BASE canonical key", async () => {
    const result = await service.closeMonth("tenant-1", "user-1", {
      period: "2026-09",
      autoSend: false,
    });

    expect(result.settledCount).toBe(1);
    expect(prisma.invoice.findFirst).toHaveBeenCalledTimes(2);
    for (const call of prisma.invoice.findFirst.mock.calls) {
      expect(call[0]).toEqual({
        where: {
          tenantId: "tenant-1",
          billingKind: "MONTHLY_BASE",
          baseInvoiceKey: "MONTHLY:contract-1:2026-09",
          deletedAt: null,
        },
      });
      expect(call[0].where).not.toHaveProperty("id");
      expect(call[0].where).not.toHaveProperty("code");
    }
    expect(prisma.invoice.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: InvoiceStatus.DRAFT,
        billingKind: "MONTHLY_BASE",
        baseInvoiceKey: "MONTHLY:contract-1:2026-09",
      }),
    });
    expect(prisma.invoice.update).toHaveBeenCalledWith({
      where: {
        id: "monthly-base-1",
        tenantId: "tenant-1",
        status: InvoiceStatus.DRAFT,
      },
      data: { status: InvoiceStatus.ISSUED },
    });
  });

  it.each([
    InvoiceStatus.ISSUED,
    InvoiceStatus.PARTIALLY_PAID,
    InvoiceStatus.PAID,
    InvoiceStatus.OVERDUE,
    InvoiceStatus.CANCELLED,
    InvoiceStatus.WRITTEN_OFF,
  ])(
    "replays/skips a canonical %s base without mutating invoice or items",
    async (status) => {
      prisma.invoice.findFirst.mockResolvedValue({
        id: "monthly-existing",
        code: overviewItem.invoiceCode,
        billingKind: "MONTHLY_BASE",
        baseInvoiceKey: "MONTHLY:contract-1:2026-09",
        status,
        total: 1_000_000,
      });

      const result = await service.closeMonth("tenant-1", "user-1", {
        period: "2026-09",
        autoSend: false,
      });

      expect(result).toMatchObject({ settledCount: 0, skippedCount: 1 });
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.invoice.create).not.toHaveBeenCalled();
      expect(prisma.invoice.update).not.toHaveBeenCalled();
      expect(prisma.invoiceItem.deleteMany).not.toHaveBeenCalled();
    },
  );

  it("completes an exact DRAFT base and CAS-issues it with item replacement in one transaction", async () => {
    const draft = {
      id: "monthly-draft",
      code: overviewItem.invoiceCode,
      billingKind: "MONTHLY_BASE",
      baseInvoiceKey: "MONTHLY:contract-1:2026-09",
      status: InvoiceStatus.DRAFT,
    };
    prisma.invoice.findFirst.mockResolvedValue(draft);
    prisma.invoice.update.mockResolvedValue({
      ...draft,
      status: InvoiceStatus.ISSUED,
      total: 1_000_000,
    });

    const result = await service.closeMonth("tenant-1", "user-1", {
      period: "2026-09",
      autoSend: false,
    });

    expect(result.settledCount).toBe(1);
    expect(prisma.invoice.create).not.toHaveBeenCalled();
    expect(prisma.invoiceItem.deleteMany).toHaveBeenCalledWith({
      where: { invoiceId: draft.id, tenantId: "tenant-1" },
    });
    expect(prisma.invoice.update).toHaveBeenCalledWith({
      where: {
        id: draft.id,
        tenantId: "tenant-1",
        status: InvoiceStatus.DRAFT,
      },
      data: expect.objectContaining({
        status: InvoiceStatus.ISSUED,
        period: "2026-09",
        usagePeriod: "2026-08",
        subtotal: 1_000_000,
        total: 1_000_000,
        items: { create: expect.any(Array) },
      }),
    });
  });

  it("recovers P2002 only through the exact canonical lookup and never rebuilds the winning issued base", async () => {
    const winningBase = {
      id: "monthly-concurrent-winner",
      code: overviewItem.invoiceCode,
      billingKind: "MONTHLY_BASE",
      baseInvoiceKey: "MONTHLY:contract-1:2026-09",
      status: InvoiceStatus.ISSUED,
      total: 1_000_000,
    };
    prisma.invoice.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(winningBase);
    prisma.invoice.create.mockRejectedValue({ code: "P2002" });

    const result = await service.closeMonth("tenant-1", "user-1", {
      period: "2026-09",
      autoSend: false,
    });

    expect(result).toMatchObject({ settledCount: 0, skippedCount: 1 });
    expect(prisma.invoice.findFirst.mock.calls[2][0]).toEqual({
      where: {
        tenantId: "tenant-1",
        billingKind: "MONTHLY_BASE",
        baseInvoiceKey: "MONTHLY:contract-1:2026-09",
        deletedAt: null,
      },
    });
    expect(prisma.invoiceItem.deleteMany).not.toHaveBeenCalled();
    expect(prisma.invoice.update).not.toHaveBeenCalled();
  });
});
