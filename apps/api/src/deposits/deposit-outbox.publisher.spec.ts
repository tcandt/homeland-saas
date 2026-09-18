import { OutboxEventStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { DepositOutboxPublisher } from './deposit-outbox.publisher';

describe('DepositOutboxPublisher', () => {
  function createHarness() {
    const tx: any = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: 'outbox-1' }]),
      outboxEvent: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
    const prisma: any = {
      $transaction: vi.fn((callback: any) => callback(tx)),
      outboxEvent: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findMany: vi.fn().mockResolvedValue([{
          id: 'outbox-1',
          eventName: 'deposit.collected',
          payload: { tenantId: 'tenant-1', sourceId: 'deposit-1' },
          attempts: 1,
          createdAt: new Date(),
          status: OutboxEventStatus.PROCESSING,
        }]),
        update: vi.fn().mockResolvedValue({}),
      },
    };
    const eventPublisher: any = { publishAsync: vi.fn().mockResolvedValue(undefined) };
    return { tx, prisma, eventPublisher, service: new DepositOutboxPublisher(prisma, eventPublisher) };
  }

  it('claims pending rows and marks them published only after async delivery', async () => {
    const { tx, prisma, eventPublisher, service } = createHarness();

    await expect(service.drain()).resolves.toEqual({ claimed: 1, published: 1, failed: 0 });

    expect(tx.outboxEvent.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: OutboxEventStatus.PROCESSING, attempts: { increment: 1 } }),
    }));
    expect(eventPublisher.publishAsync).toHaveBeenCalledWith('deposit.collected', expect.objectContaining({
      sourceId: 'deposit-1',
      outboxEventId: 'outbox-1',
    }));
    expect(prisma.outboxEvent.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'outbox-1' },
      data: expect.objectContaining({ status: OutboxEventStatus.PUBLISHED }),
    }));
  });

  it('records a bounded error and schedules retry when delivery fails', async () => {
    const { prisma, eventPublisher, service } = createHarness();
    eventPublisher.publishAsync.mockRejectedValue(new Error('provider unavailable'));

    await expect(service.drain()).resolves.toEqual({ claimed: 1, published: 0, failed: 1 });

    expect(prisma.outboxEvent.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'outbox-1' },
      data: expect.objectContaining({
        status: OutboxEventStatus.FAILED,
        lastError: 'provider unavailable',
        availableAt: expect.any(Date),
      }),
    }));
  });

  it('recovers stale processing claims before claiming the next batch', async () => {
    const { prisma, service } = createHarness();

    await service.drain();

    expect(prisma.outboxEvent.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: OutboxEventStatus.PROCESSING,
        updatedAt: { lte: expect.any(Date) },
      }),
      data: expect.objectContaining({
        status: OutboxEventStatus.FAILED,
        lastError: 'Recovered stale processing claim',
      }),
    }));
  });
});
