import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { ContractsService } from './contracts.service';

// This suite writes real financial rows. It deliberately never reads DATABASE_URL.
const rawTestDbUrl = process.env.TEST_DATABASE_URL;
const canRunDbTest = Boolean(
  process.env.RUN_LEGACY_IMPORT_DB_TESTS === '1'
    && rawTestDbUrl
    && /(?:_test|_tmp|_isolated)(?:[/?]|$)/i.test(rawTestDbUrl)
    && !rawTestDbUrl.includes('prod')
    && !rawTestDbUrl.includes('staging'),
);
const dbDescribe = canRunDbTest ? describe : describe.skip;
const datasourceUrl = canRunDbTest
  ? rawTestDbUrl!
  : 'postgresql://placeholder:placeholder@localhost:5432/placeholder_test';

dbDescribe('legacy existing-rental import on isolated PostgreSQL', () => {
  const prisma1 = new PrismaClient({ datasources: { db: { url: datasourceUrl } } });
  const prisma2 = new PrismaClient({ datasources: { db: { url: datasourceUrl } } });
  const runId = randomUUID().slice(0, 8);

  const makeService = (client: PrismaClient) => {
    const prismaProxy = new Proxy(client, {
      get(target, property) {
        if (property === 'tx') return target;
        return (target as any)[property];
      },
    });
    return new ContractsService(
      {} as any,
      { log: vi.fn().mockResolvedValue(undefined) } as any,
      prismaProxy as any,
      {} as any,
      {} as any,
    );
  };
  const service1 = makeService(prisma1);
  const service2 = makeService(prisma2);

  const today = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth();
  const paidThrough = new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10);
  const startDate = `${year}-01-01`;
  const endDate = `${year + 1}-12-31`;

  async function seed(label: string, roomCount: number, customerCount: number, options?: {
    rentalType?: 'WHOLE' | 'SHARED'; capacity?: number;
  }) {
    const suffix = `${label}-${randomUUID().slice(0, 6)}`;
    const tenantId = `tenant-legacy-${suffix}`;
    const foreignTenantId = `tenant-legacy-foreign-${suffix}`;
    const buildingId = `building-legacy-${suffix}`;
    const floorId = `floor-legacy-${suffix}`;
    await prisma1.tenantOrg.create({ data: { id: tenantId, name: `Legacy ${suffix}`, code: `LG-${suffix}` } });
    await prisma1.tenantOrg.create({ data: { id: foreignTenantId, name: `Legacy foreign ${suffix}`, code: `LF-${suffix}` } });
    await prisma1.building.create({ data: { id: buildingId, tenantId, code: `B-${suffix}`, name: `Building ${suffix}` } });
    await prisma1.floor.create({ data: { id: floorId, tenantId, buildingId, level: 1, name: 'Floor 1' } });

    const rooms: string[] = [];
    for (let index = 0; index < roomCount; index += 1) {
      const id = `room-legacy-${suffix}-${index}`;
      rooms.push(id);
      await prisma1.room.create({ data: {
        id, tenantId, buildingId, floorId, code: `R-${suffix}-${index}`, name: `Room ${index}`,
        monthlyPrice: 3_000_000, rentalType: options?.rentalType || 'WHOLE',
        capacity: options?.capacity || 1, status: 'AVAILABLE',
      } });
    }
    const customers: string[] = [];
    for (let index = 0; index < customerCount; index += 1) {
      const id = `customer-legacy-${suffix}-${index}`;
      const phone = `09${String(10000000 + index).slice(1)}${suffix.replace(/\D/g, '').slice(0, 1) || '0'}`.slice(0, 10);
      customers.push(id);
      await prisma1.customer.create({ data: {
        id, tenantId, fullName: `Legacy customer ${index}`, phone, phoneNormalized: phone,
      } });
    }
    return { tenantId, foreignTenantId, rooms, customers };
  }

  const command = (customerId: string, roomId: string, idempotencyKey: string, depositAmount = 6_000_000) => ({
    idempotencyKey, customerId, roomId, startDate, endDate, paidThrough,
    rentAmount: 3_000_000, depositAmount,
  });

  afterAll(async () => {
    await Promise.all([prisma1.$disconnect(), prisma2.$disconnect()]);
  });

  it('creates only opening-balance records and replays one command without a second cash document', async () => {
    const fixture = await seed('replay', 1, 1);
    const input = command(fixture.customers[0], fixture.rooms[0], `legacy-replay-${runId}`);

    const [first, replay] = await Promise.all([
      service1.importExisting(input as any, 'legacy-user', fixture.tenantId, input.idempotencyKey),
      service2.importExisting(input as any, 'legacy-user', fixture.tenantId, input.idempotencyKey),
    ]);

    expect([first.replayed, replay.replayed].sort()).toEqual([false, true]);
    const contract = await prisma1.contract.findFirstOrThrow({ where: { tenantId: fixture.tenantId } });
    expect(contract).toMatchObject({ status: 'ACTIVE', activationIdempotencyKey: input.idempotencyKey });
    expect((contract.termsSnapshot as any).legacyImport).toMatchObject({
      policyVersion: 'LEGACY_OPENING_V1', paidThrough, openingReceivable: 0,
    });
    await expect(prisma1.rentalCycle.count({ where: { tenantId: fixture.tenantId } })).resolves.toBe(1);
    await expect(prisma1.occupancy.count({ where: { tenantId: fixture.tenantId, leftAt: null } })).resolves.toBe(1);
    await expect(prisma1.deposit.count({ where: { tenantId: fixture.tenantId } })).resolves.toBe(1);
    await expect(prisma1.depositOperation.count({ where: { tenantId: fixture.tenantId } })).resolves.toBe(1);
    await expect(prisma1.depositLedgerEntry.count({ where: { tenantId: fixture.tenantId, sourceType: 'REVIEWED_OPENING_BALANCE' } })).resolves.toBe(1);
    await expect(prisma1.invoice.count({ where: { tenantId: fixture.tenantId } })).resolves.toBe(0);
    await expect(prisma1.receipt.count({ where: { tenantId: fixture.tenantId } })).resolves.toBe(0);

    await expect(service1.importExisting(input as any, 'legacy-user', fixture.foreignTenantId, input.idempotencyKey))
      .rejects.toThrow();
    await expect(prisma1.contract.count({ where: { tenantId: fixture.foreignTenantId } })).resolves.toBe(0);
  }, 30_000);

  it('allows exactly one import into a WHOLE room under competing commands', async () => {
    const fixture = await seed('whole-race', 1, 2);
    const results = await Promise.allSettled([
      service1.importExisting(command(fixture.customers[0], fixture.rooms[0], `legacy-whole-a-${runId}`) as any, 'user-a', fixture.tenantId, `legacy-whole-a-${runId}`),
      service2.importExisting(command(fixture.customers[1], fixture.rooms[0], `legacy-whole-b-${runId}`) as any, 'user-b', fixture.tenantId, `legacy-whole-b-${runId}`),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    await expect(prisma1.contract.count({ where: { tenantId: fixture.tenantId } })).resolves.toBe(1);
    await expect(prisma1.occupancy.count({ where: { tenantId: fixture.tenantId, roomId: fixture.rooms[0], leftAt: null } })).resolves.toBe(1);
  }, 30_000);

  it('allows exactly one import for a customer racing across two rooms', async () => {
    const fixture = await seed('customer-race', 2, 1);
    const results = await Promise.allSettled([
      service1.importExisting(command(fixture.customers[0], fixture.rooms[0], `legacy-customer-a-${runId}`) as any, 'user-a', fixture.tenantId, `legacy-customer-a-${runId}`),
      service2.importExisting(command(fixture.customers[0], fixture.rooms[1], `legacy-customer-b-${runId}`) as any, 'user-b', fixture.tenantId, `legacy-customer-b-${runId}`),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    await expect(prisma1.contract.count({ where: { tenantId: fixture.tenantId, customerId: fixture.customers[0] } })).resolves.toBe(1);
    await expect(prisma1.occupancy.count({ where: { tenantId: fixture.tenantId, customerId: fixture.customers[0], leftAt: null } })).resolves.toBe(1);
  }, 30_000);

  it('enforces SHARED capacity under competing imports', async () => {
    const fixture = await seed('shared-race', 1, 2, { rentalType: 'SHARED', capacity: 1 });
    const results = await Promise.allSettled([
      service1.importExisting(command(fixture.customers[0], fixture.rooms[0], `legacy-shared-a-${runId}`) as any, 'user-a', fixture.tenantId, `legacy-shared-a-${runId}`),
      service2.importExisting(command(fixture.customers[1], fixture.rooms[0], `legacy-shared-b-${runId}`) as any, 'user-b', fixture.tenantId, `legacy-shared-b-${runId}`),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    await expect(prisma1.occupancy.count({ where: { tenantId: fixture.tenantId, roomId: fixture.rooms[0], leftAt: null } })).resolves.toBe(1);
    await expect(prisma1.contract.count({ where: { tenantId: fixture.tenantId, roomId: fixture.rooms[0] } })).resolves.toBe(1);
  }, 30_000);
});
