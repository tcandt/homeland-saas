import { OutboxEventStatus, PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { DepositOutboxPublisher } from './deposit-outbox.publisher';

const rawUrl = process.env.TEST_DATABASE_URL;
const parsed = rawUrl ? new URL(rawUrl) : null;
const enabled = process.env.RUN_PAYMENT_NOTICE_DB_TESTS === '1';
if (enabled && (!parsed || parsed.hostname !== '127.0.0.1'
  || parsed.pathname !== '/homeland_payment_notice_gate_test')) {
  throw new Error('Payment notice outbox gate requires the loopback homeland_payment_notice_gate_test database.');
}

(enabled ? describe : describe.skip)('DepositOutboxPublisher scoped drain - real PostgreSQL 16', () => {
  const url = rawUrl || 'postgresql://placeholder:placeholder@127.0.0.1/homeland_payment_notice_gate_test';
  const clients = [
    new PrismaClient({ datasources: { db: { url } } }),
    new PrismaClient({ datasources: { db: { url } } }),
  ];
  const scope = randomUUID().replaceAll('-', '').slice(0, 14);
  const id = (kind: string) => `${kind}-${scope}`;
  const delivered = vi.fn(async () => undefined);
  const publisher = { publishAsync: delivered } as any;
  const service = (index: number) => new DepositOutboxPublisher(clients[index] as any, publisher);

  async function createTenant(suffix: string) {
    const tenantId = id(`tenant-${suffix}`);
    await clients[0].tenantOrg.create({ data: { id: tenantId, code: `OB-${scope}-${suffix}`, name: `Outbox ${suffix}` } });
    return tenantId;
  }

  async function createEvent(tenantId: string, suffix: string, input: Partial<{ id: string; aggregateId: string; eventName: string; payload: object; status: OutboxEventStatus }> = {}) {
    return clients[0].outboxEvent.create({ data: {
      id: input.id || id(`outbox-${suffix}`),
      tenantId,
      aggregateType: 'Invoice',
      aggregateId: input.aggregateId || id('invoice'),
      eventName: input.eventName || 'invoice.issued',
      payload: input.payload || { tenantId },
      idempotencyKey: id(`key-${suffix}`),
      status: input.status || OutboxEventStatus.PENDING,
    } });
  }

  async function createInvoiceWithUnsentDifferentRequest(tenantId: string) {
    const customerId = id('customer');
    const invoiceId = id('invoice');
    await clients[0].customer.create({ data: {
      id: customerId, tenantId, fullName: 'Gate customer', phone: `09${scope.slice(0, 8)}`,
      phoneNormalized: `09${scope.slice(0, 8)}`,
    } });
    await clients[0].invoice.create({ data: {
      id: invoiceId, tenantId, customerId, code: `OB-${scope}`, dueDate: new Date(),
      subtotal: 1_000_000, discount: 0, total: 1_000_000,
    } });
    await clients[0].paymentRequest.create({ data: {
      tenantId, sourceType: 'INVOICE', sourceId: invoiceId, provider: 'SEPAY',
      paymentCode: `OB-REQ-${scope}`, amount: 1_000_000, bankName: 'Gate Bank',
      bankAccountNumber: '0000000000', qrUrl: 'https://example.test/qr',
      providerTransactionId: id('unrelated-qr'), metadata: {},
    } });
    return invoiceId;
  }

  beforeAll(async () => { await Promise.all(clients.map((client) => client.$connect())); });
  afterAll(async () => {
    const tenantIds = await clients[0].tenantOrg.findMany({ where: { code: { startsWith: `OB-${scope}` } }, select: { id: true } });
    await clients[0].outboxEvent.deleteMany({ where: { tenantId: { in: tenantIds.map((tenant) => tenant.id) } } });
    await clients[0].paymentRequest.deleteMany({ where: { tenantId: { in: tenantIds.map((tenant) => tenant.id) } } });
    await clients[0].invoice.deleteMany({ where: { tenantId: { in: tenantIds.map((tenant) => tenant.id) } } });
    await clients[0].customer.deleteMany({ where: { tenantId: { in: tenantIds.map((tenant) => tenant.id) } } });
    await clients[0].tenantOrg.deleteMany({ where: { id: { in: tenantIds.map((tenant) => tenant.id) } } });
    await Promise.all(clients.map((client) => client.$disconnect()));
  });

  it('claims only the exact scoped event once across concurrent clients', async () => {
    const tenantId = await createTenant('concurrent');
    const target = await createEvent(tenantId, 'concurrent');
    const results = await Promise.all([
      service(0).drain(1, { eventIds: [target.id] }),
      service(1).drain(1, { eventIds: [target.id] }),
    ]);
    expect(results.reduce((total, result) => total + result.published, 0)).toBe(1);
    expect(delivered).toHaveBeenCalledTimes(1);
    expect(await clients[0].outboxEvent.findUniqueOrThrow({ where: { id: target.id } })).toMatchObject({
      status: OutboxEventStatus.PUBLISHED,
      attempts: 1,
    });
  }, 20_000);

  it('does not recover or claim unrelated and foreign rows, enforces issue-before-payment, and does not block cash behind a different unsent QR', async () => {
    const tenantId = await createTenant('scope');
    const foreignTenantId = await createTenant('foreign');
    const invoiceId = await createInvoiceWithUnsentDifferentRequest(tenantId);
    const issue = await createEvent(tenantId, 'issue', { aggregateId: invoiceId, eventName: 'invoice.issued' });
    const payment = await createEvent(tenantId, 'paid', {
      aggregateId: invoiceId,
      eventName: 'invoice.paid',
      payload: { tenantId, paymentRef: id('cash-payment') },
    });
    const stale = await createEvent(tenantId, 'stale', {
      aggregateId: id('unrelated-invoice'),
      status: OutboxEventStatus.PROCESSING,
    });
    await clients[0].outboxEvent.update({ where: { id: stale.id }, data: { updatedAt: new Date(Date.now() - 6 * 60 * 1000) } });
    const foreign = await createEvent(foreignTenantId, 'foreign');

    expect(await service(0).drain(1, { eventIds: [payment.id] })).toMatchObject({ claimed: 0, published: 0 });
    expect(await clients[0].outboxEvent.findUniqueOrThrow({ where: { id: payment.id } })).toMatchObject({ status: OutboxEventStatus.PENDING });

    expect(await service(0).drain(1, { eventIds: [issue.id] })).toMatchObject({ published: 1 });
    expect(await service(0).drain(1, { eventIds: [payment.id] })).toMatchObject({ published: 1 });
    expect(await clients[0].outboxEvent.findUniqueOrThrow({ where: { id: payment.id } })).toMatchObject({ status: OutboxEventStatus.PUBLISHED });
    expect(await clients[0].outboxEvent.findUniqueOrThrow({ where: { id: stale.id } })).toMatchObject({ status: OutboxEventStatus.PROCESSING });
    expect(await clients[0].outboxEvent.findUniqueOrThrow({ where: { id: foreign.id } })).toMatchObject({ status: OutboxEventStatus.PENDING });
  }, 20_000);
});
