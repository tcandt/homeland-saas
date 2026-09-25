import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ContractsService } from "./contracts.service";
import { NotFoundException } from "@nestjs/common";

import { ContractsRepository } from "./contracts.repository";

const databaseUrl =
  process.env.TEST_DATABASE_URL ||
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/homeland_test";

const isDbConfigured =
  process.env.RUN_P9_SHARED_CAPACITY_DB_TESTS === "1" ||
  process.env.RUN_CONTRACT_CORE_DB_TESTS === "1" ||
  Boolean(process.env.DATABASE_URL && !process.env.DATABASE_URL.includes(":5430"));

const dbDescribe = isDbConfigured ? describe : describe.skip;

dbDescribe("P9.1: SHARED Room Capacity Race Condition on Isolated PostgreSQL", () => {
  const prisma = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });

  const tenantId = "tenant-p9-race-test";
  const foreignTenantId = "tenant-p9-foreign-test";
  const buildingId = "bldg-p9-race";
  const floorId = "floor-p9-race";
  const roomId = "room-p9-shared-race";

  const existingResidentId = "cust-p9-resident";
  const candidateAId = "cust-p9-cand-a";
  const candidateBId = "cust-p9-cand-b";

  const contractAId = "contract-p9-cand-a";
  const contractBId = "contract-p9-cand-b";

  const idempotencyKeyA = "p9-race-act-a-key";
  const idempotencyKeyB = "p9-race-act-b-key";

  const prismaService = new Proxy(prisma, {
    get(target, prop) {
      if (prop === "tx") return target;
      return (target as any)[prop];
    },
  });

  const repository = new ContractsRepository({ tx: prisma } as any);

  const service = new ContractsService(
    repository,
    { log: vi.fn().mockResolvedValue(undefined) } as any,
    prismaService as any,
    { publish: vi.fn().mockResolvedValue(undefined) } as any,
    { getRoomElectricityPricing: vi.fn().mockResolvedValue(null) } as any,
  );

  async function cleanData() {
    const tenantIds = [tenantId, foreignTenantId];
    await prisma.invoiceItem.deleteMany({ where: { invoice: { tenantId: { in: tenantIds } } } }).catch(() => null);
    await prisma.invoice.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => null);
    await prisma.occupancy.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => null);
    await prisma.roomHold.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => null);
    await prisma.depositLedgerEntry.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => null);
    await prisma.depositOperation.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => null);
    await prisma.deposit.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => null);
    await prisma.contractParty.deleteMany({ where: { contract: { tenantId: { in: tenantIds } } } }).catch(() => null);
    await prisma.contract.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => null);
    await prisma.rentalCycle.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => null);
    await prisma.customer.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => null);
    await prisma.room.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => null);
    await prisma.floor.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => null);
    await prisma.building.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => null);
    await prisma.outboxEvent.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => null);
    await prisma.auditLog.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => null);
  }

  beforeAll(async () => {
    await cleanData();

    // 1. Setup tenants with upsert
    await prisma.tenantOrg.upsert({
      where: { id: tenantId },
      create: { id: tenantId, name: "Tenant P9 Race", code: "P9-RACE" },
      update: {},
    });
    await prisma.tenantOrg.upsert({
      where: { id: foreignTenantId },
      create: { id: foreignTenantId, name: "Tenant P9 Foreign", code: "P9-FOREIGN" },
      update: {},
    });

    // 2. Setup building & floor
    await prisma.building.create({
      data: { id: buildingId, tenantId, code: "B-P9", name: "Toa P9" },
    });
    await prisma.floor.create({
      data: { id: floorId, tenantId, buildingId, level: 1, name: "Tang 1" },
    });

    // 3. Setup SHARED room with capacity = 2
    await prisma.room.create({
      data: {
        id: roomId,
        tenantId,
        buildingId,
        floorId,
        code: "R-P9-SHARED",
        name: "Phong ghep P9",
        capacity: 2,
        monthlyPrice: 2_000_000,
        rentalType: "SHARED",
        status: "OCCUPIED",
      },
    });

    // 4. Resident 1 already occupies 1 slot (so exactly 1 slot remaining!)
    await prisma.customer.create({
      data: {
        id: existingResidentId,
        tenantId,
        fullName: "Nguoi o hien tai",
        phone: "0909000001",
        phoneNormalized: "0909000001",
      },
    });
    const residentCycle = await prisma.rentalCycle.create({
      data: {
        id: "cycle-p9-resident",
        tenantId,
        customerId: existingResidentId,
        roomId,
        status: "ACTIVE",
      },
    });
    await prisma.occupancy.create({
      data: {
        tenantId,
        roomId,
        customerId: existingResidentId,
        rentalCycleId: residentCycle.id,
        role: "PRIMARY",
      },
    });

    // 5. Setup competing Candidate A
    await prisma.customer.create({
      data: {
        id: candidateAId,
        tenantId,
        fullName: "Ung vien A",
        phone: "0909000002",
        phoneNormalized: "0909000002",
      },
    });
    const cycleA = await prisma.rentalCycle.create({
      data: {
        id: "cycle-p9-a",
        tenantId,
        customerId: candidateAId,
        roomId,
        status: "RESERVED",
      },
    });
    await prisma.contract.create({
      data: {
        id: contractAId,
        tenantId,
        roomId,
        customerId: candidateAId,
        rentalCycleId: cycleA.id,
        code: "HD-P9-A",
        status: "APPROVED",
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
        signedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        monthlyRent: 2_000_000,
        depositMoney: 2_000_000,
        memberCount: 1,
      },
    });
    await prisma.deposit.create({
      data: {
        id: "dep-p9-a",
        tenantId,
        code: "DEP-P9-A",
        type: "SECURITY",
        roomId,
        customerId: candidateAId,
        contractId: contractAId,
        rentalCycleId: cycleA.id,
        amount: 2_000_000,
        status: "PAID",
      },
    });
    const opA = await prisma.depositOperation.create({
      data: {
        tenantId,
        rentalCycleId: cycleA.id,
        sourceDepositId: "dep-p9-a",
        contractId: contractAId,
        type: "COLLECT",
        status: "COMPLETED",
        idempotencyKey: "p9-op-a",
        requestHash: "p9-op-a-hash",
        completedAt: new Date(),
      },
    });
    await prisma.depositLedgerEntry.create({
      data: {
        tenantId,
        rentalCycleId: cycleA.id,
        depositId: "dep-p9-a",
        contractId: contractAId,
        operationId: opA.id,
        type: "CASH_IN",
        amount: 2_000_000,
        balanceEffect: 2_000_000,
        idempotencyKey: "p9-ledger-a",
        sourceType: "INTEGRATION_TEST",
        sourceId: "dep-p9-a",
      },
    });
    await prisma.roomHold.create({
      data: {
        tenantId,
        rentalCycleId: cycleA.id,
        depositId: "dep-p9-a",
        roomId,
        kind: "SHARED_SLOT",
        resourceKey: `${tenantId}:${roomId}:SHARED_SLOT:a`,
        activeResourceKey: `${tenantId}:${roomId}:SHARED_SLOT:a`,
        status: "ACTIVE",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        idempotencyKey: "p9-hold-a",
      },
    });

    // 6. Setup competing Candidate B
    await prisma.customer.create({
      data: {
        id: candidateBId,
        tenantId,
        fullName: "Ung vien B",
        phone: "0909000003",
        phoneNormalized: "0909000003",
      },
    });
    const cycleB = await prisma.rentalCycle.create({
      data: {
        id: "cycle-p9-b",
        tenantId,
        customerId: candidateBId,
        roomId,
        status: "RESERVED",
      },
    });
    await prisma.contract.create({
      data: {
        id: contractBId,
        tenantId,
        roomId,
        customerId: candidateBId,
        rentalCycleId: cycleB.id,
        code: "HD-P9-B",
        status: "APPROVED",
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
        signedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        monthlyRent: 2_000_000,
        depositMoney: 2_000_000,
        memberCount: 1,
      },
    });
    await prisma.deposit.create({
      data: {
        id: "dep-p9-b",
        tenantId,
        code: "DEP-P9-B",
        type: "SECURITY",
        roomId,
        customerId: candidateBId,
        contractId: contractBId,
        rentalCycleId: cycleB.id,
        amount: 2_000_000,
        status: "PAID",
      },
    });
    const opB = await prisma.depositOperation.create({
      data: {
        tenantId,
        rentalCycleId: cycleB.id,
        sourceDepositId: "dep-p9-b",
        contractId: contractBId,
        type: "COLLECT",
        status: "COMPLETED",
        idempotencyKey: "p9-op-b",
        requestHash: "p9-op-b-hash",
        completedAt: new Date(),
      },
    });
    await prisma.depositLedgerEntry.create({
      data: {
        tenantId,
        rentalCycleId: cycleB.id,
        depositId: "dep-p9-b",
        contractId: contractBId,
        operationId: opB.id,
        type: "CASH_IN",
        amount: 2_000_000,
        balanceEffect: 2_000_000,
        idempotencyKey: "p9-ledger-b",
        sourceType: "INTEGRATION_TEST",
        sourceId: "dep-p9-b",
      },
    });
    await prisma.roomHold.create({
      data: {
        tenantId,
        rentalCycleId: cycleB.id,
        depositId: "dep-p9-b",
        roomId,
        kind: "SHARED_SLOT",
        resourceKey: `${tenantId}:${roomId}:SHARED_SLOT:b`,
        activeResourceKey: `${tenantId}:${roomId}:SHARED_SLOT:b`,
        status: "ACTIVE",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        idempotencyKey: "p9-hold-b",
      },
    });
  }, 30_000);

  afterAll(async () => {
    await cleanData();
    await prisma.$disconnect();
  }, 30_000);

  it("P9.1 concurrency: allows exactly 1 winner and rejects the second command with capacity guard", async () => {
    // Both Candidate A and Candidate B attempt to activate simultaneously for the 1 remaining slot
    const [resultA, resultB] = await Promise.allSettled([
      service.activateContract(contractAId, "user-p9-a", tenantId, idempotencyKeyA),
      service.activateContract(contractBId, "user-p9-b", tenantId, idempotencyKeyB),
    ]);

    const fulfilledCount = (resultA.status === "fulfilled" ? 1 : 0) + (resultB.status === "fulfilled" ? 1 : 0);
    const rejectedCount = (resultA.status === "rejected" ? 1 : 0) + (resultB.status === "rejected" ? 1 : 0);

    expect(fulfilledCount).toBe(1);
    expect(rejectedCount).toBe(1);

    const winnerId = resultA.status === "fulfilled" ? contractAId : contractBId;
    const loserId = resultA.status === "rejected" ? contractAId : contractBId;
    const loserCustomerId = resultA.status === "rejected" ? candidateAId : candidateBId;

    // Direct DB Assertion 1: active Hold + active Occupancy <= capacity (2)
    const activeOccupancyCount = await prisma.occupancy.count({
      where: { tenantId, roomId, leftAt: null },
    });
    expect(activeOccupancyCount).toBe(2);

    const roomInDb = await prisma.room.findUniqueOrThrow({ where: { id: roomId } });
    expect(activeOccupancyCount).toBeLessThanOrEqual(roomInDb.capacity || 2);

    // Direct DB Assertion 2: Winner contract is ACTIVE and has invoice
    const winningContract = await prisma.contract.findUniqueOrThrow({ where: { id: winnerId } });
    expect(winningContract.status).toBe("ACTIVE");
    const winningInvoiceCount = await prisma.invoice.count({
      where: { tenantId, contractId: winnerId },
    });
    expect(winningInvoiceCount).toBe(1);

    // Direct DB Assertion 3: Loser contract is NOT active and has no orphan occupancy or invoice
    const losingContract = await prisma.contract.findUniqueOrThrow({ where: { id: loserId } });
    expect(losingContract.status).toBe("APPROVED"); // Never moved to ACTIVE

    const loserOccupancies = await prisma.occupancy.findMany({
      where: { tenantId, customerId: loserCustomerId, leftAt: null },
    });
    expect(loserOccupancies).toHaveLength(0);

    const loserInvoices = await prisma.invoice.findMany({
      where: { tenantId, contractId: loserId },
    });
    expect(loserInvoices).toHaveLength(0);

    // Direct DB Assertion 4: Retry winning command with same idempotency key replays cleanly without duplicates
    const winningKey = winnerId === contractAId ? idempotencyKeyA : idempotencyKeyB;
    const winningUserId = winnerId === contractAId ? "user-p9-a" : "user-p9-b";

    const replayed = await service.activateContract(winnerId, winningUserId, tenantId, winningKey);
    expect(replayed.id).toBe(winnerId);
    expect(replayed.status).toBe("ACTIVE");

    // Total occupancies in room must strictly still be 2 (no second occupancy row created)
    const postReplayOccupancy = await prisma.occupancy.count({
      where: { tenantId, roomId, leftAt: null },
    });
    expect(postReplayOccupancy).toBe(2);

    // Total invoices for winning contract must still be 1 (no duplicate billing)
    const postReplayInvoices = await prisma.invoice.count({
      where: { tenantId, contractId: winnerId },
    });
    expect(postReplayInvoices).toBe(1);

    // Direct DB Assertion 5: Cross-tenant isolation - foreign tenant cannot access room or activate slot
    const foreignRoomLookup = await prisma.room.findFirst({
      where: { id: roomId, tenantId: foreignTenantId },
    });
    expect(foreignRoomLookup).toBeNull();

    await expect(
      service.activateContract(winnerId, "user-foreign", foreignTenantId, "foreign-act-key"),
    ).rejects.toThrow(NotFoundException);
  }, 30_000);
});
