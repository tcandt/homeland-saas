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
      },
    };

    communicationService = {
      processQueueItem: vi.fn().mockResolvedValue(undefined),
    };

    scheduler = new CommunicationScheduler(prisma as PrismaService, communicationService as CommunicationService);
  });

  it('retries failed queue items that are due for retry', async () => {
    prisma.notificationQueue.findMany.mockResolvedValueOnce([
      { id: 'queue-1' },
      { id: 'queue-2' },
    ]);

    const result = await scheduler.retryFailedQueueItems();

    expect(result.checked).toBe(2);
    expect(prisma.notificationQueue.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: 'FAILED',
        retryCount: { lt: 3 },
      }),
      take: 50,
    }));
    expect(communicationService.processQueueItem).toHaveBeenNthCalledWith(1, 'queue-1');
    expect(communicationService.processQueueItem).toHaveBeenNthCalledWith(2, 'queue-2');
  });
});
