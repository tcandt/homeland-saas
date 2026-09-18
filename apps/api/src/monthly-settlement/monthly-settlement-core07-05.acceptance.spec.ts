import { describe, expect, it, vi } from "vitest";
import {
  MonthlySettlementService,
  resolveCanonicalRoomPeriodOccupancy,
} from "./monthly-settlement.service";

const period = "2026-10";
const usagePeriod = "2026-09";

function contract(id: string, customerId: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    customerId,
    code: `HD-${id}`,
    status: "ACTIVE",
    startDate: new Date("2026-08-01T00:00:00.000Z"),
    endDate: new Date("2027-08-01T00:00:00.000Z"),
    monthlyRent: 1_000_000,
    memberCount: 1,
    customer: { id: customerId, fullName: `Live ${customerId}` },
    ...extra,
  };
}

function room(contracts: any[], occupancies: any[] = [], rentalType = "SHARED") {
  return {
    id: "room-1",
    code: "101",
    name: "Phòng 101",
    monthlyPrice: 2_000_000,
    rentalType,
    capacity: 4,
    building: { id: "building-1", name: "Tòa A", code: "A" },
    floor: { id: "floor-1", name: "Tầng 1", level: 1 },
    contracts,
    occupancies,
  };
}

function snapshot(overrides: Record<string, unknown> = {}) {
  return {
    id: "locked-1",
    tenantId: "tenant-1",
    roomId: "room-1",
    usagePeriod,
    status: "LOCKED",
    usageKwh: 0.3,
    electricityAmount: 3,
    waterAmount: 200_000,
    occupantCount: 2,
    occupants: [
      { customerId: "payer-a", contractId: "contract-a", fullName: "Snapshot A" },
      { customerId: "payer-b", contractId: "contract-b", fullName: "Snapshot B" },
    ],
    allocations: [
      {
        contractId: "contract-a", customerId: "payer-a", payerSnapshot: { id: "payer-a", fullName: "Payer A" }, memberCount: 1, eligible: true,
        electricityKwh: 0.1, electricityAmount: 1, waterAmount: 100_000,
      },
      {
        contractId: "contract-b", customerId: "payer-b", payerSnapshot: { id: "payer-b", fullName: "Payer B" }, memberCount: 1, eligible: true,
        electricityKwh: 0.2, electricityAmount: 2, waterAmount: 100_000,
      },
    ],
    ...overrides,
  };
}

function createService(options: { rooms?: any[]; snapshots?: any[]; invoices?: any[]; readings?: any[]; latestReading?: any } = {}) {
  const storedSnapshots = new Map<string, any>();
  for (const existing of options.snapshots || []) {
    storedSnapshots.set(`${existing.tenantId}:${existing.roomId}:${existing.usagePeriod}`, existing);
  }
  const prisma: any = {
    $transaction: vi.fn(async (callback: any) => callback(prisma)),
    appSetting: { findUnique: vi.fn().mockResolvedValue(null) },
    building: { findMany: vi.fn().mockResolvedValue([]) },
    room: { findMany: vi.fn().mockResolvedValue(options.rooms || []) },
    invoice: {
      findMany: vi.fn().mockResolvedValue(options.invoices || []),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(async ({ data }: any) => ({ id: "invoice-1", ...data })),
      update: vi.fn().mockImplementation(async ({ data }: any) => ({ id: "invoice-1", ...data })),
    },
    invoiceItem: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    notification: { findMany: vi.fn().mockResolvedValue([]) },
    billingSnapshot: {
      findMany: vi.fn().mockResolvedValue(options.snapshots || []),
      createMany: vi.fn().mockImplementation(async ({ data }: any) => {
        let count = 0;
        for (const create of data || []) {
          const key = `${create.tenantId}:${create.roomId}:${create.usagePeriod}`;
          if (!storedSnapshots.has(key)) {
            storedSnapshots.set(key, { id: `new-snapshot-${storedSnapshots.size + 1}`, ...create });
            count += 1;
          }
        }
        return { count };
      }),
      findUnique: vi.fn().mockImplementation(async ({ where }: any) => {
        const keyData = where.tenantId_roomId_usagePeriod;
        return storedSnapshots.get(`${keyData.tenantId}:${keyData.roomId}:${keyData.usagePeriod}`) || null;
      }),
    },
    hunonicMeterReading: {
      findMany: vi.fn().mockResolvedValue(options.readings || []),
      findFirst: vi.fn().mockResolvedValue(options.latestReading || null),
    },
  };
  const hunonicService = {
    getOverview: vi.fn().mockResolvedValue({ meters: [] }),
    lockPeriods: vi.fn().mockResolvedValue({ success: true }),
  };
  return {
    prisma,
    hunonicService,
    service: new MonthlySettlementService(prisma, {} as any, {} as any, {} as any, hunonicService as any, { log: vi.fn() } as any),
  };
}

