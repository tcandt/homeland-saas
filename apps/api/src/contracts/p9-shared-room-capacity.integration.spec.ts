import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ContractsService } from "./contracts.service";
import { ContractsRepository } from "./contracts.repository";
import { NotFoundException } from "@nestjs/common";
import { randomUUID } from "crypto";

// FAIL-CLOSED GATE:
// Strictly require RUN_P9_SHARED_CAPACITY_DB_TESTS === "1" AND a TEST_DATABASE_URL explicitly targeting a test database.
// NEVER read or fallback to DATABASE_URL to guarantee staging/production are never touched.
const rawTestDbUrl = process.env.TEST_DATABASE_URL;
const isSafeTestDb = Boolean(
  rawTestDbUrl &&
    /(?:_test|_tmp|_isolated)(?:[/?]|$)/i.test(rawTestDbUrl) &&
    !rawTestDbUrl.includes("prod") &&
    !rawTestDbUrl.includes("staging"),
);
const isExplicitOptIn = process.env.RUN_P9_SHARED_CAPACITY_DB_TESTS === "1";
const canRunDbTest = Boolean(isExplicitOptIn && isSafeTestDb);
const dbDescribe = canRunDbTest ? describe : describe.skip;

// Safe test URL for describe phase evaluation when skipped
const safeDatasourceUrl = canRunDbTest ? rawTestDbUrl! : "postgresql://placeholder:placeholder@localhost:5432/placeholder_test";

