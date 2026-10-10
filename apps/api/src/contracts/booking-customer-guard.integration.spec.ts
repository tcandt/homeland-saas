import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
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
  const rooms = Array.from({ length: 10 }, (_, n) => `booking-room-${id}-${n}`);
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
  const legacyBooking = async (suffix: string, roomId: string) => {
    const customer = await createCustomer(suffix);
    const input = command(customer.id, roomId, `legacy-${suffix}-${id}`);
    const commandKey = input.idempotencyKey;
    const code = `HD-COC-${roomId.slice(-8).toUpperCase()}-${createHash('sha256').update(`${tenantId}:${commandKey}`).digest('hex').slice(0, 8).toUpperCase()}`;
    const depositKey = `booking:${createHash('sha256').update(`${tenantId}:${commandKey}`).digest('hex')}:deposit`;
    const requestHash = (services[0] as any).hashSettlementRequest({ tenantId, commandKey,
      customerId: input.customerId, roomId: input.roomId, contractCode: null,
      startDate: input.startDate, endDate: input.endDate, firstPaymentDate: null,
      rentAmount: input.rentAmount, contractDepositAmount: input.contractDepositAmount,
      bookingAmount: input.bookingAmount, memberCount: input.memberCount || 1,
      purpose: null, expiredAt: input.expiredAt, note: null,
    });
    const cycle = await clients[0].rentalCycle.create({ data: { tenantId, customerId: customer.id, roomId, status: 'PLANNED', expectedMoveInAt: new Date(input.startDate) } });
    const contract = await clients[0].contract.create({ data: { tenantId, customerId: customer.id,
      roomId, rentalCycleId: cycle.id, code, status: 'DRAFT', startDate: new Date(input.startDate),
      endDate: new Date(input.endDate), monthlyRent: input.rentAmount, depositMoney: input.bookingAmount,
      termsSnapshot: { bookingCommand: { idempotencyKey: commandKey, requestHash,
        phase: 'CONTRACT_CREATED', depositId: null, invoiceId: null,
        depositIdempotencyKey: depositKey, contractCode: code,
        requestedContractDepositAmount: input.contractDepositAmount,
      } },
    } });
    const legacyDepositInput = { ...depositInput(customer.id, roomId, depositKey),
      code: `DC-GP-${code}`, contractId: contract.id, rentalCycleId: cycle.id,
      status: 'PENDING' as const, expiredAt: new Date(input.expiredAt!), note: `Tạo từ lệnh booking ${commandKey}`,
    };
    return { customer, input, cycle, contract, legacyDepositInput };
  };

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

  it('rolls back the complete booking aggregate when the room is full', async () => {
    const occupant = await createCustomer('full-occupant');
    const cycle = await clients[0].rentalCycle.create({ data: { tenantId, roomId: rooms[0], customerId: occupant.id, status: 'ACTIVE' } });
    await clients[0].occupancy.create({ data: { tenantId, roomId: rooms[0], customerId: occupant.id, rentalCycleId: cycle.id, role: 'REPRESENTATIVE' } });
    const customer = await createCustomer('full-booking');
    await expect(services[0].createBookingHold(command(customer.id, rooms[0], `full-${id}`), userId, tenantId)).rejects.toThrow('ROOM_HOLD_CONFLICT');
    expect(await clients[0].contract.count({ where: { tenantId, customerId: customer.id } })).toBe(0);
    expect(await clients[0].rentalCycle.count({ where: { tenantId, customerId: customer.id } })).toBe(0);
    expect(await clients[0].deposit.count({ where: { tenantId, customerId: customer.id } })).toBe(0);
  });

  it('rejects unavailable rooms before reserving and leaves no draft aggregate', async () => {
    const customer = await createCustomer('unavailable');
    await clients[0].room.update({ where: { id: rooms[2] }, data: { status: 'MAINTENANCE' } });
    await expect(services[0].createBookingHold(command(customer.id, rooms[2], `unavailable-${id}`), userId, tenantId)).rejects.toThrow('ROOM_UNAVAILABLE');
    expect(await clients[0].contract.count({ where: { tenantId, customerId: customer.id } })).toBe(0);
    expect(await clients[0].rentalCycle.count({ where: { tenantId, customerId: customer.id } })).toBe(0);
    expect(await clients[0].deposit.count({ where: { tenantId, customerId: customer.id } })).toBe(0);
    await clients[0].room.update({ where: { id: rooms[2] }, data: { status: 'AVAILABLE' } });
  });

  it('rolls back the losing different-room booking for one customer', async () => {
    const customer = await createCustomer('booking-race');
    const results = await Promise.allSettled([
      services[0].createBookingHold(command(customer.id, rooms[1], `booking-race-a-${id}`), userId, tenantId),
      services[1].createBookingHold(command(customer.id, rooms[2], `booking-race-b-${id}`), userId, tenantId),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(await clients[0].contract.count({ where: { tenantId, customerId: customer.id } })).toBe(1);
    expect(await clients[0].rentalCycle.count({ where: { tenantId, customerId: customer.id } })).toBe(1);
    expect(await clients[0].deposit.count({ where: { tenantId, customerId: customer.id } })).toBe(1);
  }, 20_000);

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

  it('resumes a legacy contract-only stage concurrently without duplicate documents', async () => {
    const f = await legacyBooking('contract-only', rooms[4]);
    const results = await Promise.all(services.map((s) => s.createBookingHold(f.input, userId, tenantId)));
    expect(results.every((r) => r.contract.id === f.contract.id)).toBe(true);
    expect(new Set(results.map((r) => r.deposit.id)).size).toBe(1);
    expect(new Set(results.map((r) => r.invoice.id)).size).toBe(1);
    expect(await clients[0].rentalCycle.count({ where: { tenantId, customerId: f.customer.id } })).toBe(1);
    expect(await clients[0].deposit.count({ where: { tenantId, customerId: f.customer.id } })).toBe(1);
    expect(await clients[0].depositOperation.count({ where: { tenantId, contractId: f.contract.id, type: 'CREATE' } })).toBe(1);
    expect(await clients[0].auditLog.count({ where: { tenantId, entityId: f.contract.id, action: 'UPDATE', module: 'ContractsBookingHold' } })).toBe(1);
  }, 20_000);

  it('links the completed legacy deposit operation instead of creating another deposit', async () => {
    const f = await legacyBooking('deposit-exists', rooms[5]);
    const deposit: any = await deposits[0].create(tenantId, f.legacyDepositInput, userId);
    const recovered = await services[0].createBookingHold(f.input, userId, tenantId);
    expect(recovered.contract.id).toBe(f.contract.id);
    expect(recovered.deposit.id).toBe(deposit.id);
    expect(await clients[0].deposit.count({ where: { tenantId, customerId: f.customer.id } })).toBe(1);
    expect(await clients[0].depositOperation.count({ where: { tenantId, contractId: f.contract.id } })).toBe(1);
  });

  it('does not resurrect a cancelled legacy hold or issue an invoice on retry', async () => {
    const f = await legacyBooking('cancelled', rooms[6]);
    const deposit: any = await deposits[0].create(tenantId, f.legacyDepositInput, userId);
    await deposits[0].collect(tenantId, deposit.id, { idempotencyKey: `legacy-collect-${id}`, holdExpiresAt: f.input.expiredAt }, userId);
    await deposits[0].cancel(tenantId, deposit.id, { idempotencyKey: `legacy-cancel-${id}`, reason: 'Disposable cancellation', refundAmount: 2_000_000 }, userId);
    await expect(services[0].createBookingHold(f.input, userId, tenantId)).rejects.toThrow('BOOKING_PARTIAL_REQUIRES_RECONCILIATION');
    expect(await clients[0].deposit.count({ where: { tenantId, customerId: f.customer.id } })).toBe(1);
    expect(await clients[0].invoice.count({ where: { tenantId, customerId: f.customer.id } })).toBe(0);
    expect((await clients[0].contract.findUniqueOrThrow({ where: { id: f.contract.id } })).termsSnapshot).toEqual(f.contract.termsSnapshot);
  });

  it('rolls back recovery when the mandatory recovery audit fails', async () => {
    const f = await legacyBooking('audit-fails', rooms[7]);
    const originalPrisma = (services[0] as any).prisma;
    (services[0] as any).prisma = { tx: { $transaction: (callback: any, options: any) => clients[0].$transaction((tx) => callback(new Proxy(tx, {
      get(target, property) {
        if (property === 'auditLog') return { create: (args: any) => {
          if (args.data.module === 'ContractsBookingHold') throw new Error('mock recovery audit failure');
          return target.auditLog.create(args);
        } };
        return Reflect.get(target, property);
      },
    })), options) } };
    try {
      await expect(services[0].createBookingHold(f.input, userId, tenantId)).rejects.toThrow('mock recovery audit failure');
    } finally { (services[0] as any).prisma = originalPrisma; }
    expect(await clients[0].deposit.count({ where: { tenantId, customerId: f.customer.id } })).toBe(0);
    expect(await clients[0].roomHold.count({ where: { tenantId, rentalCycleId: f.cycle.id } })).toBe(0);
    expect((await clients[0].customer.findUniqueOrThrow({ where: { id: f.customer.id } })).roomId).toBeNull();
    expect((await clients[0].contract.findUniqueOrThrow({ where: { id: f.contract.id } })).termsSnapshot).toEqual(f.contract.termsSnapshot);
  });

  it('does not issue an invoice when cancellation wins between recovery and invoice stages', async () => {
    const f = await legacyBooking('cancel-before-invoice', rooms[8]);
    const service: any = services[0];
    const original = service.runBookingSerializable.bind(service);
    let stage = 0;
    service.runBookingSerializable = async (callback: any) => {
      const result = await original(callback);
      stage += 1;
      if (stage === 2) {
        const deposit = await clients[0].deposit.findFirstOrThrow({ where: { tenantId, customerId: f.customer.id } });
        await deposits[1].collect(tenantId, deposit.id, { idempotencyKey: `cancel-before-invoice-collect-${id}`, holdExpiresAt: f.input.expiredAt }, userId);
        await deposits[1].cancel(tenantId, deposit.id, { idempotencyKey: `cancel-before-invoice-cancel-${id}`, reason: 'Cancelled before invoice stage', refundAmount: 2_000_000 }, userId);
      }
      return result;
    };
    try {
      await expect(service.createBookingHold(f.input, userId, tenantId)).rejects.toThrow('BOOKING_DEPOSIT_NOT_OPEN');
    } finally { service.runBookingSerializable = original; }
    expect(await clients[0].invoice.count({ where: { tenantId, customerId: f.customer.id } })).toBe(0);
    expect((await clients[0].contract.findUniqueOrThrow({ where: { id: f.contract.id } })).status).toBe('CANCELLED');
  }, 20_000);
});
