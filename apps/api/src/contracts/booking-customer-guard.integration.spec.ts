import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { CreateBookingHoldSchema } from '@homeland/shared';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ContractsService } from './contracts.service';
import { DepositCoreService } from '../deposits/deposit-core.service';

// Never fall back to a running application database. Each run keeps its own
// tenant fixtures; no teardown deletes or resets a database.
const enabled = process.env.RUN_BOOKING_GUARD_DB_TESTS === '1';
const rawUrl = process.env.TEST_DATABASE_URL;
const parsed = rawUrl ? new URL(rawUrl) : null;
if (enabled && (!parsed || !['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname)
  || !/^\/homeland_repair_[a-z0-9_]+_test$/i.test(parsed.pathname))) {
  throw new Error('Booking guard tests require an explicitly named local disposable database.');
}

(enabled ? describe : describe.skip)('booking customer guard — real PostgreSQL', () => {
  const url = rawUrl || 'postgresql://placeholder:placeholder@127.0.0.1/placeholder_test';
  const clients = [0, 1].map(() => new PrismaClient({ datasources: { db: { url } } }));
  const id = randomUUID().slice(0, 8);
  const tenantId = `booking-guard-${id}`;
  const foreignTenantId = `booking-foreign-${id}`;
  const rooms = [0, 1, 2, 3].map((n) => `booking-room-${id}-${n}`);
  const userId = `booking-user-${id}`;
  const deposits = clients.map((client) => new DepositCoreService({ tx: client } as any));
  const payment = { createInvoiceRequest: vi.fn(async () => ({ id: 'mock-provider-request' })) };
  const services = clients.map((client, n) => {
    const issuer = { issueInTransaction: async (tx: any, invoiceId: string) => tx.invoice.update({ where: { id: invoiceId }, data: { status: 'ISSUED' }, include: { items: true } }) };
    const service = new ContractsService({} as any, {} as any, { tx: client } as any,
      {} as any, {} as any, deposits[n], payment as any, undefined, issuer as any);
    // These tests exercise DB locks/booking persistence, not snapshot policies,
    // invoice issuance policy, history publishing or an external provider.
    vi.spyOn(service as any, 'withContractSnapshots').mockImplementation(async (data: any) => ({ ...data, termsSnapshot: {} }));
    vi.spyOn(service as any, 'syncContractHistory').mockResolvedValue(undefined);
    return service;
  });
  const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const command = (customerId: string, roomId: string, key: string) => CreateBookingHoldSchema.parse({
    idempotencyKey: key, customerId, roomId, startDate: new Date().toISOString(),
    endDate: new Date(Date.now() + 30 * 86400000).toISOString(), expiredAt: expiry.toISOString(),
    rentAmount: 4_000_000, bookingAmount: 2_000_000, contractDepositAmount: 4_000_000,
  });
  const createCustomer = (suffix: string, roomId?: string) => clients[0].customer.create({
    data: { id: `booking-customer-${id}-${suffix}`, tenantId, fullName: `Disposable ${suffix}`, phone: `fixture-${id}-${suffix}`, phoneNormalized: `fixture-${id}-${suffix}`, roomId },
  });
  const depositInput = (customerId: string, roomId: string, key: string) => ({
    idempotencyKey: key, customerId, roomId, amount: 2_000_000,
    type: 'BOOKING' as const, expiredAt: expiry.toISOString(),
  });

  beforeAll(async () => {
    await clients[0].tenantOrg.createMany({ data: [
      { id: tenantId, code: `BG-${id}`, name: 'Disposable booking guard' },
      { id: foreignTenantId, code: `BGF-${id}`, name: 'Disposable foreign tenant' },
    ] });
    await clients[0].building.create({ data: { id: `booking-building-${id}`, tenantId, code: `B-${id}`, name: 'Disposable building' } });
    await clients[0].floor.create({ data: { id: `booking-floor-${id}`, tenantId, buildingId: `booking-building-${id}`, level: 1, name: 'Disposable floor' } });
    for (const [n, roomId] of rooms.entries()) await clients[0].room.create({ data: {
      id: roomId, tenantId, buildingId: `booking-building-${id}`, floorId: `booking-floor-${id}`,
      code: `R-${id}-${n}`, name: `Disposable room ${n}`, rentalType: 'WHOLE', capacity: 1, monthlyPrice: 4_000_000,
    } });
  });
  afterAll(async () => { await Promise.all(clients.map((client) => client.$disconnect())); });

  it('blocks an existing room binding before either entry point writes financial objects', async () => {
    const customer = await createCustomer('bound', rooms[0]);
    await expect(services[0].createBookingHold(command(customer.id, rooms[1], `bound-${id}`), userId, tenantId)).rejects.toThrow('BOOKING_CUSTOMER_ALREADY_BOUND');
    await expect(deposits[0].create(tenantId, depositInput(customer.id, rooms[1], `direct-bound-${id}`), userId)).rejects.toThrow('DEPOSIT_CUSTOMER_ALREADY_BOUND');
    expect(await clients[0].contract.count({ where: { tenantId, customerId: customer.id } })).toBe(0);
    expect(await clients[0].deposit.count({ where: { tenantId, customerId: customer.id } })).toBe(0);
    expect((await clients[0].customer.findUniqueOrThrow({ where: { id: customer.id } })).roomId).toBe(rooms[0]);
  });

  it('blocks open occupancy even when the customer room projection is missing', async () => {
    const customer = await createCustomer('occupancy');
    const cycle = await clients[0].rentalCycle.create({ data: { tenantId, roomId: rooms[0], customerId: customer.id, status: 'ACTIVE' } });
    await clients[0].occupancy.create({ data: { tenantId, roomId: rooms[0], customerId: customer.id, rentalCycleId: cycle.id, role: 'REPRESENTATIVE' } });
    await expect(services[0].createBookingHold(command(customer.id, rooms[1], `occupancy-${id}`), userId, tenantId)).rejects.toThrow('BOOKING_CUSTOMER_ALREADY_OCCUPIED');
    await expect(deposits[0].create(tenantId, depositInput(customer.id, rooms[1], `direct-occupancy-${id}`), userId)).rejects.toThrow('DEPOSIT_CUSTOMER_ALREADY_OCCUPIED');
    expect(await clients[0].deposit.count({ where: { tenantId, customerId: customer.id } })).toBe(0);
  });

  it('allows only one cross-room customer binding under concurrent deposit creation', async () => {
    const customer = await createCustomer('race');
    const results = await Promise.allSettled(deposits.map((service, n) => service.create(tenantId,
      depositInput(customer.id, rooms[n + 1], `customer-race-${id}-${n}`), userId)));
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const rows = await clients[0].deposit.findMany({ where: { tenantId, customerId: customer.id } });
    expect(rows).toHaveLength(1);
    expect((await clients[0].customer.findUniqueOrThrow({ where: { id: customer.id } })).roomId).toBe(rows[0].roomId);
    expect(await clients[0].roomHold.count({ where: { tenantId, depositId: rows[0].id, status: 'ACTIVE' } })).toBe(1);
  }, 20_000);

  it('keeps one canonical aggregate through concurrent replay and QR failure recovery', async () => {
    const customer = await createCustomer('retry');
    const input = command(customer.id, rooms[3], `canonical-retry-${id}`);
    payment.createInvoiceRequest.mockRejectedValueOnce(new Error('mock provider unavailable'));
    const results = await Promise.all(services.map((service) => service.createBookingHold(input, userId, tenantId)));
    expect(new Set(results.map((result) => result.contract.id)).size).toBe(1);
    expect(new Set(results.map((result) => result.deposit.id)).size).toBe(1);
    expect(new Set(results.map((result) => result.invoice.id)).size).toBe(1);
    expect(results.some((result) => result.paymentRequestError === 'BOOKING_PAYMENT_REQUEST_FAILED')).toBe(true);
    const replay = await services[0].createBookingHold(input, userId, tenantId);
    expect(replay.paymentRequestError).toBeNull();
    expect(await clients[0].contract.count({ where: { tenantId, customerId: customer.id } })).toBe(1);
    expect(await clients[0].deposit.count({ where: { tenantId, customerId: customer.id } })).toBe(1);
    expect(await clients[0].invoice.count({ where: { tenantId, customerId: customer.id } })).toBe(1);
    expect(await clients[0].depositLedgerEntry.count({ where: { tenantId, rentalCycleId: replay.contract.rentalCycleId } })).toBe(0);
    await expect(services[0].createBookingHold({ ...input, bookingAmount: 1_000_000 }, userId, tenantId)).rejects.toThrow('BOOKING_IDEMPOTENCY_KEY_REUSED');
  }, 20_000);

  it('rejects foreign customer identity without creating a local aggregate', async () => {
    const foreign = await clients[0].customer.create({ data: { tenantId: foreignTenantId, fullName: 'Foreign disposable customer', phone: `fixture-${id}-foreign`, phoneNormalized: `fixture-${id}-foreign` } });
    await expect(services[0].createBookingHold(command(foreign.id, rooms[3], `foreign-${id}`), userId, tenantId)).rejects.toThrow('CUSTOMER_NOT_FOUND');
    expect(await clients[0].contract.count({ where: { tenantId, customerId: foreign.id } })).toBe(0);
  });
});