dbDescribe("P9.1: SHARED Room Capacity Race Condition on Isolated PostgreSQL", () => {
  // Use two separate PrismaClient instances to establish two independent connection pools
  const prisma1 = new PrismaClient({ datasources: { db: { url: safeDatasourceUrl } } });
  const prisma2 = new PrismaClient({ datasources: { db: { url: safeDatasourceUrl } } });

  // Dynamic run ID to avoid static ID collisions and ensure clean repeatability
  const runId = randomUUID().slice(0, 8);
  const tenantId = `t-p9-${runId}`;
  const foreignTenantId = `t-p9-f-${runId}`;
  const buildingId = `bldg-p9-${runId}`;
  const floorId = `floor-p9-${runId}`;
  const roomId = `room-p9-shared-${runId}`;

  const residentId = `cust-resident-${runId}`;
  const candidateAId = `cust-cand-a-${runId}`;
  const candidateBId = `cust-cand-b-${runId}`;

  const contractAId = `contract-cand-a-${runId}`;
  const contractBId = `contract-cand-b-${runId}`;

  const idempotencyKeyA = `p9-race-act-a-${runId}`;
  const idempotencyKeyB = `p9-race-act-b-${runId}`;

  const makePrismaProxy = (client: PrismaClient) =>
    new Proxy(client, {
      get(target, prop) {
        if (prop === "tx") return target;
        return (target as any)[prop];
      },
    });

  const service1 = new ContractsService(
    new ContractsRepository({ tx: prisma1 } as any),
    { log: vi.fn().mockResolvedValue(undefined) } as any,
    makePrismaProxy(prisma1) as any,
    { publish: vi.fn().mockResolvedValue(undefined) } as any,
    { getRoomElectricityPricing: vi.fn().mockResolvedValue(null) } as any,
  );

  const service2 = new ContractsService(
    new ContractsRepository({ tx: prisma2 } as any),
    { log: vi.fn().mockResolvedValue(undefined) } as any,
    makePrismaProxy(prisma2) as any,
    { publish: vi.fn().mockResolvedValue(undefined) } as any,
    { getRoomElectricityPricing: vi.fn().mockResolvedValue(null) } as any,
  );

  async function getActiveResourceCount(client: PrismaClient, targetRoomId: string, asOf: Date = new Date()) {
    const [occupancies, activeHolds] = await Promise.all([
      client.occupancy.count({ where: { tenantId, roomId: targetRoomId, leftAt: null } }),
      client.roomHold.count({ where: { tenantId, roomId: targetRoomId, status: "ACTIVE", expiresAt: { gt: asOf } } }),
    ]);
    return { occupancies, activeHolds, total: occupancies + activeHolds };
  }

  async function cleanAllTestData(client: PrismaClient) {
    const tenantIds = [tenantId, foreignTenantId];
    await client.invoiceItem.deleteMany({ where: { invoice: { tenantId: { in: tenantIds } } } });
    await client.invoice.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await client.occupancy.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await client.roomHold.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await client.depositLedgerEntry.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await client.depositOperation.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await client.deposit.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await client.contractParty.deleteMany({ where: { contract: { tenantId: { in: tenantIds } } } });
    await client.contract.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await client.rentalCycle.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await client.customer.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await client.room.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await client.floor.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await client.building.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await client.outboxEvent.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await client.auditLog.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await client.tenantOrg.deleteMany({ where: { id: { in: tenantIds } } });
  }

  beforeAll(async () => {
    // Fail fast if pre-existing artifacts remain
    await cleanAllTestData(prisma1);

    // 1. Setup tenants
    await prisma1.tenantOrg.create({ data: { id: tenantId, name: `Tenant P9 ${runId}`, code: `P9-${runId}` } });
    await prisma1.tenantOrg.create({ data: { id: foreignTenantId, name: `Tenant P9 Foreign ${runId}`, code: `P9F-${runId}` } });

    // 2. Setup building & floor
    await prisma1.building.create({ data: { id: buildingId, tenantId, code: `B-${runId}`, name: `Toa ${runId}` } });
    await prisma1.floor.create({ data: { id: floorId, tenantId, buildingId, level: 1, name: "Tang 1" } });

    // 3. Setup SHARED room with capacity = 2
    await prisma1.room.create({
      data: {
        id: roomId,
        tenantId,
        buildingId,
        floorId,
        code: `R-SHARED-${runId}`,
        name: `Phong ghep ${runId}`,
        capacity: 2,
        monthlyPrice: 2_000_000,
        rentalType: "SHARED",
        status: "OCCUPIED",
      },
    });

    // 4. Resident 1 already occupies 1 slot.
    // CAPACITY INVARIANT CHECK AT SETUP: 1 Occupancy, 0 Holds = 1 total <= 2 capacity.
    await prisma1.customer.create({
      data: { id: residentId, tenantId, fullName: "Resident Da O", phone: `090${runId.slice(0, 7)}`, phoneNormalized: `090${runId.slice(0, 7)}` },
    });
    const residentCycle = await prisma1.rentalCycle.create({
      data: { id: `cycle-res-${runId}`, tenantId, customerId: residentId, roomId, status: "ACTIVE" },
    });
    await prisma1.occupancy.create({
      data: { tenantId, roomId, customerId: residentId, rentalCycleId: residentCycle.id, role: "PRIMARY" },
    });

    const setupCount = await getActiveResourceCount(prisma1, roomId);
    expect(setupCount.occupancies).toBe(1);
    expect(setupCount.activeHolds).toBe(0);
    expect(setupCount.total).toBe(1); // Exactly 1 slot remaining! Never exceeds capacity before test.

    // 5. Setup Candidate A (APPROVED contract, funded security deposit, ZERO initial RoomHold)
    await prisma1.customer.create({
      data: { id: candidateAId, tenantId, fullName: "Candidate A", phone: `091${runId.slice(0, 7)}`, phoneNormalized: `091${runId.slice(0, 7)}` },
    });
    const cycleA = await prisma1.rentalCycle.create({
      data: { id: `cycle-a-${runId}`, tenantId, customerId: candidateAId, roomId, status: "RESERVED" },
    });
    await prisma1.contract.create({
      data: {
        id: contractAId,
        tenantId,
        roomId,
        customerId: candidateAId,
        rentalCycleId: cycleA.id,
        code: `HD-A-${runId}`,
        status: "APPROVED",
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
        signedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        monthlyRent: 2_000_000,
        depositMoney: 2_000_000,
        memberCount: 1,
      },
    });
    await prisma1.deposit.create({
      data: {
        id: `dep-a-${runId}`,
        tenantId,
        code: `DEP-A-${runId}`,
        type: "SECURITY",
        roomId,
        customerId: candidateAId,
        contractId: contractAId,
        rentalCycleId: cycleA.id,
        amount: 2_000_000,
        status: "PAID",
      },
    });
    const opA = await prisma1.depositOperation.create({
      data: {
        tenantId,
        rentalCycleId: cycleA.id,
        sourceDepositId: `dep-a-${runId}`,
        contractId: contractAId,
        type: "COLLECT",
        status: "COMPLETED",
        idempotencyKey: `op-a-${runId}`,
        requestHash: `op-a-hash-${runId}`,
        completedAt: new Date(),
      },
    });
    await prisma1.depositLedgerEntry.create({
      data: {
        tenantId,
        rentalCycleId: cycleA.id,
        depositId: `dep-a-${runId}`,
        contractId: contractAId,
        operationId: opA.id,
        type: "CASH_IN",
        amount: 2_000_000,
        balanceEffect: 2_000_000,
        idempotencyKey: `ledger-a-${runId}`,
        sourceType: "INTEGRATION_TEST",
        sourceId: `dep-a-${runId}`,
      },
    });

    await prisma1.roomHold.create({
      data: {
        tenantId,
        rentalCycleId: cycleA.id,
        depositId: `dep-a-${runId}`,
        roomId,
        kind: "SHARED_SLOT",
        resourceKey: `${tenantId}:${roomId}:SHARED_SLOT:a`,
        activeResourceKey: null,
        status: "CONVERTED",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        idempotencyKey: `p9-hold-a-${runId}`,
      },
    });

    // 6. Setup Candidate B (APPROVED contract, funded security deposit, valid CONVERTED hold)
    await prisma1.customer.create({
      data: { id: candidateBId, tenantId, fullName: "Candidate B", phone: `092${runId.slice(0, 7)}`, phoneNormalized: `092${runId.slice(0, 7)}` },
    });
    const cycleB = await prisma1.rentalCycle.create({
      data: { id: `cycle-b-${runId}`, tenantId, customerId: candidateBId, roomId, status: "RESERVED" },
    });
    await prisma1.contract.create({
      data: {
        id: contractBId,
        tenantId,
        roomId,
        customerId: candidateBId,
        rentalCycleId: cycleB.id,
        code: `HD-B-${runId}`,
        status: "APPROVED",
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
        signedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        monthlyRent: 2_000_000,
        depositMoney: 2_000_000,
        memberCount: 1,
      },
    });
    await prisma1.deposit.create({
      data: {
        id: `dep-b-${runId}`,
        tenantId,
        code: `DEP-B-${runId}`,
        type: "SECURITY",
        roomId,
        customerId: candidateBId,
        contractId: contractBId,
        rentalCycleId: cycleB.id,
        amount: 2_000_000,
        status: "PAID",
      },
    });
    const opB = await prisma1.depositOperation.create({
      data: {
        tenantId,
        rentalCycleId: cycleB.id,
        sourceDepositId: `dep-b-${runId}`,
        contractId: contractBId,
        type: "COLLECT",
        status: "COMPLETED",
        idempotencyKey: `op-b-${runId}`,
        requestHash: `op-b-hash-${runId}`,
        completedAt: new Date(),
      },
    });
    await prisma1.depositLedgerEntry.create({
      data: {
        tenantId,
        rentalCycleId: cycleB.id,
        depositId: `dep-b-${runId}`,
        contractId: contractBId,
        operationId: opB.id,
        type: "CASH_IN",
        amount: 2_000_000,
        balanceEffect: 2_000_000,
        idempotencyKey: `ledger-b-${runId}`,
        sourceType: "INTEGRATION_TEST",
        sourceId: `dep-b-${runId}`,
      },
    });
    await prisma1.roomHold.create({
      data: {
        tenantId,
        rentalCycleId: cycleB.id,
        depositId: `dep-b-${runId}`,
        roomId,
        kind: "SHARED_SLOT",
        resourceKey: `${tenantId}:${roomId}:SHARED_SLOT:b`,
        activeResourceKey: null,
        status: "CONVERTED",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        idempotencyKey: `p9-hold-b-${runId}`,
      },
    });
  }, 30_000);

  afterAll(async () => {
    try {
      await cleanAllTestData(prisma1);
    } finally {
      await Promise.all([prisma1.$disconnect(), prisma2.$disconnect()]);
    }
  }, 30_000);

  async function getCandidateSnapshot(
    contractId: string,
    customerId: string,
    cycleId: string,
    depositId: string,
    idempotencyKey: string,
  ) {
    const contract = await prisma1.contract.findUniqueOrThrow({ where: { id: contractId } });
    const cycle = await prisma1.rentalCycle.findUniqueOrThrow({ where: { id: cycleId } });
    const deposit = await prisma1.deposit.findUniqueOrThrow({ where: { id: depositId } });
    const hold = await prisma1.roomHold.findFirstOrThrow({ where: { tenantId, rentalCycleId: cycleId } });

    return {
      contractStatus: contract.status,
      cycleStatus: cycle.status,
      depositStatus: deposit.status,
      depositAmount: Number(deposit.amount),
      holdStatus: hold.status,
      occupancies: await prisma1.occupancy.count({ where: { tenantId, customerId, leftAt: null } }),
      invoices: await prisma1.invoice.count({ where: { tenantId, contractId } }),
      invoiceItems: await prisma1.invoiceItem.count({ where: { invoice: { tenantId, contractId } } }),
      depositOperations: await prisma1.depositOperation.count({ where: { tenantId, contractId } }),
      ledgers: await prisma1.depositLedgerEntry.count({ where: { tenantId, contractId } }),
      outboxEvents: await prisma1.outboxEvent.count({ where: { tenantId, idempotencyKey } }),
      auditLogs: await prisma1.auditLog.count({ where: { tenantId, entityId: contractId } }),
    };
  }

  it("P9.1 concurrency: allows exactly 1 winner for the final slot, rejects loser, and guarantees strict capacity invariants", async () => {
    // Checkpoint 1: Pre-race snapshots and strict capacity invariant assertion
    const beforeA = await getCandidateSnapshot(contractAId, candidateAId, `cycle-a-${runId}`, `dep-a-${runId}`, idempotencyKeyA);
    const beforeB = await getCandidateSnapshot(contractBId, candidateBId, `cycle-b-${runId}`, `dep-b-${runId}`, idempotencyKeyB);

    const preRaceResource = await getActiveResourceCount(prisma1, roomId);
    expect(preRaceResource.occupancies).toBe(1);
    expect(preRaceResource.activeHolds).toBe(0);
    expect(preRaceResource.total).toBe(1);
    expect(preRaceResource.total).toBeLessThanOrEqual(2);

    // Send two concurrent activation commands from two distinct connection pools
    const [resultA, resultB] = await Promise.allSettled([
      service1.activateContract(contractAId, "user-p9-a", tenantId, idempotencyKeyA),
      service2.activateContract(contractBId, "user-p9-b", tenantId, idempotencyKeyB),
    ]);

    const fulfilledCount = (resultA.status === "fulfilled" ? 1 : 0) + (resultB.status === "fulfilled" ? 1 : 0);
    const rejectedCount = (resultA.status === "rejected" ? 1 : 0) + (resultB.status === "rejected" ? 1 : 0);

    expect(fulfilledCount).toBe(1);
    expect(rejectedCount).toBe(1);

    const winnerId = resultA.status === "fulfilled" ? contractAId : contractBId;
    const loserId = resultA.status === "rejected" ? contractAId : contractBId;
    const loserCustomerId = resultA.status === "rejected" ? candidateAId : candidateBId;
    const loserCycleId = loserId === contractAId ? `cycle-a-${runId}` : `cycle-b-${runId}`;
    const loserDepositId = loserId === contractAId ? `dep-a-${runId}` : `dep-b-${runId}`;
    const loserKey = resultA.status === "rejected" ? idempotencyKeyA : idempotencyKeyB;
    const beforeLoser = resultA.status === "rejected" ? beforeA : beforeB;

    // Checkpoint 2: Post-race strict capacity invariant (active Occupancy + active RoomHold <= capacity)
    const postRaceResource = await getActiveResourceCount(prisma1, roomId);
    expect(postRaceResource.occupancies).toBe(2);
    expect(postRaceResource.activeHolds).toBe(0);
    expect(postRaceResource.total).toBe(2);
    expect(postRaceResource.total).toBeLessThanOrEqual(2);

    // DIRECT DB ASSERTION 2: Winning contract is ACTIVE and has issued billing invoice
    const winningContract = await prisma1.contract.findUniqueOrThrow({ where: { id: winnerId } });
    expect(winningContract.status).toBe("ACTIVE");
    const winningInvoiceCount = await prisma1.invoice.count({ where: { tenantId, contractId: winnerId } });
    expect(winningInvoiceCount).toBe(1);

    // DIRECT DB ASSERTION 3: Loser snapshot comparison — ZERO orphan mutations from rejected command
    // Compare contract, rentalCycle, hold, deposit, depositOperations, ledgers, occupancies, invoices, invoiceItems, outbox, audit
    const afterLoser = await getCandidateSnapshot(loserId, loserCustomerId, loserCycleId, loserDepositId, loserKey);
    expect(afterLoser.contractStatus).toBe(beforeLoser.contractStatus); // Remained "APPROVED"
    expect(afterLoser.cycleStatus).toBe(beforeLoser.cycleStatus); // Remained "RESERVED"
    expect(afterLoser.depositStatus).toBe(beforeLoser.depositStatus); // Remained "PAID"
    expect(afterLoser.depositAmount).toBe(beforeLoser.depositAmount); // 2,000,000
    expect(afterLoser.holdStatus).toBe(beforeLoser.holdStatus); // Remained "CONVERTED"
    expect(afterLoser.occupancies).toBe(0); // No orphan occupancy
    expect(afterLoser.invoices).toBe(0); // No orphan invoice
    expect(afterLoser.invoiceItems).toBe(0); // No orphan invoice item
    expect(afterLoser.depositOperations).toBe(beforeLoser.depositOperations); // Unchanged count (1)
    expect(afterLoser.ledgers).toBe(beforeLoser.ledgers); // Unchanged count (1)
    expect(afterLoser.outboxEvents).toBe(0); // No orphan outbox events
    expect(afterLoser.auditLogs).toBe(beforeLoser.auditLogs); // No orphan audit logs

    // Checkpoint 3: Retry winning command with same idempotency key replays cleanly without duplicating side-effects
    const winningKey = winnerId === contractAId ? idempotencyKeyA : idempotencyKeyB;
    const winningUserId = winnerId === contractAId ? "user-p9-a" : "user-p9-b";

    const replayed = await service1.activateContract(winnerId, winningUserId, tenantId, winningKey);
    expect(replayed.id).toBe(winnerId);
    expect(replayed.status).toBe("ACTIVE");

    const postReplayResource = await getActiveResourceCount(prisma1, roomId);
    expect(postReplayResource.occupancies).toBe(2);
    expect(postReplayResource.activeHolds).toBe(0);
    expect(postReplayResource.total).toBe(2);
    expect(postReplayResource.total).toBeLessThanOrEqual(2);

    const postReplayInvoices = await prisma1.invoice.count({ where: { tenantId, contractId: winnerId } });
    expect(postReplayInvoices).toBe(1);

    // DIRECT DB ASSERTION 5: Multi-tenant isolation — foreign tenant cannot read or write the tenant's room/contract
    const foreignRoomLookup = await prisma1.room.findFirst({ where: { id: roomId, tenantId: foreignTenantId } });
    expect(foreignRoomLookup).toBeNull();

    await expect(
      service1.activateContract(winnerId, "user-foreign", foreignTenantId, "foreign-act-key"),
    ).rejects.toThrow(NotFoundException);
  }, 30_000);
});
