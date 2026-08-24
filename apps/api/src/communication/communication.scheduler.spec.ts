import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommunicationScheduler } from './communication.scheduler';
import { PrismaService } from '../prisma.service';
import { CommunicationService } from './communication.service';

describe('CommunicationScheduler', () => {
  let scheduler: CommunicationScheduler;
  let prisma: any;
  let communicationService: any;

  beforeEach(() => {
    prisma = {
      notificationQueue: {
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };

    communicationService = {
      processQueueItem: vi.fn().mockResolvedValue(undefined),
    };

    scheduler = new CommunicationScheduler(prisma as PrismaService, communicationService as CommunicationService);
  });

  it('processes queued and failed queue items that are due for delivery', async () => {
    prisma.notificationQueue.findMany.mockResolvedValueOnce([
      { id: 'queue-1' },
      { id: 'queue-2' },
    ]);

    const result = await scheduler.retryFailedQueueItems();

    expect(result.checked).toBe(2);
    expect(result.recovered).toBe(0);
    expect(prisma.notificationQueue.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: 'SENDING' }),
      data: expect.objectContaining({ status: 'FAILED' }),
    }));
    expect(prisma.notificationQueue.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: expect.arrayContaining([
          { status: 'QUEUED' },
          expect.objectContaining({
            status: { in: ['FAILED', 'RETRYING'] },
            retryCount: { lt: 3 },
          }),
        ]),
      }),
      take: 50,
    }));
    expect(communicationService.processQueueItem).toHaveBeenNthCalledWith(1, 'queue-1');
    expect(communicationService.processQueueItem).toHaveBeenNthCalledWith(2, 'queue-2');
  });

  it('reports stale SENDING queue recovery count', async () => {
    prisma.notificationQueue.updateMany.mockResolvedValueOnce({ count: 3 });

    const result = await scheduler.retryFailedQueueItems();

    expect(result.recovered).toBe(3);
  });
});
