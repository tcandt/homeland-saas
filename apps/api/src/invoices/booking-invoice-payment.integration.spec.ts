import { createHash, randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WorkflowEngine } from '../automation/workflow/workflow.engine';
import { DepositCoreService } from '../deposits/deposit-core.service';
import { JournalEntryService } from '../finance/journal-entry.service';
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
  const workflow = (client = clients[0]) => new WorkflowEngine(
    client as any,
    { dispatch: async () => undefined, dispatchDirect: async () => undefined } as any,
    { invalidateDashboard: async () => undefined, invalidateFinance: async () => undefined } as any,
    new JournalEntryService(client as any),
    { generateDocument: async () => undefined, requestSignature: async () => undefined } as any,
  );
  const id = (kind: string, suffix: string) => `booking-cash-${scope}-${kind}-${suffix}`;
  const delay = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

  type Fixture = Awaited<ReturnType<typeof createFixture>>;
  async function createFixture(suffix: string, options: {
    marker?: unknown;
    billingKind?: string | null;
    period?: string;
    amount?: number;
    tenantId?: string;
    withHold?: boolean;
    withInvoice?: boolean;
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
    if (options.withInvoice !== false) await client.invoice.create({ data: {
      id: invoiceId, tenantId, contractId, rentalCycleId: cycleId, customerId, code: `INV-${scope}-${suffix}`,
      baseInvoiceKey: `BOOKING:${contractId}:${String((marker as any)?.idempotencyKey || id('legacy', suffix))}`,
      period: options.period ?? 'Cọc giữ phòng', billingKind: options.billingKind === undefined ? 'BOOKING_HOLD' : options.billingKind,
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
    expect(await financialCounts(f)).toEqual({ payments: 2, allocations: 2, cashIns: 2, operations: 2 });
    expect((await clients[0].depositLedgerEntry.findMany({
      where: { tenantId: f.tenantId, depositId: f.depositId, type: 'CASH_IN' }, orderBy: { createdAt: 'asc' },
    })).map((entry) => Number(entry.amount))).toEqual([400_000, 600_000]);
    expect(await clients[0].outboxEvent.count({ where: { tenantId: f.tenantId, OR: [{ aggregateId: f.invoiceId }, { eventName: 'deposit.collected' }] } })).toBe(4);
    expect(await clients[0].auditLog.count({ where: { tenantId: f.tenantId, OR: [{ entityId: f.invoiceId }, { entityId: f.depositId }] } })).toBe(4);
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
    const legacy = await createFixture('legacy-markerless', { marker: null, withInvoice: false, withHold: false });
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
    expect(await financialCounts(f)).toEqual({ payments: 1, allocations: 1, cashIns: 1, operations: 1 });
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
    expect(await financialCounts(f)).toEqual({ payments: 2, allocations: 2, cashIns: 2, operations: 2 });
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

  it('cancels a partially funded booking with immutable credit closure and a pending mixed disposition', async () => {
    const f = await createFixture('cancel-partial');
    await service().pay(f.invoiceId, 400_000, 'MANUAL', id('ref', 'cancel-partial'), userId, f.tenantId);
    const core = new DepositCoreService({ tx: clients[0] } as any);
    const cancellation = await core.cancel(f.tenantId, f.depositId, {
      idempotencyKey: id('cancel', 'partial'), reason: 'Acceptance partial cancellation',
      keepAmount: 100_000, deductAmount: 100_000, refundAmount: 200_000, refundStatus: 'PENDING',
    }, userId);

    expect(cancellation).toMatchObject({ pending: true, refundAmount: 200_000, keepAmount: 100_000, deductAmount: 100_000 });
    if (!('operationId' in cancellation)) throw new Error('Expected a fresh cancellation operation.');
    const cancellationOperationId = cancellation.operationId;
    const root = await clients[0].invoice.findUniqueOrThrow({ where: { id: f.invoiceId } });
    expect(root).toMatchObject({ status: 'PARTIALLY_PAID' });
    expect(Number(root.paidAmount)).toBe(400_000);
    const credit = await clients[0].invoice.findFirstOrThrow({ where: {
      tenantId: f.tenantId, adjustmentOfInvoiceId: f.invoiceId, billingKind: 'CREDIT_ADJUSTMENT',
    } });
    expect(Number(credit.total)).toBe(600_000);
    const dispositions = await clients[0].depositLedgerEntry.findMany({
      where: { tenantId: f.tenantId, depositId: f.depositId, type: { in: ['KEEP', 'DEDUCT'] } },
      orderBy: { createdAt: 'asc' },
    });
    expect(dispositions.map((entry) => [entry.type, Number(entry.amount)])).toEqual([['KEEP', 100_000], ['DEDUCT', 100_000]]);
    expect(await clients[0].depositOperation.findFirstOrThrow({ where: { id: cancellationOperationId } }))
      .toMatchObject({ status: 'PENDING' });

    const completed = await core.completePendingRefund(
      f.tenantId, cancellationOperationId, id('complete-refund', 'partial'), userId,
      { attachmentUrls: ['/acceptance/partial-refund-proof.pdf'] },
    );
    expect(completed).toMatchObject({ status: 'COMPLETED', amount: 200_000 });
    const finalEntries = await clients[0].depositLedgerEntry.findMany({
      where: { tenantId: f.tenantId, depositId: f.depositId }, orderBy: { createdAt: 'asc' },
    });
    expect(finalEntries.reduce((sum, entry) => sum + Number(entry.balanceEffect), 0)).toBe(0);
    await expect(core.completePendingRefund(
      f.tenantId, cancellationOperationId, id('complete-refund', 'partial'), userId,
      { attachmentUrls: ['/acceptance/partial-refund-proof.pdf'] },
    )).resolves.toMatchObject({ replayed: true });
    expect(await clients[0].depositLedgerEntry.count({ where: { tenantId: f.tenantId, depositId: f.depositId, type: 'REFUND' } })).toBe(1);
  }, 20_000);

  it('cancels a zero-funded modern booking without inventing cash and closes the unpaid root by credit adjustment', async () => {
    const f = await createFixture('cancel-zero');
    const result = await new DepositCoreService({ tx: clients[0] } as any).cancel(f.tenantId, f.depositId, {
      idempotencyKey: id('cancel', 'zero'), reason: 'Acceptance zero-funded cancellation',
      keepAmount: 0, deductAmount: 0, refundAmount: 0,
    }, userId);
    expect(result).toMatchObject({ pending: false, refundAmount: 0, keepAmount: 0, deductAmount: 0 });
    expect(await financialCounts(f)).toEqual({ payments: 0, allocations: 0, cashIns: 0, operations: 1 });
    const credit = await clients[0].invoice.findFirstOrThrow({ where: {
      tenantId: f.tenantId, adjustmentOfInvoiceId: f.invoiceId, billingKind: 'CREDIT_ADJUSTMENT',
    } });
    expect(Number(credit.total)).toBe(f.amount);
    expect(await clients[0].depositLedgerEntry.count({ where: { tenantId: f.tenantId, depositId: f.depositId } })).toBe(0);
  });

  it('expires an already-expired hold after a separate transaction releases its row lock', async () => {
    const f = await createFixture('expiry-lock-wait');
    const hold = await clients[0].roomHold.findFirstOrThrow({ where: { tenantId: f.tenantId, depositId: f.depositId } });
    await clients[0].roomHold.update({ where: { id: hold.id }, data: { expiresAt: new Date(Date.now() - 1_000) } });
    let locked!: () => void;
    let release!: () => void;
    const lockReady = new Promise<void>((resolve) => { locked = resolve; });
    const unlock = new Promise<void>((resolve) => { release = resolve; });
    const locker = clients[1].$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "RoomHold" WHERE "id" = ${hold.id} FOR UPDATE`);
      locked();
      await unlock;
    });
    await lockReady;
    const expiry = new DepositCoreService({ tx: clients[0] } as any).expireHolds(f.tenantId, new Date(), userId);
    await expect(Promise.race([expiry.then(() => 'completed'), delay(80).then(() => 'waiting')])).resolves.toBe('waiting');
    release();
    await locker;
    await expect(expiry).resolves.toMatchObject({ expiredCount: 1 });
    await expect(clients[0].roomHold.findUniqueOrThrow({ where: { id: hold.id } })).resolves.toMatchObject({ status: 'EXPIRED' });
  }, 20_000);

  it('rejects payment when its active-hold row lock waits past the hold expiry', async () => {
    const f = await createFixture('payment-lock-expiry');
    const hold = await clients[0].roomHold.findFirstOrThrow({ where: { tenantId: f.tenantId, depositId: f.depositId } });
    await clients[0].roomHold.update({ where: { id: hold.id }, data: { expiresAt: new Date(Date.now() + 500) } });
    let locked!: () => void;
    let release!: () => void;
    const lockReady = new Promise<void>((resolve) => { locked = resolve; });
    const unlock = new Promise<void>((resolve) => { release = resolve; });
    const locker = clients[1].$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "RoomHold" WHERE "id" = ${hold.id} FOR UPDATE`);
      locked();
      await unlock;
    });
    await lockReady;
    const payment = service(clients[0]).pay(f.invoiceId, f.amount, 'MANUAL', id('ref', 'payment-lock-expiry'), userId, f.tenantId);
    await expect(Promise.race([payment.then(() => 'completed', () => 'completed'), delay(100).then(() => 'waiting')])).resolves.toBe('waiting');
    await delay(550);
    release();
    await locker;
    await expect(payment).rejects.toThrow('BOOKING_HOLD_NOT_ACTIVE_FOR_PAYMENT');
    expect(await financialCounts(f)).toEqual({ payments: 0, allocations: 0, cashIns: 0, operations: 0 });
  }, 20_000);

  it('serializes pay versus zero-funded cancellation without creating a mixed financial state', async () => {
    const f = await createFixture('pay-cancel-race');
    const results = await Promise.allSettled([
      service(clients[0]).pay(f.invoiceId, 400_000, 'MANUAL', id('ref', 'pay-cancel'), userId, f.tenantId),
      new DepositCoreService({ tx: clients[1] } as any).cancel(f.tenantId, f.depositId, {
        idempotencyKey: id('cancel', 'pay-race'), reason: 'Acceptance payment cancellation race',
        keepAmount: 0, deductAmount: 0, refundAmount: 0,
      }, userId),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const counts = await financialCounts(f);
    expect(
      (counts.payments === 1 && counts.allocations === 1 && counts.cashIns === 1 && counts.operations === 1)
      || (counts.payments === 0 && counts.allocations === 0 && counts.cashIns === 0 && counts.operations === 1),
    ).toBe(true);
  }, 20_000);

  it('posts two booking installments once each and survives concurrent journal replay', async () => {
    const f = await createFixture('installment-journal');
    await service().pay(f.invoiceId, 400_000, 'MANUAL', id('ref', 'journal-400'), userId, f.tenantId);
    await service().pay(f.invoiceId, 600_000, 'MANUAL', id('ref', 'journal-600'), userId, f.tenantId);
    const payments = await clients[0].payment.findMany({
      where: { tenantId: f.tenantId, invoiceId: f.invoiceId, status: 'CONFIRMED' }, orderBy: { amount: 'asc' },
    });
    const engine = workflow();
    const payload = (payment: any) => ({
      tenantId: f.tenantId, sourceType: 'DEPOSIT', sourceId: f.depositId, amount: Number(payment.amount),
      paymentId: payment.id, paidAt: payment.paidAt?.toISOString(),
      metadata: { code: `DEP-${f.depositId}`, bookingInvoiceInstallment: true, linkedInvoicePayment: true },
    });
    await (engine as any).executeStep('CREATE_JOURNAL_ENTRY', payload(payments[0]));
    await (engine as any).executeStep('CREATE_JOURNAL_ENTRY', payload(payments[1]));
    await Promise.all([
      (engine as any).executeStep('CREATE_JOURNAL_ENTRY', payload(payments[0])),
      (workflow(clients[1]) as any).executeStep('CREATE_JOURNAL_ENTRY', payload(payments[0])),
    ]);
    const journals = await clients[0].journalEntry.findMany({ where: { tenantId: f.tenantId, sourceType: 'PAYMENT' }, include: { lines: true } });
    expect(journals).toHaveLength(2);
    expect(journals
      .map((journal) => journal.lines.map((line) => `${line.type}:${Number(line.amount)}`).sort().join(','))
      .sort())
      .toEqual(['CREDIT:400000,DEBIT:400000', 'CREDIT:600000,DEBIT:600000']);
  }, 20_000);

  it('preserves partially collected cash after expiry until an explicit cancellation refund policy is chosen', async () => {
    const f = await createFixture('funded-expiry-policy');
    const core = new DepositCoreService({ tx: clients[0] } as any);
    await service().pay(f.invoiceId, 400_000, 'MANUAL', id('ref', 'funded-expiry-400'), userId, f.tenantId);
    const hold = await clients[0].roomHold.findFirstOrThrow({ where: { tenantId: f.tenantId, depositId: f.depositId } });
    await clients[0].roomHold.update({ where: { id: hold.id }, data: { expiresAt: new Date(Date.now() - 1_000) } });
    await expect(core.expireHolds(f.tenantId, new Date(), userId)).resolves.toMatchObject({ expiredCount: 1 });
    await expect(service().pay(f.invoiceId, 600_000, 'MANUAL', id('ref', 'funded-expiry-600'), userId, f.tenantId))
      .rejects.toThrow('BOOKING_HOLD_NOT_ACTIVE_FOR_PAYMENT');
    await expect(core.renewHold(f.tenantId, f.depositId, {
      idempotencyKey: id('renew', 'funded-expiry'), expiresAt: new Date(Date.now() + 86_400_000),
    }, userId)).rejects.toThrow('ROOM_HOLD_NOT_ACTIVE');
    await expect(core.convertToSecurity(f.tenantId, f.depositId, {
      idempotencyKey: id('convert', 'funded-expiry'), securityRequired: f.amount,
    }, userId)).rejects.toThrow('DEPOSIT_SOURCE_MUST_BE_PAID');
    expect(await financialCounts(f)).toEqual({ payments: 1, allocations: 1, cashIns: 1, operations: 1 });
    expect(await clients[0].depositLedgerEntry.findMany({
      where: { tenantId: f.tenantId, depositId: f.depositId }, select: { type: true, amount: true, balanceEffect: true },
    })).toEqual([{ type: 'CASH_IN', amount: expect.anything(), balanceEffect: expect.anything() }]);
    await expect(core.cancel(f.tenantId, f.depositId, {
      idempotencyKey: id('cancel', 'funded-expiry'), reason: 'Explicit post-expiry refund policy',
      keepAmount: 0, deductAmount: 0, refundAmount: 400_000, refundStatus: 'PENDING',
    }, userId)).resolves.toMatchObject({ pending: true, refundAmount: 400_000 });
    expect(await clients[0].depositLedgerEntry.count({
      where: { tenantId: f.tenantId, depositId: f.depositId, type: { in: ['KEEP', 'DEDUCT', 'REFUND'] } },
    })).toBe(0);
  }, 20_000);

  it('posts an ordinary invoice payment journal once across a concurrent retry', async () => {
    const f = await createFixture('ordinary-journal-retry', { marker: null, billingKind: 'MONTHLY_BASE', period: 'Tiền thuê tháng 10' });
    await service().pay(f.invoiceId, f.amount, 'MANUAL', id('ref', 'ordinary-journal'), userId, f.tenantId);
    const payment = await clients[0].payment.findFirstOrThrow({ where: { tenantId: f.tenantId, invoiceId: f.invoiceId, status: 'CONFIRMED' } });
    const payload = {
      tenantId: f.tenantId, sourceType: 'INVOICE', sourceId: f.invoiceId, amount: f.amount,
      paymentId: payment.id, paymentAmount: f.amount,
      metadata: { code: `INV-${f.invoiceId}`, paymentJournalIdentity: 'PAYMENT_V1' },
    };
    await Promise.all([
      (workflow() as any).executeStep('CREATE_JOURNAL_ENTRY', payload),
      (workflow(clients[1]) as any).executeStep('CREATE_JOURNAL_ENTRY', payload),
    ]);
    const journals = await clients[0].journalEntry.findMany({ where: { tenantId: f.tenantId, sourceType: 'INVOICE', sourceId: f.invoiceId }, include: { lines: true } });
    expect(journals).toHaveLength(1);
    expect(journals[0].lines.map((line) => [line.type, Number(line.amount)]).sort())
      .toEqual([['CREDIT', f.amount], ['DEBIT', f.amount]]);
  }, 20_000);

  it('journals pending keep and deduct once, then journals refund once and suppresses verified retries', async () => {
    const f = await createFixture('disposition-journals');
    await service().pay(f.invoiceId, 400_000, 'MANUAL', id('ref', 'disposition'), userId, f.tenantId);
    const core = new DepositCoreService({ tx: clients[0] } as any);
    const cancellation = await core.cancel(f.tenantId, f.depositId, {
      idempotencyKey: id('cancel', 'disposition'), reason: 'Disposition journals',
      keepAmount: 100_000, deductAmount: 100_000, refundAmount: 200_000, refundStatus: 'PENDING',
    }, userId);
    if (!('operationId' in cancellation)) throw new Error('Expected a fresh cancellation operation.');
    const eventPayload = (ledger: any) => ({
      tenantId: f.tenantId, sourceType: 'DEPOSIT', sourceId: f.depositId, amount: Number(ledger.amount),
      metadata: { bookingDispositionJournalMode: 'LEDGER_V1', bookingDispositionLedgerId: ledger.id, bookingDispositionOperationId: ledger.operationId },
    });
    const pending = await clients[0].depositLedgerEntry.findMany({
      where: { tenantId: f.tenantId, depositId: f.depositId, type: { in: ['KEEP', 'DEDUCT'] } }, orderBy: { type: 'asc' },
    });
    await Promise.all(pending.map((ledger) => (workflow() as any).executeStep('CREATE_JOURNAL_ENTRY', eventPayload(ledger))));
    await Promise.all([
      (workflow() as any).executeStep('CREATE_JOURNAL_ENTRY', eventPayload(pending[0])),
      (workflow(clients[1]) as any).executeStep('CREATE_JOURNAL_ENTRY', eventPayload(pending[0])),
      (workflow() as any).executeStep('CREATE_JOURNAL_ENTRY', {
        tenantId: f.tenantId, sourceType: 'DEPOSIT', sourceId: f.depositId, amount: 100_000,
        metadata: { bookingDispositionJournalMode: 'LEDGER_V1', operationId: cancellation.operationId },
      }),
    ]);
    expect(await clients[0].journalEntry.count({ where: { tenantId: f.tenantId, sourceType: 'DEPOSIT' } })).toBe(2);
    await core.completePendingRefund(f.tenantId, cancellation.operationId, id('complete-refund', 'disposition'), userId,
      { attachmentUrls: ['/acceptance/partial-refund-proof.pdf'] });
    const refund = await clients[0].depositLedgerEntry.findFirstOrThrow({ where: { tenantId: f.tenantId, depositId: f.depositId, type: 'REFUND' } });
    await (workflow() as any).executeStep('CREATE_JOURNAL_ENTRY', eventPayload(refund));
    await (workflow(clients[1]) as any).executeStep('CREATE_JOURNAL_ENTRY', eventPayload(refund));
    expect(await clients[0].journalEntry.count({ where: { tenantId: f.tenantId, sourceType: 'DEPOSIT' } })).toBe(3);
  }, 20_000);

  it('keeps legacy collection available and exposes consistent finance projections after partial cancellation and expiry', async () => {
    const legacy = await createFixture('legacy-projection', { marker: null, withHold: false, withInvoice: false });
    const legacyCore = new DepositCoreService({ tx: clients[0] } as any);
    await legacyCore.collect(legacy.tenantId, legacy.depositId, { idempotencyKey: id('collect', 'legacy-projection') }, userId);
    const legacySummary = await legacyCore.getRentalCycleFinanceSummary(legacy.tenantId, legacy.cycleId);
    expect(legacySummary.depositLedger.balance).toBe(legacy.amount);
    expect(legacySummary.invoices.total).toBe(0);

    const partial = await createFixture('partial-projection');
    await service().pay(partial.invoiceId, 400_000, 'MANUAL', id('ref', 'partial-projection'), userId, partial.tenantId);
    const partialCore = new DepositCoreService({ tx: clients[0] } as any);
    const beforeCancel = await partialCore.getRentalCycleFinanceSummary(partial.tenantId, partial.cycleId);
    expect(beforeCancel).toMatchObject({ payments: { confirmed: 400_000 }, depositLedger: { balance: 400_000 }, invoices: { outstanding: 600_000 } });
    await partialCore.cancel(partial.tenantId, partial.depositId, {
      idempotencyKey: id('cancel', 'partial-projection'), reason: 'Projection cancellation',
      keepAmount: 100_000, deductAmount: 100_000, refundAmount: 200_000, refundStatus: 'PENDING',
    }, userId);
    const afterCancel = await partialCore.getRentalCycleFinanceSummary(partial.tenantId, partial.cycleId);
    expect(afterCancel).toMatchObject({ depositLedger: { balance: 200_000 }, invoices: { outstanding: 0 } });
    expect(afterCancel.pendingOperations).toHaveLength(1);

    const expiry = await createFixture('expiry-projection');
    const hold = await clients[0].roomHold.findFirstOrThrow({ where: { tenantId: expiry.tenantId, depositId: expiry.depositId } });
    await clients[0].roomHold.update({ where: { id: hold.id }, data: { expiresAt: new Date(Date.now() - 1_000) } });
    await new DepositCoreService({ tx: clients[0] } as any).expireHolds(expiry.tenantId, new Date(), userId);
    const expirySummary = await new DepositCoreService({ tx: clients[0] } as any).getRentalCycleFinanceSummary(expiry.tenantId, expiry.cycleId);
    expect(expirySummary).toMatchObject({ payments: { confirmed: 0 }, depositLedger: { balance: 0 }, invoices: { outstanding: expiry.amount } });
    await expect(clients[0].roomHold.findUniqueOrThrow({ where: { id: hold.id } })).resolves.toMatchObject({ status: 'EXPIRED' });
  }, 20_000);

  it('rejects public adjustments and tampering with private cancellation item type, description, or service period', async () => {
    const f = await createFixture('migration-guards');
    await expect(service().createAdjustment(f.tenantId, f.invoiceId, id('public-adjustment', 'booking'), {
      type: 'CREDIT', reason: 'must not use public adjustment route',
      items: [{ type: 'OTHER', description: 'Public adjustment', quantity: 1, amount: 1_000_000 }],
    }, userId)).rejects.toThrow('INVOICE_ADJUSTMENT_BASE_KIND_INVALID');
    const privateFixture = await createFixture('migration-private-item');
    await clients[0].deposit.update({ where: { id: privateFixture.depositId }, data: { status: 'CANCELLED' } });
    await clients[0].depositOperation.create({ data: {
      tenantId: privateFixture.tenantId, rentalCycleId: privateFixture.cycleId, sourceDepositId: privateFixture.depositId,
      contractId: privateFixture.contractId, type: 'CANCEL', status: 'PENDING',
      idempotencyKey: id('pending-cancel', 'migration-private-item'), requestHash: id('hash', 'migration-private-item'), createdBy: userId,
    } });
    const adjustmentKey = `booking-cancel:${privateFixture.depositId}`;
    const adjustment = await clients[0].invoice.create({ data: {
      tenantId: privateFixture.tenantId, contractId: privateFixture.contractId, rentalCycleId: privateFixture.cycleId,
      customerId: privateFixture.customerId, code: `ADJ-${scope}-PRIVATE-ITEM`, period: 'Cọc giữ phòng', dueDate: new Date(),
      subtotal: privateFixture.amount, discount: 0, total: privateFixture.amount, paidAmount: 0, creditAmount: 0,
      billingKind: 'CREDIT_ADJUSTMENT', adjustmentOfInvoiceId: privateFixture.invoiceId,
      adjustmentReason: 'Private cancellation guard fixture', adjustmentCreatedBy: userId,
      adjustmentIdempotencyKey: adjustmentKey,
      adjustmentRequestHash: createHash('sha256').update(`${privateFixture.tenantId}:${privateFixture.invoiceId}:${privateFixture.depositId}:${privateFixture.amount}`).digest('hex'),
      status: 'DRAFT',
    } });
    for (const data of [
      { type: 'SERVICE' as const },
      { description: 'Tampered private closure' },
      { servicePeriod: 'Tampered period' },
    ]) {
      await expect(clients[0].invoiceItem.create({
        data: {
          tenantId: privateFixture.tenantId, invoiceId: adjustment.id, type: 'OTHER',
          description: 'Internal closure of unpaid booking hold balance', servicePeriod: 'Cọc giữ phòng',
          quantity: 1, unitPrice: privateFixture.amount, amount: privateFixture.amount, ...data,
        },
      })).rejects.toThrow('BOOKING_HOLD_CANCELLATION_ITEM_INVALID');
    }
    expect(await clients[0].invoiceItem.count({ where: { tenantId: privateFixture.tenantId, invoiceId: adjustment.id } })).toBe(0);
  }, 20_000);

  it('requires proof for a completed refund and records exactly one full-funding refund ledger leg', async () => {
    const f = await createFixture('cancel-full');
    await service().pay(f.invoiceId, f.amount, 'MANUAL', id('ref', 'cancel-full'), userId, f.tenantId);
    const core = new DepositCoreService({ tx: clients[0] } as any);
    await expect(core.cancel(f.tenantId, f.depositId, {
      idempotencyKey: id('cancel', 'full-no-proof'), reason: 'Acceptance no proof',
      keepAmount: 0, deductAmount: 0, refundAmount: f.amount, refundStatus: 'COMPLETED',
    }, userId)).rejects.toThrow('DEPOSIT_REFUND_PROOF_REQUIRED');
    const cancellation = await core.cancel(f.tenantId, f.depositId, {
      idempotencyKey: id('cancel', 'full'), reason: 'Acceptance full refund',
      keepAmount: 0, deductAmount: 0, refundAmount: f.amount, refundStatus: 'COMPLETED',
      attachmentUrls: ['/acceptance/full-refund-proof.pdf'],
    }, userId);
    expect(cancellation).toMatchObject({ pending: false, refundStatus: 'COMPLETED', refundAmount: f.amount });
    expect(await clients[0].depositLedgerEntry.count({
      where: { tenantId: f.tenantId, depositId: f.depositId, type: 'REFUND' },
    })).toBe(1);
    expect(await clients[0].depositLedgerEntry.aggregate({
      where: { tenantId: f.tenantId, depositId: f.depositId }, _sum: { balanceEffect: true },
    })).toMatchObject({ _sum: { balanceEffect: expect.anything() } });
    const balance = await clients[0].depositLedgerEntry.aggregate({
      where: { tenantId: f.tenantId, depositId: f.depositId }, _sum: { balanceEffect: true },
    });
    expect(Number(balance._sum.balanceEffect)).toBe(0);
  });
});
