import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { OutboxEventStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { DomainEventInterface } from '../shared/events/domain-event.interface';
import { DomainEventPublisher } from '../shared/events/domain-event.publisher';

@Injectable()
export class DepositOutboxPublisher {
  private readonly logger = new Logger(DepositOutboxPublisher.name);
  private draining = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: DomainEventPublisher,
  ) {}

  @Interval(5_000)
  async scheduledDrain() {
    if (process.env.DISABLE_DEPOSIT_OUTBOX === 'true' || this.draining) return;
    this.draining = true;
    try {
      await this.drain();
    } finally {
      this.draining = false;
    }
  }

  async drain(limit = 50) {
    const batchSize = Math.min(Math.max(Number(limit) || 1, 1), 100);
    const staleBefore = new Date(Date.now() - 5 * 60 * 1_000);
    await this.prisma.outboxEvent.updateMany({
      where: {
        status: OutboxEventStatus.PROCESSING,
        updatedAt: { lte: staleBefore },
      },
      data: {
        status: OutboxEventStatus.FAILED,
        availableAt: new Date(),
        lastError: 'Recovered stale processing claim',
      },
    });

    const claimedIds = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT "id"
        FROM "OutboxEvent"
        WHERE "status" IN ('PENDING', 'FAILED')
          AND "availableAt" <= NOW()
          AND "attempts" < 10
        ORDER BY "createdAt" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${batchSize}
      `);
      const ids = rows.map((row) => row.id);
      if (ids.length > 0) {
        await tx.outboxEvent.updateMany({
          where: { id: { in: ids }, status: { in: [OutboxEventStatus.PENDING, OutboxEventStatus.FAILED] } },
          data: { status: OutboxEventStatus.PROCESSING, attempts: { increment: 1 }, lastError: null },
        });
      }
      return ids;
    });
    if (claimedIds.length === 0) return { claimed: 0, published: 0, failed: 0 };

    const events = await this.prisma.outboxEvent.findMany({
      where: { id: { in: claimedIds }, status: OutboxEventStatus.PROCESSING },
      orderBy: { createdAt: 'asc' },
    });
    let published = 0;
    let failed = 0;
    for (const event of events) {
      try {
        const payload = {
          ...(event.payload as unknown as DomainEventInterface),
          outboxEventId: event.id,
          outboxDelivery: true,
        };
        await this.publisher.publishAsync(event.eventName, payload);
        await this.prisma.outboxEvent.update({
          where: { id: event.id },
          data: { status: OutboxEventStatus.PUBLISHED, publishedAt: new Date(), lastError: null },
        });
        published += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message.slice(0, 500) : 'Unknown outbox publish error';
        const retryDelaySeconds = Math.min(2 ** Math.min(event.attempts, 8), 300);
        await this.prisma.outboxEvent.update({
          where: { id: event.id },
          data: {
            status: OutboxEventStatus.FAILED,
            lastError: message,
            availableAt: new Date(Date.now() + retryDelaySeconds * 1_000),
          },
        });
        failed += 1;
        this.logger.warn(`Deposit outbox event ${event.id} failed; retry scheduled`);
      }
    }
    return { claimed: claimedIds.length, published, failed };
  }
}
