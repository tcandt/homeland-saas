import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CommunicationController } from './communication.controller';
import { CommunicationService } from './communication.service';

const enabled = process.env.RUN_IN_APP_NOTIFICATION_DB_TESTS === '1';
const rawUrl = process.env.TEST_DATABASE_URL;
const parsed = rawUrl ? new URL(rawUrl) : null;
if (enabled && (!parsed || parsed.hostname !== '127.0.0.1'
  || !/^\/(?:homeland_booking_(?:cash_20261017|invoice)_test|homeland_payment_notice_gate_test)$/i.test(parsed.pathname))) {
  throw new Error('In-app notification gate requires a dedicated local or CI test database.');
}

// Keep all queues durable but local: these integration tests never invoke an
// external provider or immediate delivery worker.
const initialImmediateDelivery = process.env.COMMUNICATION_IMMEDIATE_DELIVERY;

(enabled ? describe : describe.skip)('in-app payment notification identity — real PostgreSQL 16', () => {
  const url = rawUrl || 'postgresql://placeholder:placeholder@127.0.0.1/homeland_booking_cash_20261017_test';
  const clients = [new PrismaClient({ datasources: { db: { url } } }), new PrismaClient({ datasources: { db: { url } } })];
  const scope = randomUUID().replaceAll('-', '').slice(0, 14);
  const id = (kind: string, suffix: string) => `in-app-${scope}-${kind}-${suffix}`;

  type Fixture = Awaited<ReturnType<typeof fixture>>;
  async function fixture(suffix: string, overrides: { tenantId?: string; userId?: string; paymentId?: string } = {}) {
    const tenantId = overrides.tenantId || id('tenant', suffix);
    const userId = overrides.userId || id('user', suffix);
    const paymentId = overrides.paymentId || id('payment', suffix);
    await clients[0].tenantOrg.create({ data: { id: tenantId, code: `IA-${scope}-${suffix}`, name: `In app ${suffix}` } });
    await clients[0].notificationTemplate.create({ data: {
      tenantId, code: 'PAYMENT_RECEIVED', name: 'Payment received', subject: '{{title}}', body: '{{message}}', publishedVersion: 1,
    } });
    return { tenantId, userId, paymentId };
  }

  const controller = (client: any) => new CommunicationController(
    {} as any,
    client,
    { emit: () => undefined } as any,
    {} as any, {} as any, {} as any, {} as any,
  );
  const workflow = (client: any) => new CommunicationService(client, { emit: () => undefined } as any);
  const operational = (f: Fixture, type = 'PAYMENT_RECEIVED', entityId = f.paymentId) => ({
    tenantId: f.tenantId, userId: f.userId, type, entityId,
    title: `Received ${entityId}`, message: `Recorded ${entityId}`,
    metadata: { entityId, paymentId: entityId, amount: 1_000_000 },
  });
  const dispatch = (f: Fixture, context: Record<string, unknown> = {}) => {
    const { idempotencyKey, ...templateContext } = context;
    return workflow(clients[1]).dispatch({
      tenantId: f.tenantId, userId: f.userId, channel: 'IN_APP', templateCode: 'PAYMENT_RECEIVED',
      ...(idempotencyKey ? { idempotencyKey: String(idempotencyKey) } : {}),
      context: { title: 'Payment received', message: 'Payment recorded', paymentId: f.paymentId, ...templateContext },
    });
  };
  const masters = (f: Fixture, type = 'PAYMENT_RECEIVED') => clients[0].notification.findMany({
    where: { tenantId: f.tenantId, userId: f.userId, channel: 'IN_APP', type }, orderBy: { createdAt: 'asc' },
  });
  const queues = (f: Fixture) => clients[0].notificationQueue.count({ where: { tenantId: f.tenantId, channel: 'IN_APP' } });
  const synthesize = (client: any, f: Fixture, type = 'PAYMENT_RECEIVED', entityId = f.paymentId) =>
    (controller(client) as any).createOperationalNotification(operational(f, type, entityId), new Set<string>());

  beforeAll(async () => {
    process.env.COMMUNICATION_IMMEDIATE_DELIVERY = 'false';
    await Promise.all(clients.map((client) => client.$connect()));
  });
  afterAll(async () => {
    if (initialImmediateDelivery === undefined) delete process.env.COMMUNICATION_IMMEDIATE_DELIVERY;
    else process.env.COMMUNICATION_IMMEDIATE_DELIVERY = initialImmediateDelivery;
    await Promise.all(clients.map((client) => client.$disconnect()));
  });

  it('serializes simultaneous controller synthesis and workflow dispatch into one master and at most one in-app queue', async () => {
    const f = await fixture('simultaneous');
    await Promise.all([synthesize(clients[0], f), dispatch(f)]);
    expect(await masters(f)).toHaveLength(1);
    expect(await queues(f)).toBeLessThanOrEqual(1);
  }, 20_000);

  it('reuses a workflow-first payment master when the controller later synthesizes it', async () => {
    const f = await fixture('workflow-first');
    const result = await dispatch(f);
    await synthesize(clients[0], f);
    expect((await masters(f)).map((row) => row.id)).toEqual([result!.notificationId]);
    expect(await queues(f)).toBe(1);
  });

  it('reuses a controller-first payment master when the workflow dispatches later', async () => {
    const f = await fixture('controller-first');
    await synthesize(clients[0], f);
    const first = (await masters(f))[0];
    const result = await dispatch(f);
    expect(result).toEqual({ notificationId: first.id, queueIds: [] });
    expect(await masters(f)).toHaveLength(1);
    expect(await queues(f)).toBe(0);
  });

  it('reuses an older-than-45-days legacy metadata.paymentId record', async () => {
    const f = await fixture('legacy');
    const legacy = await clients[0].notification.create({ data: {
      tenantId: f.tenantId, userId: f.userId, channel: 'IN_APP', type: 'PAYMENT_RECEIVED',
      title: 'Legacy payment', message: 'Legacy', status: 'CREATED', metadata: { paymentId: f.paymentId },
      createdAt: new Date(Date.now() - 46 * 24 * 60 * 60 * 1000),
    } });
    const result = await dispatch(f);
    expect(result).toEqual({ notificationId: legacy.id, queueIds: [] });
    expect(await masters(f)).toHaveLength(1);
    expect(await queues(f)).toBe(0);
  });

  it('creates two independent masters for equal amounts with different payment IDs', async () => {
    const f = await fixture('different-payment');
    const otherPaymentId = id('payment', 'different-payment-other');
    await dispatch(f, { amount: 1_000_000 });
    await dispatch(f, { paymentId: otherPaymentId, amount: 1_000_000 });
    const rows = await masters(f);
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => (row.metadata as any).entityId).sort()).toEqual([f.paymentId, otherPaymentId].sort());
  });

  it('keeps tenant, user, and notification type identities independent', async () => {
    const tenantOne = await fixture('identity-one');
    const tenantTwo = await fixture('identity-two', { paymentId: tenantOne.paymentId });
    const otherUser = id('user', 'identity-other');
    await synthesize(clients[0], tenantOne);
    await synthesize(clients[0], tenantTwo);
    await synthesize(clients[0], { ...tenantOne, userId: otherUser });
    await synthesize(clients[0], tenantOne, 'OPERATIONAL_ISSUE');
    expect(await masters(tenantOne)).toHaveLength(1);
    expect(await masters(tenantTwo)).toHaveLength(1);
    expect(await clients[0].notification.count({ where: { tenantId: tenantOne.tenantId, userId: otherUser, type: 'PAYMENT_RECEIVED' } })).toBe(1);
    expect(await clients[0].notification.count({ where: { tenantId: tenantOne.tenantId, userId: tenantOne.userId, type: 'OPERATIONAL_ISSUE' } })).toBe(1);
  });

  it('rolls back a notification create fault completely, then creates exactly one on retry', async () => {
    const f = await fixture('rollback');
    const real = clients[0];
    const faultingPrisma = new Proxy(real as any, {
      get(target, property, receiver) {
        if (property !== '$transaction') return Reflect.get(target, property, receiver);
        return async (callback: any, options: any) => target.$transaction(async (tx: any) => callback(new Proxy(tx, {
          get(transactionTarget, transactionProperty, transactionReceiver) {
            if (transactionProperty !== 'notification') return Reflect.get(transactionTarget, transactionProperty, transactionReceiver);
            return new Proxy(transactionTarget.notification, {
              get(notificationTarget, notificationProperty, notificationReceiver) {
                if (notificationProperty !== 'create') return Reflect.get(notificationTarget, notificationProperty, notificationReceiver);
                return async (...args: any[]) => {
                  await notificationTarget.create(...args);
                  throw new Error('TEST_FORCED_NOTIFICATION_CREATE_FAILURE');
                };
              },
            });
          },
        })), options);
      },
    });
    await expect(synthesize(faultingPrisma, f)).rejects.toThrow('TEST_FORCED_NOTIFICATION_CREATE_FAILURE');
    expect(await masters(f)).toHaveLength(0);
    await synthesize(clients[0], f);
    expect(await masters(f)).toHaveLength(1);
  });

  it('prefers paymentId over a generic entityId and lets controller synthesis reuse that canonical identity', async () => {
    const f = await fixture('payment-preferred');
    const result = await dispatch(f, { entityId: id('invoice', 'payment-preferred'), paymentId: f.paymentId });
    const row = (await masters(f))[0];
    expect((row.metadata as any).entityId).toBe(f.paymentId);
    await synthesize(clients[0], f);
    expect((await masters(f)).map((item) => item.id)).toEqual([result!.notificationId]);
    expect(await queues(f)).toBe(1);
  });

  it('serializes two clients using the same dispatch fingerprint into one notification and one queue', async () => {
    const f = await fixture('same-fingerprint');
    const key = id('fingerprint', 'same');
    const [first, second] = await Promise.all([
      dispatch(f, { idempotencyKey: key }),
      workflow(clients[0]).dispatch({
        tenantId: f.tenantId, userId: f.userId, channel: 'IN_APP', templateCode: 'PAYMENT_RECEIVED',
        idempotencyKey: key,
        context: { title: 'Payment received', message: 'Payment recorded', paymentId: f.paymentId },
      }),
    ]);
    expect(first!.notificationId).toBe(second!.notificationId);
    expect(await masters(f)).toHaveLength(1);
    expect(await queues(f)).toBe(1);
  }, 20_000);

  it('reuses a failed queue for the same dispatch fingerprint without creating a duplicate queue', async () => {
    const f = await fixture('failed-reuse');
    const key = id('fingerprint', 'failed');
    const initial = await workflow(clients[0]).dispatch({
      tenantId: f.tenantId, userId: f.userId, channel: 'IN_APP', templateCode: 'PAYMENT_RECEIVED',
      idempotencyKey: key,
      context: { title: 'Payment received', message: 'Payment recorded', paymentId: f.paymentId },
    });
    await clients[0].notificationQueue.update({ where: { id: initial!.queueIds[0] }, data: { status: 'FAILED', error: 'forced gate failure' } });
    const retried = await workflow(clients[1]).dispatch({
      tenantId: f.tenantId, userId: f.userId, channel: 'IN_APP', templateCode: 'PAYMENT_RECEIVED',
      idempotencyKey: key,
      context: { title: 'Payment received', message: 'Payment recorded', paymentId: f.paymentId },
    });
    expect(retried).toEqual({ notificationId: initial!.notificationId, queueIds: initial!.queueIds });
    expect(await queues(f)).toBe(1);
  });

  it('keeps the same dispatch fingerprint isolated by tenant', async () => {
    const one = await fixture('fingerprint-tenant-one');
    const two = await fixture('fingerprint-tenant-two');
    const key = id('fingerprint', 'tenant');
    await Promise.all([workflow(clients[0]).dispatch({
      tenantId: one.tenantId, userId: one.userId, channel: 'IN_APP', templateCode: 'PAYMENT_RECEIVED', idempotencyKey: key,
      context: { title: 'Payment received', message: 'Payment recorded', paymentId: one.paymentId },
    }), workflow(clients[1]).dispatch({
      tenantId: two.tenantId, userId: two.userId, channel: 'IN_APP', templateCode: 'PAYMENT_RECEIVED', idempotencyKey: key,
      context: { title: 'Payment received', message: 'Payment recorded', paymentId: two.paymentId },
    })]);
    expect(await masters(one)).toHaveLength(1);
    expect(await masters(two)).toHaveLength(1);
    expect(await queues(one)).toBe(1);
    expect(await queues(two)).toBe(1);
  }, 20_000);
});
