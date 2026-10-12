import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RoomsService } from './rooms.service';
import { DepositCoreService } from '../deposits/deposit-core.service';

const rawUrl = process.env.TEST_DATABASE_URL;
const enabled = process.env.RUN_ROOM_TURNOVER_DB_TESTS === '1';
if (enabled) {
  const target = rawUrl ? new URL(rawUrl) : null;
  if (!target || !['postgresql:', 'postgres:'].includes(target.protocol) ||
    target.pathname !== '/homeland_release_baseline_test' ||
    !['127.0.0.1', 'homeland-staging-db-08de2dca'].includes(target.hostname) ||
    (target.hostname === '127.0.0.1' ? target.port !== '5436' : target.port !== '5432')) {
    throw new Error('ROOM_TURNOVER_TEST_DATABASE_REFUSED');
  }
}

(enabled ? describe : describe.skip)('Room turnover isolated PostgreSQL gate', () => {
  const db = new PrismaClient({ datasources: { db: { url: rawUrl || 'postgresql://placeholder:placeholder@localhost:5432/placeholder_test' } } });
  const bookingDb = new PrismaClient({ datasources: { db: { url: rawUrl || 'postgresql://placeholder:placeholder@localhost:5432/placeholder_test' } } });
  const prefix = `turnover-${randomUUID()}`;
  const tenantId = `${prefix}-tenant`;
  const buildingId = `${prefix}-building`;
  const floorId = `${prefix}-floor`;
  const service = new RoomsService({} as any, {} as any, db as any);
  const booking = new DepositCoreService({ tx: bookingDb } as any);
  const complete = (id: string, scope = tenantId) => service.update(id, { status: 'AVAILABLE' }, `${prefix}-user`, 'Rooms', scope);

  beforeAll(async () => {
    const [identity] = await db.$queryRawUnsafe<Array<{ name: string }>>('SELECT current_database() AS name');
    expect(identity.name).toBe('homeland_release_baseline_test');
    const [history] = await db.$queryRawUnsafe<Array<{ count: bigint }>>('SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL');
    expect(Number(history.count)).toBe(34);
    await db.tenantOrg.create({ data: { id: tenantId, code: prefix, name: 'Synthetic turnover gate' } });
    await db.building.create({ data: { id: buildingId, tenantId, code: prefix, name: 'Synthetic turnover building' } });
    await db.floor.create({ data: { id: floorId, tenantId, buildingId, level: 1, name: 'Synthetic floor' } });
  });
  afterAll(async () => { await Promise.all([db.$disconnect(), bookingDb.$disconnect()]); });

  async function room(label: string, status: any = 'CLEANING') {
    return db.room.create({ data: { tenantId, buildingId, floorId, code: label, name: label, status, monthlyPrice: 1000000 } });
  }
  async function customer(label: string, roomId?: string) {
    return db.customer.create({ data: { tenantId, fullName: label, phone: `${prefix}-${label}`, phoneNormalized: `${prefix}-${label}`, roomId } });
  }

  it('commits vacant cleaning transition with exactly one audit', async () => {
    const target = await room('clean');
    await complete(target.id);
    expect((await db.room.findUniqueOrThrow({ where: { id: target.id } })).status).toBe('AVAILABLE');
    const logs = await db.auditLog.findMany({ where: { tenantId, entity: 'Room', entityId: target.id } });
    expect(logs).toHaveLength(1);
    expect(logs[0].before).toMatchObject({ status: 'CLEANING' });
    expect(logs[0].after).toMatchObject({ status: 'AVAILABLE' });
  });

  it('rejects foreign scope and soft-deleted rooms without audit', async () => {
    const target = await room('foreign');
    await expect(complete(target.id, `${prefix}-foreign`)).rejects.toThrow('ROOM_TURNOVER_ROOM_NOT_FOUND');
    await db.room.update({ where: { id: target.id }, data: { deletedAt: new Date() } });
    await expect(complete(target.id)).rejects.toThrow('ROOM_TURNOVER_ROOM_NOT_FOUND');
    expect(await db.auditLog.count({ where: { entityId: target.id } })).toBe(0);
  });

  it.each(['occupancy', 'contract', 'hold', 'customer'])('rejects %s binding without partial write', async (kind) => {
    const target = await room(kind);
    const resident = await customer(kind, kind === 'customer' ? target.id : undefined);
    if (kind === 'occupancy') await db.occupancy.create({ data: { tenantId, roomId: target.id, customerId: resident.id, role: 'PRIMARY' } });
    if (kind === 'contract') await db.contract.create({ data: { tenantId, roomId: target.id, customerId: resident.id, code: `${prefix}-${kind}`, status: 'APPROVED', startDate: new Date(), endDate: new Date(Date.now() + 86400000), monthlyRent: 1000000, depositMoney: 1000000 } });
    if (kind === 'hold') {
      const cycle = await db.rentalCycle.create({ data: { tenantId, roomId: target.id, customerId: resident.id } });
      await db.roomHold.create({ data: { tenantId, roomId: target.id, rentalCycleId: cycle.id, kind: 'WHOLE', resourceKey: target.id, activeResourceKey: target.id, idempotencyKey: target.id, expiresAt: new Date(Date.now() + 86400000) } });
    }
    await expect(complete(target.id)).rejects.toThrow('ROOM_TURNOVER_ROOM_IN_USE');
    expect((await db.room.findUniqueOrThrow({ where: { id: target.id } })).status).toBe('CLEANING');
    expect(await db.auditLog.count({ where: { entityId: target.id } })).toBe(0);
  });

  it('rolls status back when audit persistence fails', async () => {
    const target = await room('audit-failure');
    const faulty = { $transaction: (callback: any, options: any) => db.$transaction((tx) => callback(new Proxy(tx, {
      get(object, property) {
        if (property === 'auditLog') return { create: async () => { throw new Error('SYNTHETIC_AUDIT_FAILURE'); } };
        const value = (object as any)[property];
        return typeof value === 'function' ? value.bind(object) : value;
      },
    })), options) };
    const failingService = new RoomsService({} as any, {} as any, faulty as any);
    await expect(failingService.update(target.id, { status: 'AVAILABLE' }, `${prefix}-user`, 'Rooms', tenantId)).rejects.toThrow('SYNTHETIC_AUDIT_FAILURE');
    expect((await db.room.findUniqueOrThrow({ where: { id: target.id } })).status).toBe('CLEANING');
    expect(await db.auditLog.count({ where: { entityId: target.id } })).toBe(0);
  });

  it('serializes simultaneous turnover and canonical booking with valid final resources', async () => {
    const target = await room('race', 'AVAILABLE');
    const applicant = await customer('race');
    const results = await Promise.allSettled([
      complete(target.id),
      booking.create(tenantId, { idempotencyKey: `${prefix}-booking`, roomId: target.id, customerId: applicant.id, amount: 1000000, type: 'BOOKING', expiredAt: new Date(Date.now() + 86400000) }, `${prefix}-user`),
    ]);
    expect(results[1].status).toBe('fulfilled');
    expect((await db.room.findUniqueOrThrow({ where: { id: target.id } })).status).toBe('RESERVED');
    expect(await db.roomHold.count({ where: { tenantId, roomId: target.id, status: 'ACTIVE' } })).toBe(1);
    expect(await db.depositOperation.count({ where: { tenantId, idempotencyKey: `${prefix}-booking` } })).toBe(1);
    expect(await db.deposit.count({ where: { tenantId, roomId: target.id } })).toBe(1);
    const auditCount = await db.auditLog.count({ where: { tenantId, entity: 'Room', entityId: target.id } });
    expect(auditCount).toBe(results[0].status === 'fulfilled' ? 1 : 0);
    if (results[0].status === 'rejected') expect(String(results[0].reason.message)).toMatch(/ROOM_TURNOVER_(INVALID_STATUS|ROOM_IN_USE)/);
    await expect(complete(target.id)).rejects.toThrow('ROOM_TURNOVER_INVALID_STATUS');
    expect(await db.auditLog.count({ where: { tenantId, entity: 'Room', entityId: target.id } })).toBe(auditCount);
  }, 20000);

  it('rejects waiting turnover after canonical booking commits with zero partial audit', async () => {
    const target = await room('booking-first', 'AVAILABLE');
    const applicant = await customer('booking-first');
    let bookingWritten!: () => void;
    let releaseBooking!: () => void;
    let lockEntered!: () => void;
    const written = new Promise<void>((resolve) => { bookingWritten = resolve; });
    const release = new Promise<void>((resolve) => { releaseBooking = resolve; });
    const entered = new Promise<void>((resolve) => { lockEntered = resolve; });
    const waitFor = async <T>(promise: Promise<T>, label: string, timeoutMs = 5000): Promise<T> => {
      let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([
          promise,
          new Promise<T>((_, reject) => {
            timeoutHandle = setTimeout(() => reject(new Error(`${label}_TIMEOUT`)), timeoutMs);
          }),
        ]);
      } finally {
        if (timeoutHandle) clearTimeout(timeoutHandle);
      }
    };
    const bookingService = new DepositCoreService({ tx: {
      $transaction: (callback: any, options: any) => bookingDb.$transaction(async (tx) => {
        const result = await callback(tx);
        bookingWritten();
        await release;
        return result;
      }, options),
    } } as any);
    const bookingResult = bookingService.create(tenantId, {
        idempotencyKey: `${prefix}-booking-first`, roomId: target.id,
        customerId: applicant.id, amount: 1000000, type: 'BOOKING',
        expiredAt: new Date(Date.now() + 86400000),
      }, `${prefix}-user`);
    const observedBooking = bookingResult.then(() => ({ error: null }), (error) => ({ error }));
    const instrumented = { $transaction: (callback: any, options: any) => db.$transaction((tx) => callback(new Proxy(tx, {
      get(object, property) {
        if (property === '$queryRaw') return (...args: any[]) => {
          lockEntered();
          return (object.$queryRaw as any)(...args);
        };
        const value = (object as any)[property];
        return typeof value === 'function' ? value.bind(object) : value;
      },
    })), options) };
    let observedTurnover: Promise<Error | null> | undefined;
    try {
      const first = await Promise.race([written.then(() => ({ error: null })), observedBooking]);
      if (first.error) throw first.error;
      const waitingService = new RoomsService({} as any, {} as any, instrumented as any);
      const turnoverResult = waitingService.update(target.id, { status: 'AVAILABLE' }, `${prefix}-user`, 'Rooms', tenantId);
      observedTurnover = turnoverResult.then(() => null, (error) => error);
      await waitFor(entered, 'ROOM_TURNOVER_LOCK_ENTRY');
      releaseBooking();
      const outcome = await observedBooking;
      if (outcome.error) throw outcome.error;
      expect((await observedTurnover)?.message).toBe('ROOM_TURNOVER_INVALID_STATUS');
      expect((await db.room.findUniqueOrThrow({ where: { id: target.id } })).status).toBe('RESERVED');
      expect(await db.roomHold.count({ where: { tenantId, roomId: target.id, status: 'ACTIVE' } })).toBe(1);
      expect(await db.depositOperation.count({ where: { tenantId, idempotencyKey: `${prefix}-booking-first` } })).toBe(1);
      expect(await db.auditLog.count({ where: { tenantId, entity: 'Room', entityId: target.id } })).toBe(0);
    } finally {
      releaseBooking();
      await observedBooking;
      if (observedTurnover) await observedTurnover;
    }
  }, 20000);
});
