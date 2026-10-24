import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it, vi } from "vitest";
import { MonthlySettlementService } from "./monthly-settlement.service";

const testDatabaseUrl = process.env.TEST_DATABASE_URL || "";
const dbDescribe =
  process.env.RUN_MOVE_IN_ELECTRICITY_DB_TESTS === "1" &&
  /localhost|127\.0\.0\.1/.test(testDatabaseUrl) && /test|tmp|ci|isolated/i.test(testDatabaseUrl)
    ? describe
    : describe.skip;

dbDescribe("move-in electricity closeMonth PostgreSQL", () => {
  const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl } } });
  const suffix = randomUUID().replace(/-/g, "").slice(0, 10);
  const ids = {
    tenant: `move-in-tenant-${suffix}`, building: `move-in-building-${suffix}`, floor: `move-in-floor-${suffix}`,
    room: `move-in-room-${suffix}`, customer: `move-in-customer-${suffix}`, contract: `move-in-contract-${suffix}`,
    occupancy: `move-in-occupancy-${suffix}`, mapping: `move-in-mapping-${suffix}`,
    baseline: `move-in-baseline-${suffix}`, current: `move-in-current-${suffix}`,
    staleRoom: `move-in-stale-room-${suffix}`, staleCustomer: `move-in-stale-customer-${suffix}`,
    staleContract: `move-in-stale-contract-${suffix}`, staleOccupancy: `move-in-stale-occupancy-${suffix}`,
    staleMapping: `move-in-stale-mapping-${suffix}`, staleBaseline: `move-in-stale-baseline-${suffix}`, staleCurrent: `move-in-stale-current-${suffix}`,
  };
  const usagePeriod = "2026-10";
  const billingPeriod = "2026-11";
  const periodStart = new Date("2026-09-30T17:00:00.000Z");
  const movedInAt = new Date("2026-10-10T03:00:00.000Z");
  const hunonicService = {
    getOverview: vi.fn(),
    lockPeriods: vi.fn().mockResolvedValue({ success: true }),
  };
  const service = new MonthlySettlementService(
    prisma as any, {} as any, {} as any, {} as any, hunonicService as any, { log: vi.fn() } as any,
  );

  function meter(roomCode: string, mappingId: string) {
    return { id: mappingId, buildingCode: `MI-${suffix}`, roomCode, rateMode: "custom", customRateVnd: 4_000, status: "on" };
  }

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("charges only actual move-in usage, blocks stale zero-net evidence, and replays the locked snapshot", async () => {
    await prisma.tenantOrg.create({ data: { id: ids.tenant, name: "Move-in test", code: `MI-${suffix}` } });
    await prisma.building.create({ data: { id: ids.building, tenantId: ids.tenant, code: `MI-${suffix}`, name: "Move-in building" } });
    await prisma.floor.create({ data: { id: ids.floor, tenantId: ids.tenant, buildingId: ids.building, level: 1, name: "Tầng 1" } });
    await prisma.room.create({ data: {
      id: ids.room, tenantId: ids.tenant, buildingId: ids.building, floorId: ids.floor, code: "101", name: "Move-in", monthlyPrice: 5_000_000, rentalType: "WHOLE", capacity: 1, status: "OCCUPIED",
    } });
    await prisma.customer.create({ data: { id: ids.customer, tenantId: ids.tenant, fullName: "Move-in customer", phone: `09${suffix.slice(0, 8)}`, phoneNormalized: `09${suffix.slice(0, 8)}` } });
    await prisma.contract.create({ data: {
      id: ids.contract, tenantId: ids.tenant, roomId: ids.room, customerId: ids.customer, code: `MI-${suffix}`, status: "ACTIVE", startDate: periodStart, endDate: new Date("2027-10-31T17:00:00.000Z"), monthlyRent: 5_000_000, depositMoney: 0, activatedAt: movedInAt,
      moveInSnapshot: { roomId: ids.room, meterReadingId: ids.baseline, capturedAt: movedInAt },
    } });
    await prisma.occupancy.create({ data: { id: ids.occupancy, tenantId: ids.tenant, roomId: ids.room, customerId: ids.customer, contractId: ids.contract, role: "ĐẠI DIỆN", joinedAt: periodStart } });
    await prisma.hunonicMeterMapping.create({ data: { id: ids.mapping, tenantId: ids.tenant, buildingId: ids.building, roomId: ids.room, buildingCode: `MI-${suffix}`, roomCode: "101", displayName: "MI-101", providerMeterId: `meter-${suffix}`, deviceName: "Move-in meter" } });
    await prisma.hunonicMeterReading.createMany({ data: [
      { id: ids.baseline, tenantId: ids.tenant, meterMappingId: ids.mapping, roomId: ids.room, readingAt: movedInAt, observedAt: movedInAt, currentMonth: usagePeriod, sourcePeriod: usagePeriod, sourceProvider: "hunonic", sourceProviderMeterId: `meter-${suffix}`, payloadHash: "b".repeat(64), aggregateBasis: "MONTHLY_AGGREGATE_V1", energyMonthKwh: 100, moneyMonthVnd: 400_000 },
      { id: ids.current, tenantId: ids.tenant, meterMappingId: ids.mapping, roomId: ids.room, readingAt: new Date("2026-10-31T16:59:59.000Z"), observedAt: new Date("2026-10-31T16:59:59.000Z"), currentMonth: usagePeriod, sourcePeriod: usagePeriod, sourceProvider: "hunonic", sourceProviderMeterId: `meter-${suffix}`, payloadHash: "c".repeat(64), aggregateBasis: "MONTHLY_AGGREGATE_V1", energyMonthKwh: 125, moneyMonthVnd: 500_000 },
    ] as any });
    hunonicService.getOverview.mockResolvedValue({ meters: [meter("101", ids.mapping)] });

    const overview = await service.getOverview(ids.tenant, { period: billingPeriod });
    expect(overview.items).toEqual(expect.arrayContaining([expect.objectContaining({ roomId: ids.room, electricityKwh: 25, electricityAmount: 100_000, roomPrice: 5_000_000, waterAmount: 100_000 })]));
    await service.closeMonth(ids.tenant, "move-in-user", { period: billingPeriod, roomIds: [ids.room], autoSend: false });
    const invoice = await prisma.invoice.findFirstOrThrow({ where: { tenantId: ids.tenant, contractId: ids.contract, period: billingPeriod }, include: { items: true } });
    expect(invoice.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "RENT", amount: expect.anything() }),
      expect.objectContaining({ type: "UTILITY_WATER", amount: expect.anything() }),
      expect.objectContaining({ type: "UTILITY_ELECTRICITY", amount: expect.anything() }),
    ]));
    expect(Number(invoice.items.find((item) => item.type === "UTILITY_ELECTRICITY")?.amount)).toBe(100_000);
    expect(Number(invoice.total)).toBe(5_200_000);
    const locked = await prisma.billingSnapshot.findFirstOrThrow({ where: { tenantId: ids.tenant, roomId: ids.room, usagePeriod } });
    expect(Number(locked.usageKwh)).toBe(25);
    expect(Number(locked.electricityAmount)).toBe(100_000);
    expect(locked.sourceProvenance).toMatchObject({ moveInElectricity: { baselinePayloadHash: "b".repeat(64), baselineKwh: 100, currentKwh: 125 } });

    await prisma.hunonicMeterReading.create({ data: {
      id: `move-in-newer-${suffix}`, tenantId: ids.tenant, meterMappingId: ids.mapping, roomId: ids.room, readingAt: new Date("2026-10-31T17:00:00.000Z"), observedAt: new Date("2026-10-31T17:00:00.000Z"), currentMonth: usagePeriod, sourcePeriod: usagePeriod, sourceProvider: "hunonic", sourceProviderMeterId: `meter-${suffix}`, payloadHash: "d".repeat(64), aggregateBasis: "MONTHLY_AGGREGATE_V1", energyMonthKwh: 150, moneyMonthVnd: 600_000,
    } as any });
    await expect(service.closeMonth(ids.tenant, "move-in-replay", { period: billingPeriod, autoSend: false })).resolves.toMatchObject({ skippedCount: 1 });
    const replayed = await prisma.billingSnapshot.findFirstOrThrow({ where: { tenantId: ids.tenant, roomId: ids.room, usagePeriod } });
    expect(replayed.sourceProvenance).toMatchObject({ moveInElectricity: { baselinePayloadHash: "b".repeat(64), currentKwh: 125 } });

    await prisma.room.create({ data: { id: ids.staleRoom, tenantId: ids.tenant, buildingId: ids.building, floorId: ids.floor, code: "102", name: "Stale", monthlyPrice: 1_000_000, rentalType: "WHOLE", capacity: 1, status: "OCCUPIED" } });
    await prisma.customer.create({ data: { id: ids.staleCustomer, tenantId: ids.tenant, fullName: "Stale customer", phone: `08${suffix.slice(0, 8)}`, phoneNormalized: `08${suffix.slice(0, 8)}` } });
    await prisma.contract.create({ data: { id: ids.staleContract, tenantId: ids.tenant, roomId: ids.staleRoom, customerId: ids.staleCustomer, code: `STALE-${suffix}`, status: "ACTIVE", startDate: periodStart, endDate: new Date("2027-10-31T17:00:00.000Z"), monthlyRent: 1_000_000, depositMoney: 0, activatedAt: movedInAt, moveInSnapshot: { roomId: ids.staleRoom, meterReadingId: ids.staleBaseline, capturedAt: movedInAt } } });
    await prisma.occupancy.create({ data: { id: ids.staleOccupancy, tenantId: ids.tenant, roomId: ids.staleRoom, customerId: ids.staleCustomer, contractId: ids.staleContract, role: "ĐẠI DIỆN", joinedAt: periodStart } });
    await prisma.hunonicMeterMapping.create({ data: { id: ids.staleMapping, tenantId: ids.tenant, buildingId: ids.building, roomId: ids.staleRoom, buildingCode: `MI-${suffix}`, roomCode: "102", displayName: "MI-102", providerMeterId: `stale-meter-${suffix}`, deviceName: "Stale meter" } });
    await prisma.hunonicMeterReading.createMany({ data: [
      { id: ids.staleBaseline, tenantId: ids.tenant, meterMappingId: ids.staleMapping, roomId: ids.staleRoom, readingAt: new Date("2026-10-10T03:00:00.001Z"), observedAt: new Date("2026-10-10T03:00:00.001Z"), currentMonth: usagePeriod, sourcePeriod: usagePeriod, sourceProvider: "hunonic", sourceProviderMeterId: `stale-meter-${suffix}`, payloadHash: "e".repeat(64), aggregateBasis: "MONTHLY_AGGREGATE_V1", energyMonthKwh: 100, moneyMonthVnd: 400_000 },
      { id: ids.staleCurrent, tenantId: ids.tenant, meterMappingId: ids.staleMapping, roomId: ids.staleRoom, readingAt: new Date("2026-10-31T16:59:59.000Z"), observedAt: new Date("2026-10-31T16:59:59.000Z"), currentMonth: usagePeriod, sourcePeriod: usagePeriod, sourceProvider: "hunonic", sourceProviderMeterId: `stale-meter-${suffix}`, payloadHash: "f".repeat(64), aggregateBasis: "MONTHLY_AGGREGATE_V1", energyMonthKwh: 100, moneyMonthVnd: 400_000 },
    ] as any });
    hunonicService.getOverview.mockResolvedValue({ meters: [meter("101", ids.mapping), meter("102", ids.staleMapping)] });
    const staleOverview = await service.getOverview(ids.tenant, { period: billingPeriod });
    expect(staleOverview.items.find((item: any) => item.roomId === ids.staleRoom)?.settlementBlockers).toEqual(expect.arrayContaining([expect.objectContaining({ code: "MOVE_IN_ELECTRICITY_BASELINE_INVALID" })]));
    await expect(service.closeMonth(ids.tenant, "stale-user", { period: billingPeriod, roomIds: [ids.staleRoom], autoSend: false })).rejects.toMatchObject({ response: expect.objectContaining({ reason: "MOVE_IN_ELECTRICITY_BASELINE_INVALID" }) });
    expect(await prisma.invoice.count({ where: { tenantId: ids.tenant, contractId: ids.staleContract } })).toBe(0);
    expect(await prisma.billingSnapshot.count({ where: { tenantId: ids.tenant, roomId: ids.staleRoom, usagePeriod } })).toBe(0);

    await prisma.contract.update({
      where: { id: ids.staleContract },
      data: { moveInSnapshot: { roomId: ids.staleRoom, meterReadingId: `missing-${suffix}`, capturedAt: movedInAt } },
    });
    const missingOverview = await service.getOverview(ids.tenant, { period: billingPeriod });
    expect(missingOverview.items.find((item: any) => item.roomId === ids.staleRoom)?.settlementBlockers).toEqual(expect.arrayContaining([expect.objectContaining({ code: "MOVE_IN_ELECTRICITY_BASELINE_REQUIRED" })]));
    await expect(service.closeMonth(ids.tenant, "missing-user", { period: billingPeriod, roomIds: [ids.staleRoom], autoSend: false })).rejects.toMatchObject({ response: expect.objectContaining({ reason: "MOVE_IN_ELECTRICITY_BASELINE_REQUIRED" }) });
    expect(await prisma.invoice.count({ where: { tenantId: ids.tenant, contractId: ids.staleContract } })).toBe(0);
    expect(await prisma.billingSnapshot.count({ where: { tenantId: ids.tenant, roomId: ids.staleRoom, usagePeriod } })).toBe(0);
  }, 30_000);
});
