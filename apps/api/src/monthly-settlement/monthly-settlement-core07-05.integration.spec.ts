import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it, vi } from "vitest";
import { MonthlySettlementService } from "./monthly-settlement.service";

const testDatabaseUrl = process.env.TEST_DATABASE_URL || "";
const dbDescribe =
  process.env.RUN_MONTHLY_SETTLEMENT_CORE0705_DB_TESTS === "1" &&
  /test|tmp|ci|isolated/i.test(testDatabaseUrl)
    ? describe
    : describe.skip;

dbDescribe("CORE-07.05 PostgreSQL shared-room immutable snapshot replay", () => {
  const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl } } });
  const suffix = randomUUID().replace(/-/g, "").slice(0, 10);
  const ids = {
    tenant: `tenant-0705-${suffix}`,
    building: `building-0705-${suffix}`,
    floor: `floor-0705-${suffix}`,
    room: `room-0705-${suffix}`,
    customerA: `customer-0705-a-${suffix}`,
    customerB: `customer-0705-b-${suffix}`,
    cycleA: `cycle-0705-a-${suffix}`,
    cycleB: `cycle-0705-b-${suffix}`,
    contractA: `contract-0705-a-${suffix}`,
    contractB: `contract-0705-b-${suffix}`,
    occupancyA: `occupancy-0705-a-${suffix}`,
    occupancyB: `occupancy-0705-b-${suffix}`,
    mapping: `mapping-0705-${suffix}`,
    reading: `reading-0705-${suffix}`,
  };
  const hunonicService = {
    getOverview: vi.fn().mockResolvedValue({ meters: [] }),
    lockPeriods: vi.fn().mockResolvedValue({ success: true }),
  };
  const createService = (client: any) => new MonthlySettlementService(
    client,
    {} as any,
    {} as any,
    {} as any,
    hunonicService as any,
    { log: vi.fn().mockResolvedValue(undefined) } as any,
  );
  const service = createService(prisma as any);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates one snapshot for two contracts and resumes the missing invoice without UPDATE", async () => {
    await prisma.tenantOrg.create({
      data: { id: ids.tenant, name: "CORE 07.05", code: `C0705-${suffix}` },
    });
    await prisma.building.create({
      data: { id: ids.building, tenantId: ids.tenant, code: `B-${suffix}`, name: "Tòa CORE 07.05" },
    });
    await prisma.floor.create({
      data: { id: ids.floor, tenantId: ids.tenant, buildingId: ids.building, level: 1, name: "Tầng 1" },
    });
    await prisma.room.create({
      data: {
        id: ids.room, tenantId: ids.tenant, buildingId: ids.building, floorId: ids.floor,
        code: "101", name: "Phòng ghép", monthlyPrice: 2_500_000, rentalType: "SHARED",
        capacity: 4, status: "OCCUPIED",
      },
    });
    await prisma.customer.createMany({
      data: [
        { id: ids.customerA, tenantId: ids.tenant, fullName: "Khách A", phone: `0705A${suffix.slice(0, 5)}` },
        { id: ids.customerB, tenantId: ids.tenant, fullName: "Khách B", phone: `0705B${suffix.slice(0, 5)}` },
      ],
    });
    await prisma.rentalCycle.createMany({
      data: [
        { id: ids.cycleA, tenantId: ids.tenant, customerId: ids.customerA, roomId: ids.room, status: "ACTIVE", actualMoveInAt: new Date("2026-08-01T00:00:00.000Z") },
        { id: ids.cycleB, tenantId: ids.tenant, customerId: ids.customerB, roomId: ids.room, status: "ACTIVE", actualMoveInAt: new Date("2026-08-01T00:00:00.000Z") },
      ],
    });
    await prisma.contract.createMany({
      data: [
        { id: ids.contractA, tenantId: ids.tenant, roomId: ids.room, customerId: ids.customerA, rentalCycleId: ids.cycleA, code: `HD-A-${suffix}`, status: "ACTIVE", startDate: new Date("2026-08-01T00:00:00.000Z"), endDate: new Date("2027-07-31T00:00:00.000Z"), monthlyRent: 1_000_000, depositMoney: 1_000_000 },
        { id: ids.contractB, tenantId: ids.tenant, roomId: ids.room, customerId: ids.customerB, rentalCycleId: ids.cycleB, code: `HD-B-${suffix}`, status: "ACTIVE", startDate: new Date("2026-08-01T00:00:00.000Z"), endDate: new Date("2027-07-31T00:00:00.000Z"), monthlyRent: 1_500_000, depositMoney: 1_500_000 },
      ],
    });
    await prisma.occupancy.createMany({
      data: [
        { id: ids.occupancyA, tenantId: ids.tenant, roomId: ids.room, customerId: ids.customerA, contractId: ids.contractA, rentalCycleId: ids.cycleA, role: "ĐẠI DIỆN", joinedAt: new Date("2026-08-01T00:00:00.000Z") },
        { id: ids.occupancyB, tenantId: ids.tenant, roomId: ids.room, customerId: ids.customerB, contractId: ids.contractB, rentalCycleId: ids.cycleB, role: "ĐẠI DIỆN", joinedAt: new Date("2026-08-01T00:00:00.000Z") },
      ],
    });
    await prisma.hunonicMeterMapping.create({
      data: {
        id: ids.mapping, tenantId: ids.tenant, buildingId: ids.building, roomId: ids.room,
        buildingCode: `B-${suffix}`, roomCode: "101", displayName: "B-101",
        providerMeterId: `meter-${suffix}`, deviceName: "Meter CORE 07.05",
      },
    });
    await prisma.hunonicMeterReading.create({
      data: {
        id: ids.reading, tenantId: ids.tenant, meterMappingId: ids.mapping, roomId: ids.room,
        readingAt: new Date("2026-08-31T16:59:59.999Z"), observedAt: new Date("2026-08-31T16:59:59.999Z"),
        currentMonth: "2026-08", sourcePeriod: "2026-08", sourceProvider: "hunonic",
        sourceProviderMeterId: `meter-${suffix}`, payloadHash: "a".repeat(64),
        aggregateBasis: "MONTHLY_AGGREGATE_V1", energyMonthKwh: 30, moneyMonthVnd: 120_000,
      } as any,
    });

    let transactionCount = 0;
    const interruptedPrisma = new Proxy(prisma as any, {
      get(target, property, receiver) {
        if (property === "$transaction") {
          return (...args: any[]) => {
            transactionCount += 1;
            if (transactionCount === 2) {
              return Promise.reject(new Error("SIMULATED_PROCESS_INTERRUPTION"));
            }
            return target.$transaction(...args);
          };
        }
        const value = Reflect.get(target, property, receiver);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    const interruptedService = createService(interruptedPrisma);
    await expect(interruptedService.closeMonth(ids.tenant, "user-first", {
      period: "2026-09", roomIds: [ids.room], autoSend: false,
    })).rejects.toThrow("SIMULATED_PROCESS_INTERRUPTION");
    expect(await prisma.invoice.count({ where: { tenantId: ids.tenant, billingKind: "MONTHLY_BASE", period: "2026-09" } })).toBe(1);
    expect(await prisma.billingSnapshot.count({ where: { tenantId: ids.tenant, roomId: ids.room, usagePeriod: "2026-08" } })).toBe(1);
    const lockedBefore = await prisma.billingSnapshot.findFirstOrThrow({
      where: { tenantId: ids.tenant, roomId: ids.room, usagePeriod: "2026-08" },
    });

    const resumed = await service.closeMonth(ids.tenant, "user-resume", {
      period: "2026-09", roomIds: [ids.room], autoSend: false,
    });
    expect(resumed.settledCount).toBe(1);
    expect(resumed.skippedCount).toBe(1);
    expect(await prisma.invoice.count({ where: { tenantId: ids.tenant, billingKind: "MONTHLY_BASE", period: "2026-09" } })).toBe(2);
    const lockedAfter = await prisma.billingSnapshot.findFirstOrThrow({
      where: { tenantId: ids.tenant, roomId: ids.room, usagePeriod: "2026-08" },
    });
    expect(lockedAfter.id).toBe(lockedBefore.id);
    expect(lockedAfter.sourcePayloadHash).toBe(lockedBefore.sourcePayloadHash);
    expect(lockedAfter.updatedAt).toEqual(lockedBefore.updatedAt);
  }, 30_000);
});
