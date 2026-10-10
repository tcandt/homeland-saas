import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { CreateBookingHoldSchema } from '@homeland/shared';
import { ContractsService } from './contracts.service';
import { ContractsController } from './contracts.controller';
import { PERMISSIONS_KEY } from '../shared/decorators/require-permissions.decorator';

const input = (overrides: Record<string, unknown> = {}) => CreateBookingHoldSchema.parse({
  idempotencyKey: 'booking-intent-12345', customerId: 'customer-1', roomId: 'room-1',
  startDate: '2026-10-11T17:00:00.000Z', endDate: '2026-11-11T17:00:00.000Z',
  rentAmount: 4_000_000, bookingAmount: 2_000_000, contractDepositAmount: 8_000_000,
  ...overrides,
});

// Unit orchestration harness only: it is NOT PostgreSQL lock/concurrency evidence.
function fixture() {
  let state: any = { contracts: [], cycles: [], deposits: [], invoices: [], audits: [] };
  const clone = (value: any) => value == null ? value : structuredClone(value);
  const matches = (row: any, where: any) => row.tenantId === where.tenantId &&
    (!where.id || row.id === where.id) && !row.deletedAt &&
    (!where.customerId || row.customerId === where.customerId) &&
    (!where.roomId?.not || row.roomId !== where.roomId.not) &&
    (!where.status?.in || where.status.in.includes(row.status));
  const tx: any = {
    $queryRaw: vi.fn().mockResolvedValue([{ lock: '' }]),
    customer: { findFirst: vi.fn(async ({ where }) =>
      ['tenant-1', 'tenant-2'].includes(where.tenantId) && where.id === 'customer-1' ? { id: where.id } : null) },
    room: { findFirst: vi.fn(async ({ where }) => where.id === 'room-1' ? { id: where.id } : null) },
    occupancy: { findFirst: vi.fn().mockResolvedValue(null) },
    rentalCycle: { create: vi.fn(async ({ data }) => {
      const row = { ...data, id: `cycle-${state.cycles.length + 1}` };
      state.cycles.push(row); return clone(row);
    }) },
    contract: {
      findFirst: vi.fn(async ({ where }) => clone(state.contracts.find((row: any) =>
        matches(row, where) && (!where.termsSnapshot ||
          row.termsSnapshot.bookingCommand.idempotencyKey === where.termsSnapshot.equals)))),
      create: vi.fn(async ({ data }) => {
        const row = { ...data, id: `contract-${state.contracts.length + 1}` };
        state.contracts.push(row); return clone(row);
      }),
      update: vi.fn(async ({ where, data }) => {
        const row = state.contracts.find((row: any) => matches(row, where));
        if (!row) throw new Error('Missing scoped contract');
        Object.assign(row, clone(data)); return clone(row);
      }),
    },
    deposit: { findFirst: vi.fn(async ({ where }) => clone(state.deposits.find((row: any) => matches(row, where)))) },
    invoice: {
      findFirst: vi.fn(async ({ where }) => clone(state.invoices.find((row: any) =>
        matches(row, where) && row.baseInvoiceKey === where.baseInvoiceKey))),
      create: vi.fn(async ({ data }) => {
        const row = { ...data, id: `invoice-${state.invoices.length + 1}`, items: data.items.create };
        state.invoices.push(row); return clone(row);
      }),
    },
    auditLog: { create: vi.fn(async ({ data }) => { state.audits.push(clone(data)); return data; }) },
  };
  tx.$transaction = vi.fn(async (callback: any) => {
    const before = clone(state);
    try { return await callback(tx); } catch (error) { state = before; throw error; }
  });
  const persistDeposit = async (tenantId: string, data: any) => {
    const existing = state.deposits.find((row: any) => row.tenantId === tenantId && row.idempotencyKey === data.idempotencyKey);
    if (existing) return clone(existing);
    const row = { ...data, tenantId, id: `deposit-${state.deposits.length + 1}` };
    state.deposits.push(row); return clone(row);
  };
  const depositCore = { create: vi.fn(persistDeposit) };
  const payments = { createInvoiceRequest: vi.fn(async (id) => ({ id: `request-${id}`, sourceId: id })) };
  const invoices = { issueInTransaction: vi.fn(async (_db, id) => {
    const row = state.invoices.find((row: any) => row.id === id);
    row.status = 'ISSUED'; return clone(row);
  }) };
  const service = new ContractsService({} as any, {} as any, { tx } as any,
    {} as any, {} as any, depositCore as any, payments as any, undefined, invoices as any);
  vi.spyOn(service as any, 'withContractSnapshots').mockImplementation(async (data: any) => ({ ...data, termsSnapshot: { policy: 'fixture' } }));
  const history = vi.spyOn(service as any, 'syncContractHistory').mockResolvedValue(undefined);
  return { service, tx, depositCore, payments, invoices, history, persistDeposit, state: () => state };
}

