import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DepositCoreService } from '../deposits/deposit-core.service';
import { InvoicesService } from './invoices.service';

// This gate is deliberately opt-in and refuses every database except its
// pre-created, local disposable PostgreSQL 16 database.
const enabled = process.env.RUN_BOOKING_INVOICE_DB_TESTS === '1';
const rawUrl = process.env.TEST_DATABASE_URL;
const parsed = rawUrl ? new URL(rawUrl) : null;
if (enabled && (!parsed || parsed.hostname !== '127.0.0.1'
  || !/^\/homeland_booking_(?:cash_20261017|invoice)_test$/i.test(parsed.pathname))) {
  throw new Error('Booking invoice gate requires the dedicated local test database.');
}

(enabled ? describe : describe.skip)('booking invoice payment — real PostgreSQL 16', () => {
  const url = rawUrl || 'postgresql://placeholder:placeholder@127.0.0.1/homeland_booking_cash_20261017_test';
  const clients = [new PrismaClient({ datasources: { db: { url } } }), new PrismaClient({ datasources: { db: { url } } })];
  const scope = randomUUID().replaceAll('-', '').slice(0, 14);
  const userId = `booking-cash-user-${scope}`;
  const service = (client = clients[0], core: any = new DepositCoreService({ tx: client } as any)) =>
    new InvoicesService({} as any, {} as any, { tx: client } as any, core);
  const id = (kind: string, suffix: string) => `booking-cash-${scope}-${kind}-${suffix}`;

  type Fixture = Awaited<ReturnType<typeof createFixture>>;
  async function createFixture(suffix: string, options: {
    marker?: unknown;
    billingKind?: string | null;
    amount?: number;
    tenantId?: string;
    withHold?: boolean;
  } = {}) {
    const client = clients[0];
    const tenantId = options.tenantId || id('tenant', suffix);
    const amount = options.amount ?? 1_000_000;
    const buildingId = id('building', suffix);
    const floorId = id('floor', suffix);
    const roomId = id('room', suffix);
    const customerId = id('customer', suffix);
    const cycleId = id('cycle', suffix);
    const contractId = id('contract', suffix);
    const depositId = id('deposit', suffix);
    const invoiceId = id('invoice', suffix);
    const now = Date.now();
    const startsAt = new Date(now);
    const dueAt = new Date(now + 24 * 60 * 60 * 1000);
    const expiresAt = new Date(now + 30 * 24 * 60 * 60 * 1000);
    const endsAt = new Date(now + 365 * 24 * 60 * 60 * 1000);
    const marker = options.marker === undefined
      ? { idempotencyKey: id('command', suffix), depositId, invoiceId, phase: 'INVOICE_ISSUED' }
      : options.marker;
    await client.tenantOrg.create({ data: { id: tenantId, code: `BC-${scope}-${suffix}`, name: `Booking cash ${suffix}` } });
    await client.building.create({ data: { id: buildingId, tenantId, code: `B-${scope}-${suffix}`, name: `Building ${suffix}` } });
    await client.floor.create({ data: { id: floorId, tenantId, buildingId, level: 1, name: `Floor ${suffix}` } });
    await client.room.create({ data: {
      id: roomId, tenantId, buildingId, floorId, code: `R-${scope}-${suffix}`, name: `Whole ${suffix}`,
      rentalType: 'WHOLE', capacity: 1, monthlyPrice: 4_000_000,
    } });
    await client.customer.create({ data: {
      id: customerId, tenantId, fullName: `Booking customer ${suffix}`,
      phone: `fixture-${scope}-${suffix}`, phoneNormalized: `fixture-${scope}-${suffix}`,
    } });
    await client.rentalCycle.create({ data: { id: cycleId, tenantId, customerId, roomId, status: 'RESERVED' } });
    await client.contract.create({ data: {
      id: contractId, tenantId, customerId, roomId, rentalCycleId: cycleId,
      code: `CT-${scope}-${suffix}`, status: 'DRAFT', startDate: startsAt,
      endDate: endsAt, monthlyRent: 4_000_000, depositMoney: amount,
      termsSnapshot: marker === null ? {} : { bookingCommand: marker } as any,
    } });
    await client.deposit.create({ data: {
      id: depositId, tenantId, code: `DP-${scope}-${suffix}`, type: 'BOOKING', status: 'PENDING', amount,
      roomId, customerId, contractId, rentalCycleId: cycleId, expiredAt: expiresAt,
    } });
    if (options.withHold !== false) await client.roomHold.create({ data: {
      id: id('hold', suffix), tenantId, roomId, rentalCycleId: cycleId, depositId, kind: 'WHOLE',
      resourceKey: `room:${roomId}:whole`, activeResourceKey: `room:${roomId}:whole`, status: 'ACTIVE',
      expiresAt, idempotencyKey: id('hold-command', suffix), createdBy: userId,
    } });
    await client.invoice.create({ data: {
      id: invoiceId, tenantId, contractId, rentalCycleId: cycleId, customerId, code: `INV-${scope}-${suffix}`,
      period: 'Cọc giữ phòng', billingKind: options.billingKind === undefined ? 'BOOKING_HOLD' : options.billingKind,
      status: 'ISSUED', dueDate: dueAt, subtotal: amount, total: amount,
    } });
    return { tenantId, buildingId, floorId, roomId, customerId, cycleId, contractId, depositId, invoiceId, amount };
  }

  const financialCounts = async (f: Fixture) => ({
    payments: await clients[0].payment.count({ where: { tenantId: f.tenantId, invoiceId: f.invoiceId } }),
    allocations: await clients[0].paymentAllocation.count({ where: { tenantId: f.tenantId, invoiceId: f.invoiceId } }),
    cashIns: await clients[0].depositLedgerEntry.count({ where: { tenantId: f.tenantId, depositId: f.depositId, type: 'CASH_IN' } }),
    operations: await clients[0].depositOperation.count({ where: { tenantId: f.tenantId, sourceDepositId: f.depositId } }),
  });

  beforeAll(async () => { await Promise.all(clients.map((client) => client.$connect())); });
  afterAll(async () => { await Promise.all(clients.map((client) => client.$disconnect())); });

  it('settles 400k then 600k through the exact marker with one atomic booking cash-in and durable evidence', async () => {
    const f = await createFixture('partial-final');
    await expect(service().pay(f.invoiceId, 400_000, 'MANUAL', id('ref', 'partial-400'), userId, f.tenantId))
      .resolves.toMatchObject({ status: 'PARTIALLY_PAID', paidAmount: 400_000 });
    await expect(service().pay(f.invoiceId, 600_000, 'MANUAL', id('ref', 'partial-600'), userId, f.tenantId))
      .resolves.toMatchObject({ status: 'PAID', paidAmount: 1_000_000 });
    expect(await financialCounts(f)).toEqual({ payments: 2, allocations: 2, cashIns: 1, operations: 1 });
    expect(Number((await clients[0].depositLedgerEntry.findFirstOrThrow({ where: { tenantId: f.tenantId, depositId: f.depositId, type: 'CASH_IN' } })).amount)).toBe(1_000_000);
    expect(await clients[0].outboxEvent.count({ where: { tenantId: f.tenantId, OR: [{ aggregateId: f.invoiceId }, { eventName: 'deposit.collected' }] } })).toBe(3);
    expect(await clients[0].auditLog.count({ where: { tenantId: f.tenantId, OR: [{ entityId: f.invoiceId }, { entityId: f.depositId }] } })).toBe(3);
  });

  it('rejects direct collection for an exact present booking marker before any financial write', async () => {
    const f = await createFixture('direct-reject');
    await expect(new DepositCoreService({ tx: clients[0] } as any).collect(f.tenantId, f.depositId, { idempotencyKey: id('collect', 'direct') }, userId))
      .rejects.toThrow('BOOKING_HOLD_PAY_THROUGH_LINKED_INVOICE');
    expect(await financialCounts(f)).toEqual({ payments: 0, allocations: 0, cashIns: 0, operations: 0 });
  });

  it('rejects a malformed present marker, but preserves truly markerless legacy collection', async () => {
    const bad = await createFixture('bad-marker', { marker: { depositId: 'wrong', invoiceId: '' } });
    await expect(new DepositCoreService({ tx: clients[0] } as any).collect(bad.tenantId, bad.depositId, { idempotencyKey: id('collect', 'bad') }, userId))
      .rejects.toThrow('BOOKING_HOLD_INVOICE_MARKER_INVALID');
    expect(await financialCounts(bad)).toEqual({ payments: 0, allocations: 0, cashIns: 0, operations: 0 });
    const legacy = await createFixture('legacy-markerless', { marker: null });
    await expect(new DepositCoreService({ tx: clients[0] } as any).collect(legacy.tenantId, legacy.depositId,
      { idempotencyKey: id('collect', 'legacy') }, userId)).resolves.toMatchObject({ status: 'PAID', collectedAmount: 1_000_000 });
    expect(await financialCounts(legacy)).toEqual({ payments: 0, allocations: 0, cashIns: 1, operations: 1 });
  });

  it('fails closed when a booking invoice is markerless, without creating a payment or cash-in', async () => {
    const f = await createFixture('invoice-markerless', { marker: null });
    await expect(service().pay(f.invoiceId, f.amount, 'MANUAL', id('ref', 'markerless'), userId, f.tenantId))
      .rejects.toThrow('BOOKING_HOLD_INVOICE_SETTLEMENT_SCOPE_INVALID');
    expect(await financialCounts(f)).toEqual({ payments: 0, allocations: 0, cashIns: 0, operations: 0 });
  });

  it('blocks an overflow after a partial payment without altering its prior financial state', async () => {
    const f = await createFixture('overflow');
    await service().pay(f.invoiceId, 400_000, 'MANUAL', id('ref', 'overflow-first'), userId, f.tenantId);
    await expect(service().pay(f.invoiceId, 700_000, 'MANUAL', id('ref', 'overflow-second'), userId, f.tenantId)).rejects.toThrow('cannot exceed');
    expect(await financialCounts(f)).toEqual({ payments: 1, allocations: 1, cashIns: 0, operations: 0 });
  });

  it('makes an exact provider reference concurrent replay idempotent: one payment, allocation and cash-in', async () => {
    const f = await createFixture('same-ref');
    const reference = id('ref', 'same');
    const results = await Promise.allSettled([
      service(clients[0]).pay(f.invoiceId, f.amount, 'SEPAY', reference, userId, f.tenantId),
      service(clients[1]).pay(f.invoiceId, f.amount, 'SEPAY', reference, userId, f.tenantId),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(2);
    expect(await financialCounts(f)).toEqual({ payments: 1, allocations: 1, cashIns: 1, operations: 1 });
  }, 20_000);

  it('allows only one winner for concurrent distinct final references', async () => {
    const f = await createFixture('different-ref');
    await service().pay(f.invoiceId, 400_000, 'MANUAL', id('ref', 'different-first'), userId, f.tenantId);
    const results = await Promise.allSettled([
      service(clients[0]).pay(f.invoiceId, 600_000, 'MANUAL', id('ref', 'different-a'), userId, f.tenantId),
      service(clients[1]).pay(f.invoiceId, 600_000, 'MANUAL', id('ref', 'different-b'), userId, f.tenantId),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(await financialCounts(f)).toEqual({ payments: 2, allocations: 2, cashIns: 1, operations: 1 });
  }, 20_000);

  it('rolls back invoice payment, allocation, deposit ledger and evidence when a real collector throws after its write', async () => {
    const f = await createFixture('fault-rollback');
    const realCore = new DepositCoreService({ tx: clients[0] } as any);
    const faultingCore = { collectInTransaction: async (tx: any, tenantId: string, depositId: string, input: any, actorId: string) => {
      await realCore.collectInTransaction(tx, tenantId, depositId, input, actorId);
      throw new Error('TEST_FORCED_AFTER_REAL_COLLECTION');
    } };
    await expect(service(clients[0], faultingCore).pay(f.invoiceId, f.amount, 'MANUAL', id('ref', 'fault'), userId, f.tenantId))
      .rejects.toThrow('TEST_FORCED_AFTER_REAL_COLLECTION');
    expect(await financialCounts(f)).toEqual({ payments: 0, allocations: 0, cashIns: 0, operations: 0 });
    expect(await clients[0].invoice.findUniqueOrThrow({ where: { id: f.invoiceId } })).toMatchObject({ status: 'ISSUED', paidAmount: expect.anything() });
    expect(Number((await clients[0].invoice.findUniqueOrThrow({ where: { id: f.invoiceId } })).paidAmount)).toBe(0);
    expect(await clients[0].outboxEvent.count({ where: { tenantId: f.tenantId } })).toBe(0);
    expect(await clients[0].auditLog.count({ where: { tenantId: f.tenantId } })).toBe(0);
  });

  it('rejects cross-tenant and exact-marker/deposit mismatch attempts with zero local effects', async () => {
    const foreign = await createFixture('foreign');
    const f = await createFixture('cross-tenant');
    await expect(service().pay(f.invoiceId, f.amount, 'MANUAL', id('ref', 'foreign'), userId, foreign.tenantId)).rejects.toThrow('INVOICE_NOT_FOUND');
    await clients[0].contract.update({ where: { id: f.contractId }, data: { termsSnapshot: { bookingCommand: { depositId: foreign.depositId, invoiceId: f.invoiceId } } } });
    await expect(service().pay(f.invoiceId, f.amount, 'MANUAL', id('ref', 'mismatch'), userId, f.tenantId))
      .rejects.toThrow('BOOKING_HOLD_INVOICE_SETTLEMENT_SCOPE_INVALID');
    expect(await financialCounts(f)).toEqual({ payments: 0, allocations: 0, cashIns: 0, operations: 0 });
    expect(await financialCounts(foreign)).toEqual({ payments: 0, allocations: 0, cashIns: 0, operations: 0 });
  });
});
