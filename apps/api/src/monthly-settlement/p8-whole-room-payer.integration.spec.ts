import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { MonthlySettlementService } from "./monthly-settlement.service";
import { PaymentsService } from "../payments/payments.service";
import { InvoicesService } from "../invoices/invoices.service";
import { InvoicesRepository } from "../invoices/invoices.repository";
import { ContractsService } from "../contracts/contracts.service";
import { ContractsRepository } from "../contracts/contracts.repository";

// FAIL-CLOSED GATE:
// This test never reads DATABASE_URL. It needs a deliberate opt-in plus a
// TEST_DATABASE_URL whose database name is clearly isolated from staging and
// production. The executable test is evidence only after CI/DBA has deployed
// the canonical Prisma migrations to that database.
const rawTestDbUrl = process.env.TEST_DATABASE_URL;
const isSafeTestDb = Boolean(
  rawTestDbUrl &&
    /(?:_test|_tmp|_isolated)(?:[/?]|$)/i.test(rawTestDbUrl) &&
    !rawTestDbUrl.includes("prod") &&
    !rawTestDbUrl.includes("staging"),
);
const canRunDbTest =
  process.env.RUN_P8_WHOLE_ROOM_DB_TESTS === "1" && isSafeTestDb;
const dbDescribe = canRunDbTest ? describe : describe.skip;
const datasourceUrl = canRunDbTest
  ? rawTestDbUrl!
  : "postgresql://placeholder:placeholder@localhost:5432/placeholder_test";

