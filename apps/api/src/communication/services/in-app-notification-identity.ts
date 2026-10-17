import { Prisma } from '@prisma/client';

export const PAYMENT_RECEIVED_NOTIFICATION_TYPE = 'PAYMENT_RECEIVED';
export const IN_APP_NOTIFICATION_CHANNEL = 'IN_APP';

type InAppPaymentNotificationInput = {
  tenantId: string;
  userId: string;
  type: string;
  entityId: string;
  data: Record<string, unknown>;
};

export function resolvePaymentNotificationEntityId(context: unknown): string | null {
  const source = context && typeof context === 'object' ? context as Record<string, unknown> : {};
  const metadata = source.metadata && typeof source.metadata === 'object'
    ? source.metadata as Record<string, unknown>
    : {};
  // Payment is immutable for this event. A generic entityId can instead refer
  // to its invoice or source document, so it is only a compatibility fallback.
  const candidate = source.paymentId ?? metadata.paymentId ?? source.entityId ?? metadata.entityId;
  const entityId = typeof candidate === 'string' ? candidate.trim() : '';
  return entityId || null;
}

export async function findOrCreateInAppNotification(prisma: any, input: InAppPaymentNotificationInput) {
  const lockKey = JSON.stringify([
    input.tenantId,
    input.userId,
    IN_APP_NOTIFICATION_CHANNEL,
    input.type,
    input.entityId,
  ]);

  return prisma.$transaction(async (tx: any) => {
    await tx.$queryRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))::text AS "lock"`,
    );
    const identityWhere = input.type === PAYMENT_RECEIVED_NOTIFICATION_TYPE
      ? {
          OR: [
            { metadata: { path: ['entityId'], equals: input.entityId } },
            { metadata: { path: ['paymentId'], equals: input.entityId } },
          ],
        }
      : { metadata: { path: ['entityId'], equals: input.entityId } };
    const existing = await tx.notification.findFirst({
      where: {
        tenantId: input.tenantId,
        userId: input.userId,
        channel: IN_APP_NOTIFICATION_CHANNEL,
        type: input.type,
        ...identityWhere,
      },
      select: { id: true, tenantId: true, userId: true, channel: true, type: true },
    });
    if (existing) return { notification: existing, created: false };

    const notification = await tx.notification.create({ data: input.data });
    return { notification, created: true };
  }, { isolationLevel: 'ReadCommitted' });
}
