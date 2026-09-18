import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { HunonicService } from "../hunonic/hunonic.service";

const testDatabaseUrl = process.env.TEST_DATABASE_URL || "";
const dbDescribe =
  process.env.RUN_BILLING_SNAPSHOT_DB_TESTS === "1" &&
  /test|tmp|ci|isolated/i.test(testDatabaseUrl)
    ? describe
    : describe.skip;

dbDescribe("CORE-07.04 PostgreSQL billing evidence invariants", () => {
  const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl } } });
  const hunonicService = new HunonicService(prisma as any);
  const suffix = randomUUID().replace(/-/g, "").slice(0, 10);
  const ids = {
    tenantA: `tenant-0704-a-${suffix}`,
    tenantB: `tenant-0704-b-${suffix}`,
    buildingA: `building-0704-a-${suffix}`,
    buildingB: `building-0704-b-${suffix}`,
    floorA: `floor-0704-a-${suffix}`,
    floorB: `floor-0704-b-${suffix}`,
    roomA: `room-0704-a-${suffix}`,
    roomB: `room-0704-b-${suffix}`,
    mappingA: `mapping-0704-a-${suffix}`,
    mappingB: `mapping-0704-b-${suffix}`,
    readingA: `reading-0704-a-${suffix}`,
    readingB: `reading-0704-b-${suffix}`,
    snapshotA: `snapshot-0704-a-${suffix}`,
    snapshotB: `snapshot-0704-b-${suffix}`,
    customerA: `customer-0704-a-${suffix}`,
    invoiceA: `invoice-0704-a-${suffix}`,
  };
  const hashA = "a".repeat(64);
  const hashB = "b".repeat(64);

  beforeAll(async () => {
    await prisma.tenantOrg.createMany({
      data: [
        { id: ids.tenantA, name: "CORE 07.04 A", code: `C0704A-${suffix}` },
        { id: ids.tenantB, name: "CORE 07.04 B", code: `C0704B-${suffix}` },
      ],
    });
    await prisma.building.createMany({
      data: [
        { id: ids.buildingA, tenantId: ids.tenantA, code: `BA-${suffix}`, name: "Tòa A" },
        { id: ids.buildingB, tenantId: ids.tenantB, code: `BB-${suffix}`, name: "Tòa B" },
      ],
    });
    await prisma.floor.createMany({
      data: [
        { id: ids.floorA, tenantId: ids.tenantA, buildingId: ids.buildingA, level: 1, name: "Tầng A" },
        { id: ids.floorB, tenantId: ids.tenantB, buildingId: ids.buildingB, level: 1, name: "Tầng B" },
      ],
    });
    await prisma.room.createMany({
      data: [
        { id: ids.roomA, tenantId: ids.tenantA, buildingId: ids.buildingA, floorId: ids.floorA, code: "101", name: "Phòng A", monthlyPrice: 3_000_000 },
        { id: ids.roomB, tenantId: ids.tenantB, buildingId: ids.buildingB, floorId: ids.floorB, code: "101", name: "Phòng B", monthlyPrice: 3_000_000 },
      ],
    });
    await prisma.hunonicMeterMapping.createMany({
      data: [
        { id: ids.mappingA, tenantId: ids.tenantA, buildingId: ids.buildingA, roomId: ids.roomA, buildingCode: `BA-${suffix}`, roomCode: "101", displayName: "A-101", providerMeterId: `meter-a-${suffix}`, deviceName: "Meter A" },
        { id: ids.mappingB, tenantId: ids.tenantB, buildingId: ids.buildingB, roomId: ids.roomB, buildingCode: `BB-${suffix}`, roomCode: "101", displayName: "B-101", providerMeterId: `meter-b-${suffix}`, deviceName: "Meter B" },
      ],
    });
    await prisma.hunonicMeterReading.createMany({
      data: [
        { id: ids.readingA, tenantId: ids.tenantA, meterMappingId: ids.mappingA, roomId: ids.roomA, readingAt: new Date("2026-08-31T16:59:59.999Z"), observedAt: new Date("2026-08-31T16:59:59.999Z"), currentMonth: "2026-08", sourcePeriod: "2026-08", sourceProvider: "hunonic", sourceProviderMeterId: `meter-a-${suffix}`, payloadHash: hashA, aggregateBasis: "MONTHLY_AGGREGATE_V1", energyMonthKwh: 12, moneyMonthVnd: 42_000 },
        { id: ids.readingB, tenantId: ids.tenantB, meterMappingId: ids.mappingB, roomId: ids.roomB, readingAt: new Date("2026-08-31T16:59:59.999Z"), observedAt: new Date("2026-08-31T16:59:59.999Z"), currentMonth: "2026-08", sourcePeriod: "2026-08", sourceProvider: "hunonic", sourceProviderMeterId: `meter-b-${suffix}`, payloadHash: hashB, aggregateBasis: "MONTHLY_AGGREGATE_V1", energyMonthKwh: 10, moneyMonthVnd: 35_000 },
      ] as any,
    });
    await prisma.billingSnapshot.createMany({
      data: [
        snapshotData(ids.snapshotA, ids.tenantA, ids.roomA, ids.mappingA, ids.readingA, `meter-a-${suffix}`, hashA),
        snapshotData(ids.snapshotB, ids.tenantB, ids.roomB, ids.mappingB, ids.readingB, `meter-b-${suffix}`, hashB),
      ] as any,
    });
    await prisma.customer.create({
      data: { id: ids.customerA, tenantId: ids.tenantA, fullName: "Khách A", phone: `0704${suffix.slice(0, 6)}` },
    });
    await prisma.invoice.create({
      data: {
        id: ids.invoiceA,
        tenantId: ids.tenantA,
        customerId: ids.customerA,
        code: `INV-0704-${suffix}`,
        period: "2026-09",
        usagePeriod: "2026-08",
        dueDate: new Date("2026-09-05T00:00:00.000Z"),
        subtotal: 42_000,
        total: 42_000,
        billingKind: "MONTHLY_BASE",
        baseInvoiceKey: `MONTHLY:0704:${suffix}`,
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("keeps readings, locked snapshots and used mapping scope immutable", async () => {
    await expect(prisma.hunonicMeterReading.update({ where: { id: ids.readingA }, data: { energyMonthKwh: 13 } })).rejects.toBeTruthy();
    await expect(prisma.billingSnapshot.update({ where: { id: ids.snapshotA }, data: { electricityAmount: 43_000 } })).rejects.toBeTruthy();
    await expect(prisma.hunonicMeterMapping.update({ where: { id: ids.mappingA }, data: { roomId: ids.roomB } })).rejects.toBeTruthy();
  });

  it("persists distinct same-timestamp observations through HunonicService and skips an exact retry", async () => {
    const readingAt = new Date("2026-08-31T17:00:00.000Z");
    const mapping = {
      id: ids.mappingA,
      buildingCode: `BA-${suffix}`,
      roomCode: "101",
      roomId: ids.roomA,
      providerMeterId: `meter-a-${suffix}`,
      provider: "hunonic",
    };
    const firstPayload = { provider_meter_id: `meter-a-${suffix}`, energy_month_kwh: 13, money_month_vnd: 45_000, status: "on" };
    const secondPayload = { provider_meter_id: `meter-a-${suffix}`, energy_month_kwh: 14, money_month_vnd: 48_000, status: "on" };

    await expect((hunonicService as any).upsertMonthlyReading(ids.tenantA, mapping, ids.roomA, "2026-08", readingAt, firstPayload)).resolves.toBe(true);
    await expect((hunonicService as any).upsertMonthlyReading(ids.tenantA, mapping, ids.roomA, "2026-08", readingAt, secondPayload)).resolves.toBe(true);
    await expect((hunonicService as any).upsertMonthlyReading(ids.tenantA, mapping, ids.roomA, "2026-08", readingAt, firstPayload)).resolves.toBe(false);
    await expect(prisma.hunonicMeterReading.count({
      where: { tenantId: ids.tenantA, meterMappingId: ids.mappingA, readingAt },
    })).resolves.toBe(2);
  });

  it("rejects cross-tenant and wrong-period InvoiceItem snapshot links", async () => {
    await expect(prisma.invoiceItem.create({
      data: { tenantId: ids.tenantA, invoiceId: ids.invoiceA, billingSnapshotId: ids.snapshotB, type: "UTILITY_ELECTRICITY", description: "cross tenant", servicePeriod: "2026-08", quantity: 1, unitPrice: 1, amount: 1 },
    })).rejects.toBeTruthy();
    await expect(prisma.invoiceItem.create({
      data: { tenantId: ids.tenantA, invoiceId: ids.invoiceA, billingSnapshotId: ids.snapshotA, type: "UTILITY_ELECTRICITY", description: "wrong period", servicePeriod: "2026-07", quantity: 1, unitPrice: 1, amount: 1 },
    })).rejects.toBeTruthy();
    await expect(prisma.invoiceItem.create({
      data: { tenantId: ids.tenantA, invoiceId: ids.invoiceA, type: "UTILITY_WATER", description: "missing snapshot", servicePeriod: "2026-08", quantity: 1, unitPrice: 1, amount: 1 },
    })).rejects.toBeTruthy();
  });

  it("rejects invalid source scope, period, hash and fabricated endpoints", async () => {
    await expect(prisma.hunonicMeterReading.create({
      data: { id: `bad-reading-${suffix}`, tenantId: ids.tenantA, meterMappingId: ids.mappingB, roomId: ids.roomA, readingAt: new Date(), observedAt: new Date(), currentMonth: "2026-13", sourcePeriod: "2026-13", sourceProvider: "hunonic", sourceProviderMeterId: `meter-b-${suffix}`, payloadHash: "bad", aggregateBasis: "MONTHLY_AGGREGATE_V1" } as any,
    })).rejects.toBeTruthy();
    await expect(prisma.billingSnapshot.create({
      data: { ...snapshotData(`bad-snapshot-${suffix}`, ids.tenantA, ids.roomA, ids.mappingA, ids.readingA, `meter-a-${suffix}`, hashA), startReadingKwh: 0 } as any,
    })).rejects.toBeTruthy();
    await expect(prisma.billingSnapshot.create({
      data: { ...snapshotData(`draft-snapshot-${suffix}`, ids.tenantA, ids.roomA, ids.mappingA, ids.readingA, `meter-a-${suffix}`, hashA), status: "DRAFT" } as any,
    })).rejects.toBeTruthy();
  });

  it("replays an immutable snapshot with create-only conflict handling and preserves the winner", async () => {
    const competing = {
      ...snapshotData(
        `snapshot-competing-${suffix}`,
        ids.tenantA,
        ids.roomA,
        ids.mappingA,
        ids.readingA,
        `meter-a-${suffix}`,
        hashA,
      ),
      electricityAmount: 99_999,
      sourcePayloadHash: "d".repeat(64),
    };

    await expect(prisma.billingSnapshot.createMany({
      data: [competing] as any,
      skipDuplicates: true,
    })).resolves.toEqual({ count: 0 });

    const winner = await prisma.billingSnapshot.findUniqueOrThrow({
      where: {
        tenantId_roomId_usagePeriod: {
          tenantId: ids.tenantA,
          roomId: ids.roomA,
          usagePeriod: "2026-08",
        },
      },
    });
    expect(winner).toMatchObject({
      id: ids.snapshotA,
      sourcePayloadHash: "c".repeat(64),
    });
    expect(Number(winner.electricityAmount)).toBe(42_000);
  });
});

function snapshotData(
  id: string,
  tenantId: string,
  roomId: string,
  meterMappingId: string,
  sourceReadingId: string,
  sourceProviderMeterId: string,
  readingPayloadHash: string,
) {
  return {
    id,
    tenantId,
    roomId,
    meterMappingId,
    sourceReadingId,
    billingPeriod: "2026-09",
    usagePeriod: "2026-08",
    status: "LOCKED",
    provider: "hunonic",
    startReadingKwh: null,
    endReadingKwh: null,
    usageKwh: 12,
    pricingMode: "residential",
    electricityAmount: 42_000,
    waterRatePerPersonVnd: 100_000,
    waterAmount: 100_000,
    occupantCount: 1,
    occupants: [],
    allocations: [],
    policyVersion: "CORE-07-v1",
    aggregateBasis: "MONTHLY_AGGREGATE_V1",
    sourcePayloadHash: "c".repeat(64),
    sourceProvenance: { sourceProviderMeterId, readingPayloadHash },
  };
}