dbDescribe("P8: WHOLE room payer, occupancy and notification boundary on isolated PostgreSQL", () => {
  const prisma = new PrismaClient({ datasources: { db: { url: datasourceUrl } } });
  const suffix = randomUUID().replace(/-/g, "").slice(0, 12);
  const ids = {
    tenant: `tenant-p8-${suffix}`,
    building: `building-p8-${suffix}`,
    floor: `floor-p8-${suffix}`,
    room: `room-p8-whole-${suffix}`,
    targetRoom: `room-p8-target-${suffix}`,
    payer: `customer-p8-payer-${suffix}`,
    occupant: `customer-p8-occupant-${suffix}`,
    cycle: `cycle-p8-${suffix}`,
    contract: `contract-p8-${suffix}`,
    bankAccount: `bank-p8-${suffix}`,
    meterMapping: `meter-mapping-p8-${suffix}`,
    meterReading: `meter-reading-p8-${suffix}`,
  };

  const auditService = { log: vi.fn().mockResolvedValue(undefined) };
  const communicationService = {
    dispatchDirect: vi.fn().mockResolvedValue({ status: "QUEUED" }),
  };
  const hunonicService = {
    getOverview: vi.fn().mockResolvedValue({ meters: [] }),
    lockPeriods: vi.fn().mockResolvedValue({ success: true }),
  };

  // Services in production use PrismaService.tx.  A real Prisma client is
  // exposed as tx here so this integration suite exercises database queries,
  // transactions, snapshot writes and payment-request persistence, not a
  // reimplementation in test doubles.
  const prismaWithTx = new Proxy(prisma as any, {
    get(target, property, receiver) {
      if (property === "tx") return target;
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });

  const invoicesService = new InvoicesService(
    new InvoicesRepository(prismaWithTx),
    auditService as any,
    prismaWithTx,
  );
  const paymentsService = new PaymentsService(
    prismaWithTx,
    invoicesService,
    {} as any,
    communicationService as any,
    {} as any,
    {} as any,
    auditService as any,
  );
  const settlementService = new MonthlySettlementService(
    prismaWithTx,
    paymentsService,
    invoicesService,
    communicationService as any,
    hunonicService as any,
    auditService as any,
  );
  const contractsService = new ContractsService(
    new ContractsRepository(prismaWithTx),
    auditService as any,
    prismaWithTx,
    { publish: vi.fn() } as any,
    {} as any,
  );

  async function cleanTestData() {
    const tenantId = ids.tenant;
    await prisma.invoiceItem.deleteMany({ where: { invoice: { tenantId } } });
    await prisma.paymentAllocation.deleteMany({ where: { invoice: { tenantId } } });
    await prisma.paymentRequest.deleteMany({ where: { tenantId } });
    await prisma.invoice.deleteMany({ where: { tenantId } });
    await prisma.billingSnapshot.deleteMany({ where: { tenantId } });
    await prisma.hunonicMeterReading.deleteMany({ where: { tenantId } });
    await prisma.hunonicMeterMapping.deleteMany({ where: { tenantId } });
    await prisma.monthlySettlementRun.deleteMany({ where: { tenantId } });
    await prisma.occupancy.deleteMany({ where: { tenantId } });
    await prisma.contractParty.deleteMany({ where: { tenantId } });
    await prisma.contract.deleteMany({ where: { tenantId } });
    await prisma.rentalCycle.deleteMany({ where: { tenantId } });
    await prisma.customer.deleteMany({ where: { tenantId } });
    await prisma.roomPaymentAccountRoute.deleteMany({ where: { tenantId } });
    await prisma.bankAccount.deleteMany({ where: { tenantId } });
    await prisma.room.deleteMany({ where: { tenantId } });
    await prisma.floor.deleteMany({ where: { tenantId } });
    await prisma.building.deleteMany({ where: { tenantId } });
    await prisma.appSetting.deleteMany({ where: { tenantId } });
    await prisma.tenantOrg.deleteMany({ where: { id: tenantId } });
  }

  beforeAll(async () => {
    await cleanTestData();

    await prisma.tenantOrg.create({
      data: { id: ids.tenant, name: `P8 ${suffix}`, code: `P8-${suffix}` },
    });
    await prisma.building.create({
      data: {
        id: ids.building,
        tenantId: ids.tenant,
        code: `B-${suffix}`,
        name: "Tòa P8",
      },
    });
    await prisma.floor.create({
      data: {
        id: ids.floor,
        tenantId: ids.tenant,
        buildingId: ids.building,
        level: 1,
        name: "Tầng 1",
      },
    });
    await prisma.room.createMany({
      data: [
        {
          id: ids.room,
          tenantId: ids.tenant,
          buildingId: ids.building,
          floorId: ids.floor,
          code: `W-${suffix}`,
          name: "Nguyên căn P8",
          capacity: 4,
          monthlyPrice: 2_000_000,
          rentalType: "WHOLE",
          status: "OCCUPIED",
        },
        {
          id: ids.targetRoom,
          tenantId: ids.tenant,
          buildingId: ids.building,
          floorId: ids.floor,
          code: `T-${suffix}`,
          name: "Phòng chuyển thử P8",
          capacity: 1,
          monthlyPrice: 1_000_000,
          rentalType: "WHOLE",
          status: "AVAILABLE",
        },
      ],
    });
    await prisma.customer.createMany({
      data: [
        {
          id: ids.payer,
          tenantId: ids.tenant,
          fullName: "Đại diện hợp đồng P8",
          phone: `0908${suffix.slice(0, 6)}`,
          phoneNormalized: `0908${suffix.slice(0, 6)}`,
          zaloChatId: `zalo-payer-${suffix}`,
          roomId: ids.room,
        },
        {
          id: ids.occupant,
          tenantId: ids.tenant,
          fullName: "Thành viên ở cùng P8",
          phone: `0918${suffix.slice(0, 6)}`,
          phoneNormalized: `0918${suffix.slice(0, 6)}`,
          zaloChatId: `zalo-occupant-${suffix}`,
          roomId: null,
        },
      ],
    });
    await prisma.rentalCycle.create({
      data: {
        id: ids.cycle,
        tenantId: ids.tenant,
        customerId: ids.payer,
        roomId: ids.room,
        status: "ACTIVE",
        actualMoveInAt: new Date("2026-08-01T00:00:00.000Z"),
      },
    });
    await prisma.contract.create({
      data: {
        id: ids.contract,
        tenantId: ids.tenant,
        roomId: ids.room,
        customerId: ids.payer,
        rentalCycleId: ids.cycle,
        code: `HD-P8-${suffix}`,
        status: "ACTIVE",
        startDate: new Date("2026-08-01T00:00:00.000Z"),
        endDate: new Date("2027-07-31T17:00:00.000Z"),
        signedAt: new Date("2026-07-30T00:00:00.000Z"),
        monthlyRent: 2_000_000,
        depositMoney: 2_000_000,
        memberCount: 99, // Deliberately stale: Occupancy must win.
        coRepresentativeIds: [],
      },
    });
    await prisma.contractParty.createMany({
      data: [
        {
          tenantId: ids.tenant,
          contractId: ids.contract,
          customerId: ids.payer,
          role: "PRIMARY",
          identitySnapshot: { customerId: ids.payer },
        },
      ],
    });
    await prisma.occupancy.createMany({
      data: [
        {
          tenantId: ids.tenant,
          roomId: ids.room,
          customerId: ids.payer,
          contractId: ids.contract,
          rentalCycleId: ids.cycle,
          role: "PRIMARY",
          joinedAt: new Date("2026-08-01T00:00:00.000Z"),
        },
      ],
    });
    await prisma.bankAccount.create({
      data: {
        id: ids.bankAccount,
        tenantId: ids.tenant,
        bankName: "BIDV",
        accountNumber: `9704${suffix.slice(0, 8)}`,
        accountName: "HOMELAND P8 TEST",
      },
    });
    await prisma.hunonicMeterMapping.create({
      data: {
        id: ids.meterMapping,
        tenantId: ids.tenant,
        buildingId: ids.building,
        roomId: ids.room,
        buildingCode: `B-${suffix}`,
        roomCode: `W-${suffix}`,
        displayName: `P8 whole ${suffix}`,
        providerMeterId: `provider-p8-${suffix}`,
        deviceName: `Hunonic P8 ${suffix}`,
      },
    });
    await prisma.hunonicMeterReading.create({
      data: {
        id: ids.meterReading,
        tenantId: ids.tenant,
        meterMappingId: ids.meterMapping,
        roomId: ids.room,
        readingAt: new Date("2026-08-31T16:59:59.999Z"),
        observedAt: new Date("2026-08-31T16:59:59.999Z"),
        currentMonth: "2026-08",
        sourceProvider: "hunonic",
        sourceProviderMeterId: `provider-p8-${suffix}`,
        sourcePeriod: "2026-08",
        payloadHash: "b".repeat(64),
        aggregateBasis: "MONTHLY_AGGREGATE_V1",
        // The overview chooses the prior-month fields for a historical usage
        // period and current-month fields at a live close boundary. Supplying
        // both is intentional: the same persisted, provider-verified amount
        // must be selected regardless of when this deterministic test is run.
        energyMonthKwh: 30,
        moneyMonthVnd: 120_000,
        energyPrevMonthKwh: 30,
        moneyPrevMonthVnd: 120_000,
      },
    });
  }, 30_000);

  afterAll(async () => {
    // Invoice and ledger evidence is intentionally append-only. Randomized
    // tenant IDs make a disposable CI database the safe cleanup boundary.
    await prisma.$disconnect();
  }, 30_000);

  it("charges exactly one WHOLE payer from actual occupancy, sends QR-Zalo only to that payer, and preserves the record when primary transfer is rejected", async () => {
    const period = "2026-09";
    await expect(
      contractsService.addWholeRoomOccupant(
        ids.contract,
        {
          customerId: ids.occupant,
          moveInAt: "2026-08-01T00:00:00.000Z",
          relationship: "Người ở cùng",
        },
        "user-p8",
        ids.tenant,
        `p8-secondary-attach-${suffix}`,
      ),
    ).resolves.toMatchObject({
      mode: "WHOLE_ROOM_OCCUPANT_ATTACHED",
      contractId: ids.contract,
      customerId: ids.occupant,
    });
    const overview = await settlementService.getOverview(ids.tenant, { period });
    const item = overview.items.find((candidate: any) => candidate.roomId === ids.room);

    expect(item).toMatchObject({
      contractId: ids.contract,
      rentalCycleId: ids.cycle,
      roomRentalType: "WHOLE",
      billingScope: "ROOM",
      representative: { id: ids.payer },
      membersCount: 2,
      waterAmount: 200_000,
      electricityKwh: 30,
      electricityAmount: 120_000,
      roomPrice: 2_000_000,
      totalAmount: 2_320_000,
    });
    expect(item.members.map((member: any) => member.id).sort()).toEqual(
      [ids.occupant, ids.payer].sort(),
    );

    const closed = await settlementService.closeMonth(ids.tenant, "user-p8", {
      period,
      roomIds: [ids.room],
      autoSend: false,
    });
    expect(closed).toMatchObject({ success: true, settledCount: 1, skippedCount: 0 });

    const invoice = await prisma.invoice.findFirstOrThrow({
      where: {
        tenantId: ids.tenant,
        contractId: ids.contract,
        rentalCycleId: ids.cycle,
        billingKind: "MONTHLY_BASE",
        period,
      },
      include: { items: true },
    });
    expect(invoice.customerId).toBe(ids.payer);
    expect(Number(invoice.total)).toBe(2_320_000);
    expect(invoice.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "RENT", amount: expect.anything() }),
        expect.objectContaining({ type: "UTILITY_WATER", amount: expect.anything() }),
        expect.objectContaining({ type: "UTILITY_ELECTRICITY", amount: expect.anything() }),
      ]),
    );
    expect(Number(invoice.items.find((entry) => entry.type === "UTILITY_WATER")?.amount)).toBe(200_000);
    expect(Number(invoice.items.find((entry) => entry.type === "UTILITY_ELECTRICITY")?.amount)).toBe(120_000);

    const snapshot = await prisma.billingSnapshot.findFirstOrThrow({
      where: { tenantId: ids.tenant, roomId: ids.room, usagePeriod: "2026-08" },
    });
    expect(snapshot.status).toBe("LOCKED");
    expect(snapshot.occupantCount).toBe(2);
    expect(Number(snapshot.waterAmount)).toBe(200_000);
    expect(Number(snapshot.usageKwh)).toBe(30);
    expect(Number(snapshot.electricityAmount)).toBe(120_000);
    expect((snapshot.occupants as any[]).map((entry) => entry.customerId).sort()).toEqual(
      [ids.occupant, ids.payer].sort(),
    );
    expect(snapshot.allocations).toEqual([
      expect.objectContaining({
        contractId: ids.contract,
        customerId: ids.payer,
        payerSnapshot: expect.objectContaining({ id: ids.payer }),
        memberCount: 2,
      }),
    ]);

    const notification = await settlementService.sendNotifications(ids.tenant, "user-p8", {
      period,
      invoiceIds: [invoice.id],
    });
    expect(notification).toMatchObject({ sentCount: 1, failedCount: 0 });

    const paymentRequest = await prisma.paymentRequest.findFirstOrThrow({
      where: { tenantId: ids.tenant, sourceType: "INVOICE", sourceId: invoice.id },
    });
    expect(Number(paymentRequest.amount)).toBe(2_320_000);
    expect(paymentRequest.roomId).toBe(ids.room);
    expect(paymentRequest.qrUrl).toContain("amount=2320000");
    expect(communicationService.dispatchDirect).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: `zalo-payer-${suffix}`,
        context: expect.objectContaining({
          invoiceCode: invoice.code,
          paymentCode: paymentRequest.paymentCode,
          qrUrl: paymentRequest.qrUrl,
        }),
      }),
    );
    expect(JSON.stringify(communicationService.dispatchDirect.mock.calls)).not.toContain(
      `zalo-occupant-${suffix}`,
    );

    const beforeRejectedTransfer = {
      invoiceCount: await prisma.invoice.count({ where: { tenantId: ids.tenant } }),
      snapshotId: snapshot.id,
      contract: await prisma.contract.findUniqueOrThrow({ where: { id: ids.contract } }),
      openOccupancies: await prisma.occupancy.count({
        where: { tenantId: ids.tenant, contractId: ids.contract, leftAt: null },
      }),
    };
    await expect(
      contractsService.transferOccupant(
        {
          sourceRoomId: ids.room,
          targetRoomId: ids.targetRoom,
          contractId: ids.contract,
          rentalCycleId: ids.cycle,
          customerId: ids.payer,
          transferAt: "2026-09-15T00:00:00.000Z",
        },
        "user-p8",
        ids.tenant,
        `p8-primary-transfer-${suffix}`,
      ),
    ).rejects.toThrow("TRANSFER_PRIMARY_REQUIRES_SETTLEMENT");

    const afterRejectedTransfer = await prisma.contract.findUniqueOrThrow({
      where: { id: ids.contract },
    });
    expect(afterRejectedTransfer).toMatchObject({
      status: beforeRejectedTransfer.contract.status,
      customerId: ids.payer,
      rentalCycleId: ids.cycle,
      coRepresentativeIds: [ids.occupant],
    });
    expect(await prisma.invoice.count({ where: { tenantId: ids.tenant } })).toBe(
      beforeRejectedTransfer.invoiceCount,
    );
    expect(await prisma.billingSnapshot.findUniqueOrThrow({
      where: {
        tenantId_roomId_usagePeriod: {
          tenantId: ids.tenant,
          roomId: ids.room,
          usagePeriod: "2026-08",
        },
      },
    })).toMatchObject({ id: beforeRejectedTransfer.snapshotId });
    expect(await prisma.occupancy.count({
      where: { tenantId: ids.tenant, contractId: ids.contract, leftAt: null },
    })).toBe(beforeRejectedTransfer.openOccupancies);

    const historicalInvoice = {
      id: invoice.id,
      customerId: invoice.customerId,
      total: Number(invoice.total),
      items: invoice.items.map((entry) => ({
        type: entry.type,
        amount: Number(entry.amount),
        billingSnapshotId: entry.billingSnapshotId,
      })),
    };
    const historicalSnapshot = {
      id: snapshot.id,
      status: snapshot.status,
      occupantCount: snapshot.occupantCount,
      occupants: snapshot.occupants,
      allocations: snapshot.allocations,
      waterAmount: Number(snapshot.waterAmount),
      electricityAmount: Number(snapshot.electricityAmount),
    };

    const detachCommand = {
      roomId: ids.room,
      contractId: ids.contract,
      customerId: ids.occupant,
      actualMoveOutDate: "2026-09-15T00:00:00.000Z",
      reason: "P8 secondary occupant moved out",
    };
    const detachKey = `p8-secondary-detach-${suffix}`;
    await expect(
      contractsService.moveOutOccupant(
        detachCommand,
        "user-p8",
        ids.tenant,
        detachKey,
      ),
    ).resolves.toMatchObject({
      mode: "CO_REPRESENTATIVE_DETACHED",
      contractId: ids.contract,
    });
    await expect(
      contractsService.moveOutOccupant(
        detachCommand,
        "user-p8",
        ids.tenant,
        detachKey,
      ),
    ).resolves.toMatchObject({
      mode: "CO_REPRESENTATIVE_DETACHED",
      contractId: ids.contract,
    });

    const [contractAfterDetach, occupantAfterDetach, occupantOccupancies, partyAfterDetach,
      invoiceAfterDetach, snapshotAfterDetach, openOccupanciesAfterDetach] = await Promise.all([
      prisma.contract.findUniqueOrThrow({ where: { id: ids.contract } }),
      prisma.customer.findUniqueOrThrow({ where: { id: ids.occupant } }),
      prisma.occupancy.findMany({
        where: {
          tenantId: ids.tenant,
          contractId: ids.contract,
          customerId: ids.occupant,
        },
      }),
      prisma.contractParty.findMany({
        where: {
          tenantId: ids.tenant,
          contractId: ids.contract,
          customerId: ids.occupant,
          role: "CO_REPRESENTATIVE",
        },
      }),
      prisma.invoice.findUniqueOrThrow({
        where: { id: invoice.id },
        include: { items: true },
      }),
      prisma.billingSnapshot.findUniqueOrThrow({ where: { id: snapshot.id } }),
      prisma.occupancy.count({
        where: { tenantId: ids.tenant, contractId: ids.contract, leftAt: null },
      }),
    ]);
    expect(contractAfterDetach.coRepresentativeIds).toEqual([]);
    expect(occupantAfterDetach.roomId).toBeNull();
    expect(occupantOccupancies).toHaveLength(1);
    expect(occupantOccupancies[0]).toMatchObject({
      leftAt: new Date("2026-09-15T00:00:00.000Z"),
      leaveReason: expect.stringMatching(/^MOVE_OUT:/),
    });
    expect(partyAfterDetach).toHaveLength(1);
    expect(partyAfterDetach[0]?.leftAt).toEqual(
      new Date("2026-09-15T00:00:00.000Z"),
    );
    expect(openOccupanciesAfterDetach).toBe(1);
    expect({
      id: invoiceAfterDetach.id,
      customerId: invoiceAfterDetach.customerId,
      total: Number(invoiceAfterDetach.total),
      items: invoiceAfterDetach.items.map((entry) => ({
        type: entry.type,
        amount: Number(entry.amount),
        billingSnapshotId: entry.billingSnapshotId,
      })),
    }).toEqual(historicalInvoice);
    expect({
      id: snapshotAfterDetach.id,
      status: snapshotAfterDetach.status,
      occupantCount: snapshotAfterDetach.occupantCount,
      occupants: snapshotAfterDetach.occupants,
      allocations: snapshotAfterDetach.allocations,
      waterAmount: Number(snapshotAfterDetach.waterAmount),
      electricityAmount: Number(snapshotAfterDetach.electricityAmount),
    }).toEqual(historicalSnapshot);
  }, 30_000);
});