describe("CORE-07.05 monthly-settlement acceptance", () => {
  it("hydrates exact decimal locked allocations and conserves the room total", async () => {
    const { service } = createService({
      rooms: [room([contract("contract-a", "live-a"), contract("contract-b", "live-b")])],
      snapshots: [snapshot()],
    });

    const overview = await service.getOverview("tenant-1", { period });

    expect(overview.items.map((item: any) => item.electricityKwh)).toEqual([0.1, 0.2]);
    expect(Math.round(overview.items.reduce((sum: number, item: any) => sum + item.electricityKwh, 0) * 1000)).toBe(300);
    expect(overview.items.reduce((sum: number, item: any) => sum + item.electricityAmount, 0)).toBe(3);
    expect(overview.items.reduce((sum: number, item: any) => sum + item.waterAmount, 0)).toBe(200_000);
    expect(overview.items.flatMap((item: any) => item.settlementBlockers)).toEqual([]);
  });

  it.each([
    ["an ineligible allocation still claims an occupant", snapshot({
      usageKwh: 0, electricityAmount: 0, waterAmount: 0, occupantCount: 1,
      occupants: [{ customerId: "payer-a", contractId: "contract-a" }],
      allocations: [
        { contractId: "contract-a", customerId: "payer-a", memberCount: 1, eligible: false, electricityKwh: 0, electricityAmount: 0, waterAmount: 0 },
        { contractId: "contract-b", customerId: "payer-b", memberCount: 0, eligible: false, electricityKwh: 0, electricityAmount: 0, waterAmount: 0 },
      ],
    })],
    ["an ineligible allocation still carries utility", snapshot({
      usageKwh: 0.1, electricityAmount: 1, waterAmount: 0, occupantCount: 0,
      occupants: [],
      allocations: [
        { contractId: "contract-a", customerId: "payer-a", memberCount: 0, eligible: false, electricityKwh: 0.1, electricityAmount: 1, waterAmount: 0 },
        { contractId: "contract-b", customerId: "payer-b", memberCount: 0, eligible: false, electricityKwh: 0, electricityAmount: 0, waterAmount: 0 },
      ],
    })],
  ])("blocks when %s", async (_label, lockedSnapshot) => {
    const { service } = createService({
      rooms: [room([contract("contract-a", "live-a"), contract("contract-b", "live-b")])],
      snapshots: [lockedSnapshot],
    });

    const overview = await service.getOverview("tenant-1", { period });

    expect(overview.items.flatMap((item: any) => item.settlementBlockers)).not.toEqual([]);
  });

  it.each([
    ["an occupant references a contract absent from allocations", snapshot({
      occupants: [
        { customerId: "occupant-a", contractId: "contract-a" },
        { customerId: "occupant-orphan", contractId: "contract-orphan" },
      ],
    })],
    ["the same customer is present in two allocation contracts", snapshot({
      occupants: [
        { customerId: "duplicate-customer", contractId: "contract-a" },
        { customerId: "duplicate-customer", contractId: "contract-b" },
      ],
    })],
  ])("blocks when %s", async (_label, lockedSnapshot) => {
    const { service } = createService({
      rooms: [room([contract("contract-a", "live-a"), contract("contract-b", "live-b")])],
      snapshots: [lockedSnapshot],
    });

    const overview = await service.getOverview("tenant-1", { period });

    expect(overview.items.flatMap((item: any) => item.settlementBlockers)).not.toEqual([]);
  });

  it("uses locked payer and roster snapshots when live contract customers have changed", async () => {
    const { service } = createService({
      rooms: [room([contract("contract-a", "live-a"), contract("contract-b", "live-b")])],
      snapshots: [snapshot()],
    });

    const overview = await service.getOverview("tenant-1", { period });

    expect(overview.items.find((item: any) => item.contractId === "contract-a")).toMatchObject({
      representative: { id: "payer-a" },
      members: [expect.objectContaining({ id: "payer-a" })],
    });
    expect(overview.items.find((item: any) => item.contractId === "contract-b")).toMatchObject({
      representative: { id: "payer-b" },
      members: [expect.objectContaining({ id: "payer-b" })],
    });
  });

  it("does not block a CANCELLED contract that never overlapped an Occupancy", async () => {
    const cancelled = contract("cancelled", "payer", {
      status: "CANCELLED",
      startDate: new Date("2026-08-01T00:00:00.000Z"),
      endDate: new Date("2026-10-01T00:00:00.000Z"),
    });
    const { service } = createService({ rooms: [room([cancelled], [], "WHOLE")] });

    const overview = await service.getOverview("tenant-1", { period });

    expect(overview.items[0].settlementBlockers).toEqual([]);
  });

  it("blocks a CANCELLED contract with overlapping Occupancy until its final settlement exists", async () => {
    const terminal = contract("terminal", "payer", {
      status: "CANCELLED",
      actualMoveOutAt: new Date("2026-09-20T00:00:00.000Z"),
      endDate: new Date("2026-09-20T00:00:00.000Z"),
    });
    const occupancy = {
      id: "terminal-occupancy", tenantId: "tenant-1", roomId: "room-1", customerId: "payer", contractId: "terminal",
      joinedAt: new Date("2026-09-01T00:00:00.000Z"), leftAt: new Date("2026-09-20T00:00:00.000Z"),
      customer: { id: "payer", fullName: "Payer" },
    };
    const { service } = createService({ rooms: [room([terminal], [occupancy], "WHOLE")] });

    const overview = await service.getOverview("tenant-1", { period });

    expect(overview.items[0].settlementBlockers.map((blocker: any) => blocker.code)).toContain(
      "TERMINAL_CONTRACT_REQUIRES_FINAL_SETTLEMENT",
    );
  });

  it("blocks ineligible live previous-usage Occupancy before every financial write", async () => {
    const firstMonthContract = contract("first-month", "payer", {
      tenantId: "tenant-1",
      startDate: new Date("2026-10-01T00:00:00.000Z"),
      customer: { id: "payer", tenantId: "tenant-1", fullName: "Payer" },
    });
    const occupancy = {
      id: "overlap-before-start", tenantId: "tenant-1", roomId: "room-1", customerId: "payer", contractId: "first-month",
      joinedAt: new Date("2026-09-15T00:00:00.000Z"), leftAt: null,
      customer: { id: "payer", tenantId: "tenant-1", fullName: "Payer" },
    };
    const { service, prisma, hunonicService } = createService({
      rooms: [room([firstMonthContract], [occupancy], "WHOLE")],
    });

    const overview = await service.getOverview("tenant-1", { period });
    expect(overview.items[0].settlementBlockers.map((blocker: any) => blocker.code)).toContain(
      "INELIGIBLE_CONTRACT_HAS_OCCUPANCY",
    );

    await expect(service.closeMonth("tenant-1", "user-1", { period, autoSend: false })).rejects.toBeTruthy();
    expect(prisma.invoice.create).not.toHaveBeenCalled();
    expect(prisma.billingSnapshot.createMany).not.toHaveBeenCalled();
    expect(hunonicService.lockPeriods).not.toHaveBeenCalled();
  });

  it("does not block an overlapping terminal contract after its final settlement", async () => {
    const settledTerminal = contract("terminal", "payer", {
      status: "TERMINATED",
      actualMoveOutAt: new Date("2026-09-20T00:00:00.000Z"),
      endDate: new Date("2026-09-20T00:00:00.000Z"),
      settlement: { id: "final-settlement", tenantId: "tenant-1" },
    });
    const occupancy = {
      id: "terminal-occupancy", tenantId: "tenant-1", roomId: "room-1", customerId: "payer", contractId: "terminal",
      joinedAt: new Date("2026-09-01T00:00:00.000Z"), leftAt: new Date("2026-09-20T00:00:00.000Z"),
      customer: { id: "payer", fullName: "Payer" },
    };
    const { service } = createService({ rooms: [room([settledTerminal], [occupancy], "WHOLE")] });

    const overview = await service.getOverview("tenant-1", { period });

    expect(overview.items[0].settlementBlockers).toEqual([]);
  });

  it("requires terminal usage reconciliation when a settled terminal and active survivor overlap", async () => {
    const settledTerminal = contract("terminal", "terminal-payer", {
      status: "TERMINATED", actualMoveOutAt: new Date("2026-09-20T00:00:00.000Z"),
      endDate: new Date("2026-09-20T00:00:00.000Z"), settlement: { id: "final-settlement" },
    });
    const activeSurvivor = contract("survivor", "survivor-payer", {
      startDate: new Date("2026-09-15T00:00:00.000Z"),
    });
    const occupancies = [
      { id: "terminal-occupancy", tenantId: "tenant-1", roomId: "room-1", customerId: "terminal-payer", contractId: "terminal", joinedAt: new Date("2026-09-01T00:00:00.000Z"), leftAt: new Date("2026-09-20T00:00:00.000Z"), customer: { id: "terminal-payer", fullName: "Terminal" } },
      { id: "survivor-occupancy", tenantId: "tenant-1", roomId: "room-1", customerId: "survivor-payer", contractId: "survivor", joinedAt: new Date("2026-09-15T00:00:00.000Z"), leftAt: null, customer: { id: "survivor-payer", fullName: "Survivor" } },
    ];
    const { service } = createService({ rooms: [room([settledTerminal, activeSurvivor], occupancies, "WHOLE")] });

    const overview = await service.getOverview("tenant-1", { period });

    expect(overview.items[0].settlementBlockers.map((blocker: any) => blocker.code)).toContain(
      "TERMINAL_USAGE_RECONCILIATION_REQUIRED",
    );
  });

  it("leaves a settled terminal alone as a non-financial, unblocked target", async () => {
    const settledTerminal = contract("terminal", "payer", {
      status: "TERMINATED", actualMoveOutAt: new Date("2026-09-20T00:00:00.000Z"),
      endDate: new Date("2026-09-20T00:00:00.000Z"), settlement: { id: "final-settlement" },
    });
    const occupancy = {
      id: "terminal-occupancy", tenantId: "tenant-1", roomId: "room-1", customerId: "payer", contractId: "terminal",
      joinedAt: new Date("2026-09-01T00:00:00.000Z"), leftAt: new Date("2026-09-20T00:00:00.000Z"), customer: { id: "payer", fullName: "Payer" },
    };
    const { service, prisma, hunonicService } = createService({ rooms: [room([settledTerminal], [occupancy], "WHOLE")] });

    const overview = await service.getOverview("tenant-1", { period });
    expect(overview.items[0]).toMatchObject({ hasContract: false, totalAmount: 0, settlementBlockers: [] });
    await expect(service.closeMonth("tenant-1", "user-1", { period, autoSend: false })).resolves.toMatchObject({ settledCount: 0 });
    expect(prisma.invoice.create).not.toHaveBeenCalled();
    expect(prisma.billingSnapshot.createMany).not.toHaveBeenCalled();
    expect(hunonicService.lockPeriods).not.toHaveBeenCalled();
  });

  it("keeps locked WHOLE scope, payer roster and utility immutable through live room mutations", async () => {
    const historicalContract = contract("historic", "live-historic", {
      status: "CANCELLED", monthlyRent: 9_999_999,
      customer: { id: "live-historic", fullName: "Mutated live payer" },
    });
    const newLiveContract = contract("new-live", "new-payer", {
      status: "ACTIVE", monthlyRent: 8_888_888,
      customer: { id: "new-payer", fullName: "New live payer" },
    });
    const lockedWhole = snapshot({
      usageKwh: 12, electricityAmount: 42_000, waterAmount: 100_000, occupantCount: 1,
      occupants: [{ customerId: "snapshot-occupant", contractId: "historic", fullName: "Snapshot occupant" }],
      allocations: [{
        contractId: "historic", customerId: "snapshot-payer", payerSnapshot: { id: "snapshot-payer", fullName: "Snapshot payer" },
        memberCount: 1, eligible: true, electricityKwh: 12, electricityAmount: 42_000, waterAmount: 100_000,
      }],
      sourceProvenance: { rentalType: "WHOLE", billingScope: "ROOM" },
    });
    const { service } = createService({
      rooms: [room([historicalContract, newLiveContract], [], "SHARED")],
      snapshots: [lockedWhole],
    });

    const overview = await service.getOverview("tenant-1", { period });

    expect(overview.items).toHaveLength(1);
    expect(overview.items[0]).toMatchObject({
      billingScope: "ROOM", roomRentalType: "WHOLE", contractId: "historic",
      representative: { id: "snapshot-payer" }, members: [expect.objectContaining({ id: "snapshot-occupant" })],
      electricityKwh: 12, electricityAmount: 42_000, waterAmount: 100_000,
      settlementBlockers: [],
    });
  });

  it("rejects a close-month scope containing an unknown room before any financial write", async () => {
    const { service, prisma, hunonicService } = createService();
    vi.spyOn(service, "getOverview").mockResolvedValue({
      items: [{
        roomId: "known-room", roomCode: "101", buildingCode: "A", contractId: "contract-1",
        representative: { id: "payer" }, hasContract: true, totalAmount: 1_000_000,
        roomPrice: 1_000_000, waterAmount: 0, electricityAmount: 0, serviceAmount: 0,
        electricityEligible: false, waterEligible: false, serviceEligible: false,
        roomElectricityKwh: 0, roomElectricityAmount: 0, membersCount: 1, members: [], meterReading: null,
        settlementBlockers: [],
      }],
    } as any);

    await expect(service.closeMonth("tenant-1", "user-1", {
      period, roomIds: ["known-room", "missing-room"], autoSend: false,
    })).rejects.toBeTruthy();
    expect(prisma.invoice.create).not.toHaveBeenCalled();
    expect(prisma.billingSnapshot.createMany).not.toHaveBeenCalled();
    expect(hunonicService.lockPeriods).not.toHaveBeenCalled();
  });

  it("deduplicates SHARED finalize locks to one room-period row", async () => {
    const { service, hunonicService } = createService();
    vi.spyOn(service, "getOverview").mockResolvedValue({
      items: [
        { roomId: "room-1", roomCode: "101", buildingCode: "A", hasContract: true, electricityEligible: true, meterReading: { id: "meter" }, settlementBlockers: [] },
        { roomId: "room-1", roomCode: "101", buildingCode: "A", hasContract: true, electricityEligible: true, meterReading: { id: "meter" }, settlementBlockers: [] },
      ],
    } as any);

    const result = await service.finalizeUsagePeriod("tenant-1", { period: usagePeriod });

    expect(result.lockedCount).toBe(1);
    expect(hunonicService.lockPeriods).toHaveBeenCalledWith("tenant-1", {
      rows: [expect.objectContaining({ buildingCode: "A", roomCode: "101", period: usagePeriod })],
    });
  });

  it("does not count a cross-tenant Occupancy toward the canonical room roster", async () => {
    const foreignOccupancy = {
      id: "foreign-occupancy", tenantId: "tenant-2", roomId: "foreign-room", customerId: "foreign-customer", contractId: "contract-a",
      joinedAt: new Date("2026-09-01T00:00:00.000Z"), leftAt: null,
      customer: { id: "foreign-customer", tenantId: "tenant-2", fullName: "Foreign customer" },
    };
    const { service } = createService({
      rooms: [room([contract("contract-a", "live-a")], [foreignOccupancy], "WHOLE")],
    });

    const overview = await service.getOverview("tenant-1", { period });

    expect(overview.items[0].membersCount).toBe(0);
    expect(overview.items[0].settlementBlockers).not.toEqual([]);
  });

  it("allows a legacy missing Occupancy tenant marker only when all reachable scope is tenant-consistent", async () => {
    const contractA = contract("contract-a", "payer", {
      tenantId: "tenant-1", customer: { id: "payer", tenantId: "tenant-1", fullName: "Payer" },
    });
    const legacyOccupancy = {
      id: "legacy-occupancy", roomId: "room-1", customerId: "payer", contractId: "contract-a",
      joinedAt: new Date("2026-09-01T00:00:00.000Z"), leftAt: null,
      customer: { id: "payer", tenantId: "tenant-1", fullName: "Payer" },
    };
    const { service } = createService({ rooms: [room([contractA], [legacyOccupancy], "WHOLE")] });

    const overview = await service.getOverview("tenant-1", { period });

    expect(overview.items[0]).toMatchObject({ membersCount: 1, settlementBlockers: [] });
  });

  it("requires a structurally valid payerSnapshot on a locked allocation", async () => {
    const invalidPayerSnapshot = snapshot({
      allocations: [
        { contractId: "contract-a", customerId: "payer-a", payerSnapshot: { id: "payer-a", fullName: "" }, memberCount: 1, eligible: true, electricityKwh: 0.1, electricityAmount: 1, waterAmount: 100_000 },
        { contractId: "contract-b", customerId: "payer-b", payerSnapshot: { id: "payer-b", fullName: "Payer B" }, memberCount: 1, eligible: true, electricityKwh: 0.2, electricityAmount: 2, waterAmount: 100_000 },
      ],
    });
    const { service } = createService({
      rooms: [room([contract("contract-a", "live-a"), contract("contract-b", "live-b")])], snapshots: [invalidPayerSnapshot],
    });

    const overview = await service.getOverview("tenant-1", { period });

    expect(overview.items.flatMap((item: any) => item.settlementBlockers).map((blocker: any) => blocker.code)).toContain(
      "LOCKED_SNAPSHOT_PAYER_INVALID",
    );
  });

  it("ignores a same-period manual invoice instead of replacing locked economics", async () => {
    const manualInvoice = {
      id: "manual-invoice", billingKind: "ADJUSTMENT", period, contractId: "contract-a",
      code: "INV-202610-101", baseInvoiceKey: null, status: "ISSUED", total: 9_999_999,
      contract: { id: "contract-a", roomId: "room-1" }, items: [{ type: "UTILITY_ELECTRICITY", amount: 9_999_999 }],
    };
    const { service } = createService({
      rooms: [room([contract("contract-a", "live-a"), contract("contract-b", "live-b")])], snapshots: [snapshot()], invoices: [manualInvoice],
    });

    const overview = await service.getOverview("tenant-1", { period });
    const itemA = overview.items.find((item: any) => item.contractId === "contract-a");

    expect(itemA).toMatchObject({ invoiceId: null, electricityKwh: 0.1, electricityAmount: 1, waterAmount: 100_000 });
    expect(itemA.settlementBlockers).toEqual([]);
  });

  it("blocks a mismatched canonical utility invoice without overwriting its locked snapshot", async () => {
    const canonicalInvoice = {
      id: "base-invoice", billingKind: "MONTHLY_BASE", period, contractId: "contract-a",
      baseInvoiceKey: "MONTHLY:contract-a:2026-10", code: "INV-202610-101", status: "ISSUED", total: 1_000_000,
      contract: { id: "contract-a", roomId: "room-1" },
      items: [
        { type: "RENT", amount: 1_000_000 },
        { type: "UTILITY_ELECTRICITY", amount: 99 },
        { type: "UTILITY_WATER", amount: 999_999 },
      ],
    };
    const { service, prisma, hunonicService } = createService({
      rooms: [room([contract("contract-a", "live-a"), contract("contract-b", "live-b")])], snapshots: [snapshot()], invoices: [canonicalInvoice],
    });

    const overview = await service.getOverview("tenant-1", { period });
    const itemA = overview.items.find((item: any) => item.contractId === "contract-a");
    expect(itemA).toMatchObject({ electricityAmount: 1, waterAmount: 100_000 });
    expect(itemA.settlementBlockers.map((blocker: any) => blocker.code)).toContain(
      "LOCKED_SNAPSHOT_INVOICE_UTILITY_MISMATCH",
    );

    await expect(service.closeMonth("tenant-1", "user-1", { period, autoSend: false })).rejects.toBeTruthy();
    expect(prisma.billingSnapshot.createMany).not.toHaveBeenCalled();
    expect(prisma.invoice.create).not.toHaveBeenCalled();
    expect(hunonicService.lockPeriods).not.toHaveBeenCalled();
  });

  it("reads Hunonic in explicitly read-only mode before overview preflight", async () => {
    const { service, hunonicService } = createService();

    await service.getOverview("tenant-1", { period });

    expect(hunonicService.getOverview).toHaveBeenCalledWith("tenant-1", {
      allowAutoLock: false,
    });
  });

  it.each([
    ["is missing the positive electricity item", [
      { type: "RENT", amount: 1_000_000 },
      { type: "UTILITY_WATER", amount: 100_000, billingSnapshotId: "locked-1", servicePeriod: usagePeriod },
    ], 1_100_000],
    ["has duplicate positive electricity items", [
      { type: "RENT", amount: 1_000_000 },
      { type: "UTILITY_ELECTRICITY", amount: 1, billingSnapshotId: "locked-1", servicePeriod: usagePeriod },
      { type: "UTILITY_ELECTRICITY", amount: 1, billingSnapshotId: "locked-1", servicePeriod: usagePeriod },
      { type: "UTILITY_WATER", amount: 100_000, billingSnapshotId: "locked-1", servicePeriod: usagePeriod },
    ], 1_100_002],
    ["links electricity to another snapshot or service period", [
      { type: "RENT", amount: 1_000_000 },
      { type: "UTILITY_ELECTRICITY", amount: 1, billingSnapshotId: "other-snapshot", servicePeriod: period },
      { type: "UTILITY_WATER", amount: 100_000, billingSnapshotId: "locked-1", servicePeriod: usagePeriod },
    ], 1_100_001],
    ["has invoice totals inconsistent with its exact item sum", [
      { type: "RENT", amount: 1_000_000 },
      { type: "UTILITY_ELECTRICITY", amount: 1, billingSnapshotId: "locked-1", servicePeriod: usagePeriod },
      { type: "UTILITY_WATER", amount: 100_000, billingSnapshotId: "locked-1", servicePeriod: usagePeriod },
    ], 1_100_999],
  ])("blocks and performs zero writes when a locked MONTHLY_BASE %s", async (_label, items, total) => {
    const canonicalInvoice = {
      id: "base-invoice", billingKind: "MONTHLY_BASE", period, contractId: "contract-a",
      baseInvoiceKey: "MONTHLY:contract-a:2026-10", code: "INV-202610-101", status: "ISSUED",
      total, subtotal: total, contract: { id: "contract-a", roomId: "room-1" }, items,
    };
    const { service, prisma, hunonicService } = createService({
      rooms: [room([contract("contract-a", "live-a"), contract("contract-b", "live-b")])],
      snapshots: [snapshot()], invoices: [canonicalInvoice],
    });

    const overview = await service.getOverview("tenant-1", { period });
    expect(overview.items.find((item: any) => item.contractId === "contract-a")?.settlementBlockers).not.toEqual([]);

    await expect(service.closeMonth("tenant-1", "user-1", { period, autoSend: false })).rejects.toBeTruthy();
    expect(prisma.invoice.create).not.toHaveBeenCalled();
    expect(prisma.billingSnapshot.createMany).not.toHaveBeenCalled();
    expect(hunonicService.lockPeriods).not.toHaveBeenCalled();
  });

  it.each([
    ["omits the payer tenant", { id: "payer-a", fullName: "Payer A" }, { customerId: "payer-a", contractId: "contract-a", fullName: "Snapshot A" }],
    ["uses a payer from a foreign tenant", { id: "payer-a", fullName: "Payer A", tenantId: "tenant-2" }, { customerId: "payer-a", contractId: "contract-a", fullName: "Snapshot A", tenantId: "tenant-1" }],
    ["uses an occupant from a foreign tenant", { id: "payer-a", fullName: "Payer A", tenantId: "tenant-1" }, { customerId: "payer-a", contractId: "contract-a", fullName: "Snapshot A", tenantId: "tenant-2" }],
  ])("CORE-07-v2 blocks a locked allocation that %s", async (_label, payerSnapshot, occupant) => {
    const locked = snapshot({
      occupants: [occupant, { customerId: "payer-b", contractId: "contract-b", fullName: "Snapshot B", tenantId: "tenant-1" }],
      allocations: [
        { contractId: "contract-a", customerId: "payer-a", payerSnapshot, memberCount: 1, eligible: true, electricityKwh: 0.1, electricityAmount: 1, waterAmount: 100_000 },
        { contractId: "contract-b", customerId: "payer-b", payerSnapshot: { id: "payer-b", fullName: "Payer B", tenantId: "tenant-1" }, memberCount: 1, eligible: true, electricityKwh: 0.2, electricityAmount: 2, waterAmount: 100_000 },
      ],
    });
    const { service, prisma, hunonicService } = createService({
      rooms: [room([contract("contract-a", "live-a"), contract("contract-b", "live-b")])], snapshots: [locked],
    });

    const overview = await service.getOverview("tenant-1", { period });
    expect(overview.items.flatMap((item: any) => item.settlementBlockers)).not.toEqual([]);
    await expect(service.closeMonth("tenant-1", "user-1", { period, autoSend: false })).rejects.toBeTruthy();
    expect(prisma.invoice.create).not.toHaveBeenCalled();
    expect(prisma.billingSnapshot.createMany).not.toHaveBeenCalled();
    expect(hunonicService.lockPeriods).not.toHaveBeenCalled();
  });

  it("blocks an unbound WHOLE occupancy even when the competing terminal contract is already settled", () => {
    const active = contract("active", "active-payer", { tenantId: "tenant-1", customer: { id: "active-payer", tenantId: "tenant-1", fullName: "Active" } });
    const settledTerminal = contract("terminal", "terminal-payer", {
      tenantId: "tenant-1", status: "TERMINATED", settlement: { id: "settled" },
      customer: { id: "terminal-payer", tenantId: "tenant-1", fullName: "Terminal" },
    });
    const resolution = resolveCanonicalRoomPeriodOccupancy({
      tenantId: "tenant-1", rentalType: "WHOLE", contracts: [active, settledTerminal],
      occupancies: [{ id: "unbound", tenantId: "tenant-1", customerId: "active-payer", contractId: null, joinedAt: new Date("2026-09-01"), leftAt: null, customer: active.customer }],
      periodStart: new Date("2026-09-01"), nextPeriodStart: new Date("2026-10-01"),
    });

    expect(resolution.blockers.map((blocker) => blocker.code)).toContain("WHOLE_UNBOUND_OCCUPANCY_AMBIGUOUS");
    expect(resolution.byContractId.get("active")?.membersCount).toBe(0);
  });

  it("retries the remaining shared invoice from locked source evidence after a newer observation arrives", async () => {
    const locked = snapshot({
      sourceReadingId: "reading-a", meterMappingId: "mapping-a",
      sourceProvenance: { sourceReadingId: "reading-a", meterMappingId: "mapping-a", readingPayloadHash: "hash-a", rentalType: "SHARED", billingScope: "CONTRACT" },
    });
    const { service, prisma } = createService({
      rooms: [room([contract("contract-a", "live-a"), contract("contract-b", "live-b")])],
      snapshots: [locked],
      latestReading: { id: "reading-b", meterMappingId: "mapping-a" },
    });
    await expect(service.closeMonth("tenant-1", "user-1", { period, autoSend: false })).resolves.toMatchObject({ settledCount: 2 });
    expect(prisma.billingSnapshot.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ sourceReadingId: "reading-a", meterMappingId: "mapping-a" })],
      skipDuplicates: true,
    });
  });

  it("accepts the exact immutable snapshot returned by create-only lookup during a real locked retry", async () => {
    const candidate = {
      roomId: "room-1", roomCode: "101", buildingCode: "A", roomRentalType: "WHOLE", billingScope: "ROOM",
      contractId: "contract-a", rentalCycleId: null,
      representative: { id: "payer-a", fullName: "Payer A" }, hasContract: true,
      totalAmount: 1_100_003, roomPrice: 1_000_000, waterAmount: 100_000, electricityAmount: 3,
      electricityKwh: 0.3, roomElectricityKwh: 0.3, roomElectricityAmount: 3, serviceAmount: 0,
      waterEligible: true, electricityEligible: true, serviceEligible: false, utilityShareRatio: 1,
      membersCount: 1,
      members: [{ id: "payer-a", tenantId: "tenant-1", fullName: "Payer A", occupancyId: "occupancy-a" }],
      meterReading: {
        sourceReadingId: "reading-a", meterMappingId: "mapping-a", sourcePayloadHash: "hash-a",
        sourceProvider: "hunonic", sourceProviderMeterId: "provider-meter-a", snapshotId: null,
        rateMode: "residential", customRateVnd: null,
      },
      settlementBlockers: [],
    };
    const first = createService();
    vi.spyOn(first.service, "getOverview").mockResolvedValue({ items: [candidate] } as any);
    first.prisma.hunonicMeterReading.findFirst.mockImplementation(async ({ where }: any) => ({
      id: where.id || "reading-a", meterMappingId: "mapping-a", payloadHash: "hash-a",
    }));

    await expect(first.service.closeMonth("tenant-1", "user-1", { period, autoSend: false })).resolves.toBeTruthy();
    const lockedCreate = first.prisma.billingSnapshot.createMany.mock.calls[0][0].data[0];
    const lockedSnapshot = { id: "locked-real", ...lockedCreate };
    const activeContract = contract("contract-a", "payer-a", {
      tenantId: "tenant-1",
      customer: { id: "payer-a", tenantId: "tenant-1", fullName: "Payer A" },
    });
    const retry = createService({
      rooms: [room([activeContract], [], "WHOLE")],
      snapshots: [lockedSnapshot],
      latestReading: { id: "reading-b", meterMappingId: "mapping-a", payloadHash: "hash-b" },
    });
    await expect(retry.service.closeMonth("tenant-1", "user-2", { period, autoSend: false })).resolves.toBeTruthy();
    expect(retry.prisma.invoice.create).toHaveBeenCalledTimes(1);
  });

  it("preflights every requested room before writing when a later room lacks a persisted observation", async () => {
    const { service, prisma, hunonicService } = createService();
    vi.spyOn(service, "getOverview").mockResolvedValue({
      items: [
        { roomId: "room-first", roomCode: "101", buildingCode: "A", contractId: "contract-a", representative: { id: "payer-a" }, hasContract: true, totalAmount: 1_000_000, settlementBlockers: [] },
        { roomId: "room-second", roomCode: "102", buildingCode: "A", contractId: "contract-b", representative: { id: "payer-b" }, hasContract: true, totalAmount: 1_000_000, settlementBlockers: [{ code: "BILLING_SNAPSHOT_REQUIRES_PERSISTED_OBSERVATION" }] },
      ],
    } as any);

    await expect(service.closeMonth("tenant-1", "user-1", { period, autoSend: false })).rejects.toBeTruthy();
    expect(prisma.invoice.create).not.toHaveBeenCalled();
    expect(prisma.billingSnapshot.createMany).not.toHaveBeenCalled();
    expect(hunonicService.lockPeriods).not.toHaveBeenCalled();
  });

  it("fails closed when a tenant-A Occupancy links a tenant-B customer", async () => {
    const payer = contract("contract-a", "payer-a", {
      tenantId: "tenant-1",
      customer: { id: "payer-a", tenantId: "tenant-1", fullName: "Payer A" },
    });
    const foreignCustomerOccupancy = {
      id: "occupancy-foreign-customer", tenantId: "tenant-1", roomId: "room-1",
      customerId: "occupant-b", contractId: "contract-a",
      joinedAt: new Date("2026-09-01T00:00:00.000Z"), leftAt: null,
      customer: { id: "occupant-b", tenantId: "tenant-2", fullName: "Foreign customer" },
    };
    const resolution = resolveCanonicalRoomPeriodOccupancy({
      tenantId: "tenant-1", rentalType: "WHOLE", contracts: [payer],
      occupancies: [foreignCustomerOccupancy],
      periodStart: new Date("2026-09-01T00:00:00.000Z"),
      nextPeriodStart: new Date("2026-10-01T00:00:00.000Z"),
    });
    expect(resolution.blockers.map((blocker) => blocker.code)).toContain(
      "OCCUPANCY_CUSTOMER_TENANT_MISMATCH",
    );

    const { service, prisma, hunonicService } = createService({
      rooms: [room([payer], [foreignCustomerOccupancy], "WHOLE")],
    });
    await expect(service.closeMonth("tenant-1", "user-1", { period, autoSend: false })).rejects.toBeTruthy();
    expect(prisma.invoice.create).not.toHaveBeenCalled();
    expect(prisma.billingSnapshot.createMany).not.toHaveBeenCalled();
    expect(hunonicService.lockPeriods).not.toHaveBeenCalled();
  });

  it("preflights the real overview before writes when a later room has only a positive live Hunonic value", async () => {
    const firstContract = contract("contract-first", "payer-first");
    const secondContract = contract("contract-second", "payer-second");
    const firstOccupancy = {
      id: "occupancy-first", tenantId: "tenant-1", roomId: "room-1", customerId: "payer-first", contractId: "contract-first",
      joinedAt: new Date("2026-09-01T00:00:00.000Z"), leftAt: null,
      customer: { id: "payer-first", tenantId: "tenant-1", fullName: "First" },
    };
    const secondOccupancy = {
      id: "occupancy-second", tenantId: "tenant-1", roomId: "room-2", customerId: "payer-second", contractId: "contract-second",
      joinedAt: new Date("2026-09-01T00:00:00.000Z"), leftAt: null,
      customer: { id: "payer-second", tenantId: "tenant-1", fullName: "Second" },
    };
    const roomTwo = {
      ...room([secondContract], [secondOccupancy], "WHOLE"), id: "room-2", code: "102", name: "Phòng 102",
    };
    const persistedFirst = {
      id: "reading-first", tenantId: "tenant-1", roomId: "room-1", meterMappingId: "mapping-first",
      currentMonth: usagePeriod, sourcePeriod: usagePeriod, aggregateBasis: "MONTHLY_AGGREGATE_V1",
      energyMonthKwh: 1, moneyMonthVnd: 3, readingAt: new Date("2026-09-30T16:59:59.999Z"),
      meterMapping: { id: "mapping-first" },
    };
    const { service, prisma, hunonicService } = createService({
      rooms: [room([firstContract], [firstOccupancy], "WHOLE"), roomTwo], readings: [persistedFirst],
      latestReading: { id: "reading-first", meterMappingId: "mapping-first", payloadHash: null },
    });
    hunonicService.getOverview.mockResolvedValue({
      meters: [{ id: "mapping-second", buildingCode: "A", roomCode: "102", energyMonthKwh: 2, moneyMonthVnd: 6, status: "on" }],
    });

    const overview = await service.getOverview("tenant-1", { period });
    const second = overview.items.find((item: any) => item.roomId === "room-2");
    expect(second).toMatchObject({ electricityAmount: 6, billingDataSource: "LIVE_MAPPING" });
    expect(second.meterReading.sourceReadingId).toBeNull();

    await expect(service.closeMonth("tenant-1", "user-1", { period, autoSend: false })).rejects.toBeTruthy();
    expect(prisma.invoice.create).not.toHaveBeenCalled();
    expect(prisma.billingSnapshot.createMany).not.toHaveBeenCalled();
    expect(hunonicService.lockPeriods).not.toHaveBeenCalled();
  });

  it("rejects an immutable concurrent snapshot winner that differs from the candidate before invoice creation", async () => {
    const { service, prisma } = createService();
    const candidate = {
      roomId: "room-1", roomCode: "101", buildingCode: "A", roomRentalType: "SHARED", billingScope: "CONTRACT",
      contractId: "contract-a", representative: { id: "payer-a", fullName: "Payer A" }, hasContract: true,
      totalAmount: 1_100_003, roomPrice: 1_000_000, waterAmount: 100_000, electricityAmount: 3,
      electricityKwh: 0.3, roomElectricityKwh: 0.3, roomElectricityAmount: 3, serviceAmount: 0,
      waterEligible: true, electricityEligible: true, serviceEligible: false, utilityShareRatio: 1,
      membersCount: 1, members: [{ id: "payer-a", tenantId: "tenant-1", fullName: "Payer A" }],
      meterReading: { sourceReadingId: "reading-a", meterMappingId: "mapping-a", sourcePayloadHash: "hash-a" },
      settlementBlockers: [],
    };
    vi.spyOn(service, "getOverview").mockResolvedValue({ items: [candidate] } as any);
    prisma.hunonicMeterReading.findFirst.mockImplementation(async ({ where, orderBy }: any) => {
      if (where.id === "reading-a") {
        expect(where).toMatchObject({ id: "reading-a", tenantId: "tenant-1", roomId: "room-1", meterMappingId: "mapping-a", sourcePeriod: usagePeriod });
        return { id: "reading-a", meterMappingId: "mapping-a", payloadHash: "hash-a" };
      }
      expect(where).toMatchObject({ tenantId: "tenant-1", roomId: "room-1", sourcePeriod: usagePeriod, aggregateBasis: "MONTHLY_AGGREGATE_V1" });
      expect(where).not.toHaveProperty("id");
      expect(where).not.toHaveProperty("meterMappingId");
      expect(orderBy).toEqual(expect.any(Array));
      return { id: "reading-a", meterMappingId: "mapping-a", payloadHash: "hash-a" };
    });
    prisma.billingSnapshot.findUnique.mockImplementation(async ({ where }: any) => {
      expect(where).toEqual({ tenantId_roomId_usagePeriod: { tenantId: "tenant-1", roomId: "room-1", usagePeriod } });
      return {
        id: "concurrent-winner", sourceReadingId: "reading-other", meterMappingId: "mapping-other",
        sourceProvenance: { readingPayloadHash: "hash-other" }, occupants: [], allocations: [],
      };
    });

    await expect(service.closeMonth("tenant-1", "user-1", { period, autoSend: false })).rejects.toThrow(
      "BILLING_SNAPSHOT_CONCURRENT_WINNER_CONFLICT",
    );
    expect(prisma.billingSnapshot.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ sourceReadingId: "reading-a", meterMappingId: "mapping-a" })],
      skipDuplicates: true,
    });
    expect(prisma.invoice.create).not.toHaveBeenCalled();
  });

  it("retries an unlocked candidate when a newer room observation on a replacement mapping wins before the evidence lock", async () => {
    const { service, prisma } = createService();
    const candidate = {
      roomId: "room-1", roomCode: "101", buildingCode: "A", roomRentalType: "WHOLE", billingScope: "ROOM",
      contractId: "contract-a", representative: { id: "payer-a", fullName: "Payer A" }, hasContract: true,
      totalAmount: 1_100_003, roomPrice: 1_000_000, waterAmount: 100_000, electricityAmount: 3,
      electricityKwh: 0.3, roomElectricityKwh: 0.3, roomElectricityAmount: 3, serviceAmount: 0,
      waterEligible: true, electricityEligible: true, serviceEligible: false, utilityShareRatio: 1,
      membersCount: 1, members: [{ id: "payer-a", tenantId: "tenant-1", fullName: "Payer A" }],
      meterReading: { sourceReadingId: "reading-a", meterMappingId: "mapping-a", sourcePayloadHash: "hash-a", snapshotId: null },
      settlementBlockers: [],
    };
    vi.spyOn(service, "getOverview").mockResolvedValue({ items: [candidate] } as any);
    prisma.hunonicMeterReading.findFirst.mockImplementation(async ({ where, orderBy }: any) => {
      // A correct unlocked-candidate query selects the current canonical row;
      // an id-pinned lookup incorrectly hides this newer observation.
      if (where.id === "reading-a") return { id: "reading-a", meterMappingId: "mapping-a", payloadHash: "hash-a" };
      expect(where).toMatchObject({ tenantId: "tenant-1", roomId: "room-1", sourcePeriod: usagePeriod, aggregateBasis: "MONTHLY_AGGREGATE_V1" });
      expect(where).not.toHaveProperty("meterMappingId");
      expect(orderBy).toEqual(expect.any(Array));
      return { id: "reading-b", meterMappingId: "mapping-b", payloadHash: "hash-b" };
    });

    await expect(service.closeMonth("tenant-1", "user-1", { period, autoSend: false })).rejects.toThrow(
      "BILLING_SNAPSHOT_SOURCE_CHANGED_RETRY",
    );
    expect(prisma.billingSnapshot.createMany).not.toHaveBeenCalled();
    expect(prisma.invoice.create).not.toHaveBeenCalled();
  });

  it("blocks legacy unverified evidence in a later room before writing the first room", async () => {
    const firstContract = contract("contract-first", "payer-first", {
      tenantId: "tenant-1", customer: { id: "payer-first", tenantId: "tenant-1", fullName: "First" },
    });
    const secondContract = contract("contract-second", "payer-second", {
      tenantId: "tenant-1", customer: { id: "payer-second", tenantId: "tenant-1", fullName: "Second" },
    });
    const occupancyFor = (id: string, roomId: string, contractId: string, customerId: string) => ({
      id, tenantId: "tenant-1", roomId, customerId, contractId,
      joinedAt: new Date("2026-09-01T00:00:00.000Z"), leftAt: null,
      customer: { id: customerId, tenantId: "tenant-1", fullName: customerId },
    });
    const roomTwo = {
      ...room([secondContract], [occupancyFor("occupancy-second", "room-2", "contract-second", "payer-second")], "WHOLE"),
      id: "room-2", code: "102", name: "Phòng 102",
    };
    const readings = [
      {
        id: "reading-first", tenantId: "tenant-1", roomId: "room-1", meterMappingId: "mapping-first",
        sourcePeriod: usagePeriod, aggregateBasis: "MONTHLY_AGGREGATE_V1", energyMonthKwh: 1,
        moneyMonthVnd: 3, readingAt: new Date("2026-09-30T16:00:00.000Z"),
      },
      {
        id: "reading-legacy", tenantId: "tenant-1", roomId: "room-2", meterMappingId: "mapping-legacy",
        sourcePeriod: usagePeriod, aggregateBasis: "LEGACY_UNVERIFIED_AGGREGATE_V1", energyMonthKwh: 2,
        moneyMonthVnd: 6, readingAt: new Date("2026-09-30T16:30:00.000Z"),
      },
    ];
    const { service, prisma, hunonicService } = createService({
      rooms: [
        room([firstContract], [occupancyFor("occupancy-first", "room-1", "contract-first", "payer-first")], "WHOLE"),
        roomTwo,
      ],
      readings,
      latestReading: { id: "reading-first", meterMappingId: "mapping-first" },
    });

    const overview = await service.getOverview("tenant-1", { period });
    expect(overview.items.find((item: any) => item.roomId === "room-2")?.settlementBlockers)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ code: "BILLING_SNAPSHOT_LEGACY_EVIDENCE_REQUIRES_RECONCILIATION" }),
      ]));
    await expect(service.closeMonth("tenant-1", "user-1", { period, autoSend: false })).rejects.toBeTruthy();
    expect(prisma.invoice.create).not.toHaveBeenCalled();
    expect(prisma.billingSnapshot.createMany).not.toHaveBeenCalled();
    expect(hunonicService.lockPeriods).not.toHaveBeenCalled();
  });

  it("blocks an unbound WHOLE occupancy when an overlapping terminal contract is soft-deleted", async () => {
    const active = contract("active", "active-payer", {
      tenantId: "tenant-1", customer: { id: "active-payer", tenantId: "tenant-1", fullName: "Active" },
    });
    const deletedTerminal = contract("terminal", "terminal-payer", {
      tenantId: "tenant-1", status: "TERMINATED", deletedAt: new Date("2026-09-15T00:00:00.000Z"),
      settlement: { id: "settled" },
      customer: { id: "terminal-payer", tenantId: "tenant-1", fullName: "Terminal" },
    });
    const unbound = {
      id: "unbound", tenantId: "tenant-1", roomId: "room-1", customerId: "active-payer", contractId: null,
      joinedAt: new Date("2026-09-01T00:00:00.000Z"), leftAt: null, customer: active.customer,
    };
    const { service } = createService({ rooms: [room([active, deletedTerminal], [unbound], "WHOLE")] });

    const overview = await service.getOverview("tenant-1", { period });
    expect(overview.items.flatMap((item: any) => item.settlementBlockers)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "WHOLE_UNBOUND_OCCUPANCY_AMBIGUOUS" })]),
    );
  });

  it.each([
    ["wrong rent amount", {
      total: 1_100_000, subtotal: 1_100_000,
      items: [
        { type: "RENT", amount: 999_999, servicePeriod: period },
        { type: "UTILITY_ELECTRICITY", amount: 1, billingSnapshotId: "locked-1", servicePeriod: usagePeriod },
        { type: "UTILITY_WATER", amount: 100_000, billingSnapshotId: "locked-1", servicePeriod: usagePeriod },
      ],
    }],
    ["wrong payer", { customerId: "payer-other" }],
    ["wrong rental cycle", { rentalCycleId: "cycle-other" }],
    ["wrong usage period", { usagePeriod: period }],
  ])("blocks a locked canonical MONTHLY_BASE with %s", async (_label, override) => {
    const canonicalInvoice = {
      id: "base-invoice", tenantId: "tenant-1", billingKind: "MONTHLY_BASE", period, usagePeriod,
      contractId: "contract-a", customerId: "payer-a", rentalCycleId: null,
      baseInvoiceKey: "MONTHLY:contract-a:2026-10", code: "INV-202610-101", status: "ISSUED",
      total: 1_100_001, subtotal: 1_100_001, discount: 0,
      contract: { id: "contract-a", roomId: "room-1" },
      items: [
        { type: "RENT", amount: 1_000_000, servicePeriod: period },
        { type: "UTILITY_ELECTRICITY", amount: 1, billingSnapshotId: "locked-1", servicePeriod: usagePeriod },
        { type: "UTILITY_WATER", amount: 100_000, billingSnapshotId: "locked-1", servicePeriod: usagePeriod },
      ],
      ...override,
    };
    const { service, prisma } = createService({
      rooms: [room([contract("contract-a", "live-a"), contract("contract-b", "live-b")])],
      snapshots: [snapshot()], invoices: [canonicalInvoice],
    });

    const overview = await service.getOverview("tenant-1", { period });
    expect(overview.items.find((item: any) => item.contractId === "contract-a")?.settlementBlockers).not.toEqual([]);
    await expect(service.closeMonth("tenant-1", "user-1", { period, autoSend: false })).rejects.toBeTruthy();
    expect(prisma.invoice.create).not.toHaveBeenCalled();
    expect(prisma.billingSnapshot.createMany).not.toHaveBeenCalled();
  });
});