describe('resumable booking command — unit orchestration', () => {
  it('replays one aggregate and preserves cash-hold/future-deposit distinction', async () => {
    const f = fixture();
    const first = await f.service.createBookingHold(input(), 'user-1', 'tenant-1');
    const replay = await f.service.createBookingHold(input(), 'user-1', 'tenant-1');
    expect(replay.replayed).toBe(true);
    expect(replay.contract.id).toBe(first.contract.id);
    expect(replay.invoice.id).toBe(first.invoice.id);
    expect(replay.deposit.id).toBe(first.deposit.id);
    expect(f.state().contracts).toHaveLength(1);
    expect(f.state().cycles).toHaveLength(1);
    expect(f.state().deposits).toHaveLength(1);
    expect(f.state().invoices).toHaveLength(1);
    expect(f.state().audits).toHaveLength(1);
    expect(f.history).toHaveBeenCalledWith(expect.objectContaining({ id: first.contract.id }), f.tx);
    expect(replay.contract.depositMoney).toBe(2_000_000);
    expect(replay.contract.termsSnapshot.bookingCommand).toMatchObject({
      phase: 'INVOICE_ISSUED', invoiceId: first.invoice.id, requestedContractDepositAmount: 8_000_000,
    });
    expect(replay.invoice).toMatchObject({ contractId: first.contract.id, rentalCycleId: first.contract.rentalCycleId, billingKind: 'BOOKING_HOLD', paidAmount: 0 });
    expect(replay.deposit).toMatchObject({ contractId: first.contract.id, rentalCycleId: first.contract.rentalCycleId, status: 'PENDING' });
  });

  it('rejects changed input under the same identity before additional money writes', async () => {
    const f = fixture(); await f.service.createBookingHold(input(), 'user-1', 'tenant-1');
    await expect(f.service.createBookingHold(input({ bookingAmount: 1_000_000 }), 'user-1', 'tenant-1'))
      .rejects.toThrow('BOOKING_IDEMPOTENCY_KEY_REUSED');
    expect(f.depositCore.create).toHaveBeenCalledTimes(1);
    expect(f.state().invoices).toHaveLength(1);
  });

  it('keeps the same key independent across tenants and rejects cross-tenant customers', async () => {
    const f = fixture();
    const a = await f.service.createBookingHold(input(), 'user-1', 'tenant-1');
    const b = await f.service.createBookingHold(input(), 'user-2', 'tenant-2');
    expect(a.contract.id).not.toBe(b.contract.id);
    expect(a.deposit.idempotencyKey).not.toBe(b.deposit.idempotencyKey);
    await expect(f.service.createBookingHold(input({ idempotencyKey: 'foreign-booking-intent', customerId: 'foreign-customer' }), 'user-1', 'tenant-1'))
      .rejects.toThrow('CUSTOMER_NOT_FOUND');
    expect(f.state().contracts).toHaveLength(2);
  });

  it('rejects a booking that would silently move a currently bound customer', async () => {
    const f = fixture();
    f.tx.customer.findFirst.mockResolvedValue({ id: 'customer-1', roomId: 'room-2' });

    await expect(f.service.createBookingHold(input({ idempotencyKey: 'bound-customer-booking' }), 'user-1', 'tenant-1'))
      .rejects.toThrow('BOOKING_CUSTOMER_ALREADY_BOUND');
    expect(f.state().contracts).toHaveLength(0);
    expect(f.state().cycles).toHaveLength(0);
  });

  it('rejects a booking when an open occupancy binds the customer elsewhere', async () => {
    const f = fixture();
    f.tx.occupancy = { findFirst: vi.fn().mockResolvedValue({ id: 'occupancy-1' }) };

    await expect(f.service.createBookingHold(input({ idempotencyKey: 'occupied-customer-booking' }), 'user-1', 'tenant-1'))
      .rejects.toThrow('BOOKING_CUSTOMER_ALREADY_OCCUPIED');
    expect(f.state().contracts).toHaveLength(0);
    expect(f.state().cycles).toHaveLength(0);
  });

  it('resumes after a deposit response is lost without creating a second deposit', async () => {
    const f = fixture();
    f.depositCore.create.mockImplementationOnce(async (tenantId, data) => {
      await f.persistDeposit(tenantId, data); throw new Error('response lost');
    });
    await expect(f.service.createBookingHold(input(), 'user-1', 'tenant-1')).rejects.toThrow('response lost');
    const resumed = await f.service.createBookingHold(input(), 'user-1', 'tenant-1');
    expect(resumed.invoice.status).toBe('ISSUED');
    expect(f.state().contracts).toHaveLength(1);
    expect(f.state().deposits).toHaveLength(1);
    expect(f.state().invoices).toHaveLength(1);
  });

  it('reports QR failure honestly and retries it without new financial documents', async () => {
    const f = fixture(); f.payments.createInvoiceRequest.mockRejectedValueOnce(new Error('provider-secret-detail'));
    const first = await f.service.createBookingHold(input(), 'user-1', 'tenant-1');
    expect(first.paymentRequest).toBeNull();
    expect(first.paymentRequestError).toBe('BOOKING_PAYMENT_REQUEST_FAILED');
    const next = await f.service.createBookingHold(input(), 'user-1', 'tenant-1');
    expect(next.paymentRequest.sourceId).toBe(first.invoice.id);
    expect(next.paymentRequestError).toBeNull();
    expect(f.state().invoices).toHaveLength(1);
  });

  it('rolls back the first stage when its audit write fails', async () => {
    const f = fixture(); f.tx.auditLog.create.mockRejectedValueOnce(new Error('audit unavailable'));
    await expect(f.service.createBookingHold(input(), 'user-1', 'tenant-1')).rejects.toThrow('audit unavailable');
    expect(f.state().contracts).toHaveLength(0);
    expect(f.state().cycles).toHaveLength(0);
    expect(f.depositCore.create).not.toHaveBeenCalled();
  });

  it('keeps derived deposit identity within the core limit for a maximum-size caller key', async () => {
    const f = fixture(); await f.service.createBookingHold(input({ idempotencyKey: 'x'.repeat(128) }), 'user-1', 'tenant-1');
    expect(f.depositCore.create.mock.calls[0][1].idempotencyKey.length).toBeLessThanOrEqual(128);
  });

  it('rejects invalid dates and amounts before database writes', async () => {
    const f = fixture();
    await expect(f.service.createBookingHold(input({ endDate: 'invalid' }), 'user-1', 'tenant-1')).rejects.toThrow('BOOKING_END_DATE_INVALID');
    await expect(f.service.createBookingHold(input({ bookingAmount: 0.001 }), 'user-1', 'tenant-1')).rejects.toThrow('BOOKING_AMOUNT_INVALID');
    expect(() => input({ bookingAmount: Infinity })).toThrow();
    expect(f.tx.$transaction).not.toHaveBeenCalled();
  });

  it('retains the permissions needed by the original separate endpoints', () => {
    expect(Reflect.getMetadata(PERMISSIONS_KEY, ContractsController.prototype.createBookingHold)).toEqual([
      'contract.create', 'deposit.create', 'invoice.create', 'invoice.update', 'invoice.read',
    ]);
  });
});
