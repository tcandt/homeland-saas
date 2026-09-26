import {
  DepositOperationStatus,
  DepositOperationType,
  DepositStatus,
  DepositType,
  PrismaClient,
  RentalCycleStatus,
  RoomHoldStatus,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DepositCoreService } from './deposit-core.service';

// Never fall back to DATABASE_URL: this suite creates real booking and hold records.
const rawTestDbUrl = process.env.TEST_DATABASE_URL;
const canRunDbTest = Boolean(
  process.env.RUN_P9_SHARED_CAPACITY_DB_TESTS === '1'
    && rawTestDbUrl
    && /(?:_test|_tmp|_isolated)(?:[/?]|$)/i.test(rawTestDbUrl)
    && !rawTestDbUrl.includes('prod')
    && !rawTestDbUrl.includes('staging'),
);
const dbDescribe = canRunDbTest ? describe : describe.skip;
const datasourceUrl = canRunDbTest
  ? rawTestDbUrl!
  : 'postgresql://placeholder:placeholder@localhost:5432/placeholder_test';

dbDescribe('P9.1B: SHARED booking hold race on isolated PostgreSQL', () => {
  const prisma1 = new PrismaClient({ datasources: { db: { url: datasourceUrl } } });
  const prisma2 = new PrismaClient({ datasources: { db: { url: datasourceUrl } } });
  const service1 = new DepositCoreService({ tx: prisma1 } as any);
  const service2 = new DepositCoreService({ tx: prisma2 } as any);

  const runId = randomUUID().slice(0, 8);
  const tenantId = `t-p9-hold-${runId}`;
  const foreignTenantId = `t-p9-hold-f-${runId}`;
  const buildingId = `bldg-p9-hold-${runId}`;
  const floorId = `floor-p9-hold-${runId}`;
  const roomId = `room-p9-hold-${runId}`;
  const residentId = `cust-p9-hold-res-${runId}`;
  const candidateAId = `cust-p9-hold-a-${runId}`;
  const candidateBId = `cust-p9-hold-b-${runId}`;
  const keyA = `p9-hold-create-a-${runId}`;
  const keyB = `p9-hold-create-b-${runId}`;
  const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  async function resourceCount(client: PrismaClient) {
    const [occupancies, activeHolds] = await Promise.all([
      client.occupancy.count({ where: { tenantId, roomId, leftAt: null } }),
      client.roomHold.count({
        where: { tenantId, roomId, status: RoomHoldStatus.ACTIVE, expiresAt: { gt: new Date() } },
      }),
    ]);
    return { occupancies, activeHolds, total: occupancies + activeHolds };
  }

  async function candidateEffects(client: PrismaClient, customerId: string, idempotencyKey: string) {
    const deposits = await client.deposit.findMany({
      where: { tenantId, customerId },
      select: { id: true, rentalCycleId: true },
    });
    const depositIds = deposits.map((deposit) => deposit.id);
    const cycleIds = deposits.flatMap((deposit) => deposit.rentalCycleId ? [deposit.rentalCycleId] : []);
    const operations = await client.depositOperation.findMany({
      where: { tenantId, idempotencyKey },
      select: { id: true },
    });
    const operationIds = operations.map((operation) => operation.id);
    const [cycles, holds, outboxEvents, audits, tasks] = await Promise.all([
      client.rentalCycle.count({ where: { tenantId, customerId } }),
      client.roomHold.count({ where: { tenantId, rentalCycleId: { in: cycleIds } } }),
      client.outboxEvent.count({ where: { tenantId, aggregateId: { in: operationIds } } }),
      client.auditLog.count({ where: { tenantId, entityId: { in: depositIds } } }),
      client.task.count({ where: { tenantId, title: { contains: idempotencyKey } } }),
    ]);
    return { deposits, cycles, holds, operations, outboxEvents, audits, tasks };
  }

  beforeAll(async () => {
    await prisma1.tenantOrg.create({
      data: { id: tenantId, name: `P9 hold ${runId}`, code: `P9H-${runId}` },
    });
    await prisma1.tenantOrg.create({
      data: { id: foreignTenantId, name: `P9 foreign ${runId}`, code: `P9HF-${runId}` },
    });
    await prisma1.building.create({
      data: { id: buildingId, tenantId, code: `B-${runId}`, name: `Toa P9 ${runId}` },
    });
    await prisma1.floor.create({
      data: { id: floorId, tenantId, buildingId, level: 1, name: 'Tang 1' },
    });
    await prisma1.room.create({
      data: {
        id: roomId,
        tenantId,
        buildingId,
        floorId,
        code: `SHARED-${runId}`,
        name: `Phong ghep P9 ${runId}`,
        capacity: 2,
        monthlyPrice: 2_000_000,
        rentalType: 'SHARED',
        status: 'OCCUPIED',
      },
    });
    await prisma1.customer.create({
      data: {
        id: residentId,
        tenantId,
        fullName: 'P9 resident',
        phone: `090${runId.slice(0, 7)}`,
        phoneNormalized: `090${runId.slice(0, 7)}`,
      },
    });
    const residentCycle = await prisma1.rentalCycle.create({
      data: { tenantId, customerId: residentId, roomId, status: RentalCycleStatus.ACTIVE },
    });
    await prisma1.occupancy.create({
      data: {
        tenantId,
        roomId,
        customerId: residentId,
        rentalCycleId: residentCycle.id,
        role: 'PRIMARY',
      },
    });

    for (const [id, name, phonePrefix] of [
      [candidateAId, 'P9 candidate A', '091'],
      [candidateBId, 'P9 candidate B', '092'],
    ] as const) {
      const phone = `${phonePrefix}${runId.slice(0, 7)}`;
      await prisma1.customer.create({
        data: { id, tenantId, fullName: name, phone, phoneNormalized: phone },
      });
    }

    await expect(resourceCount(prisma1)).resolves.toEqual({
      occupancies: 1,
      activeHolds: 0,
      total: 1,
    });
  }, 30_000);

  afterAll(async () => {
    // The successful command creates a real ACTIVE hold and append-only audit/outbox data.
    // CI supplies a disposable, per-job database; run-specific IDs preserve failure evidence.
    await Promise.all([prisma1.$disconnect(), prisma2.$disconnect()]);
  });

  it('permits one booking hold for the final SHARED slot and rolls back the losing command', async () => {
    const createInput = (customerId: string, idempotencyKey: string) => ({
      idempotencyKey,
      code: `DEP-${idempotencyKey}`,
      roomId,
      customerId,
      type: DepositType.BOOKING,
      status: DepositStatus.PENDING,
      amount: 2_000_000,
      expiredAt: expiry,
    });

    const [resultA, resultB] = await Promise.allSettled([
      service1.create(tenantId, createInput(candidateAId, keyA), 'p9-user-a'),
      service2.create(tenantId, createInput(candidateBId, keyB), 'p9-user-b'),
    ]);
    const fulfilled = [resultA, resultB].filter(
      (result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled',
    );
    const rejected = [resultA, resultB].filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason?.message).toContain('ROOM_CAPACITY_EXCEEDED');

    await expect(resourceCount(prisma1)).resolves.toEqual({
      occupancies: 1,
      activeHolds: 1,
      total: 2,
    });

    const winner = fulfilled[0].value;
    const winnerCustomerId = resultA.status === 'fulfilled' ? candidateAId : candidateBId;
    const loserCustomerId = resultA.status === 'rejected' ? candidateAId : candidateBId;
    const winnerKey = resultA.status === 'fulfilled' ? keyA : keyB;
    const loserKey = resultA.status === 'rejected' ? keyA : keyB;

    expect(winner).toMatchObject({
      customerId: winnerCustomerId,
      roomId,
      status: DepositStatus.PENDING,
      holdId: expect.any(String),
      operationId: expect.any(String),
      rentalCycleId: expect.any(String),
    });
    await expect(prisma1.depositOperation.findUniqueOrThrow({
      where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: winnerKey } },
      select: { type: true, status: true },
    })).resolves.toEqual({
      type: DepositOperationType.CREATE,
      status: DepositOperationStatus.COMPLETED,
    });
    await expect(prisma1.outboxEvent.count({
      where: { tenantId, aggregateId: winner.operationId, eventName: 'deposit.created' },
    })).resolves.toBe(1);

    const loserEffects = await candidateEffects(prisma1, loserCustomerId, loserKey);
    expect(loserEffects.deposits).toEqual([]);
    expect(loserEffects.cycles).toBe(0);
    expect(loserEffects.holds).toBe(0);
    expect(loserEffects.operations).toEqual([]);
    expect(loserEffects.outboxEvents).toBe(0);
    expect(loserEffects.audits).toBe(0);
    expect(loserEffects.tasks).toBe(0);

    const replay = await service1.create(
      tenantId,
      createInput(winnerCustomerId, winnerKey),
      'p9-user-a',
    );
    expect(replay).toMatchObject({ id: winner.id, replayed: true, holdId: winner.holdId });
    await expect(resourceCount(prisma1)).resolves.toEqual({
      occupancies: 1,
      activeHolds: 1,
      total: 2,
    });

    await expect(service1.create(
      foreignTenantId,
      createInput(winnerCustomerId, `p9-foreign-${runId}`),
      'p9-user-foreign',
    )).rejects.toThrow('ROOM_NOT_FOUND');
  }, 30_000);
});
