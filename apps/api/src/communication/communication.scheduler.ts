import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import { CommunicationService } from './communication.service';

@Injectable()
export class CommunicationScheduler {
  private readonly logger = new Logger(CommunicationScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly communicationService: CommunicationService,
  ) {}

  @Cron('*/5 * * * *')
  async retryFailedQueueItems() {
    const now = new Date();
    const queueItems = await this.prisma.notificationQueue.findMany({
      where: {
        status: 'FAILED',
        retryCount: { lt: 3 },
        error: { not: 'Cancelled manually' },
        OR: [
          { nextRetryAt: null },
          { nextRetryAt: { lte: now } },
        ],
      },
      orderBy: { updatedAt: 'asc' },
      take: 50,
    });

    for (const item of queueItems) {
      try {
        await this.communicationService.processQueueItem(item.id);
      } catch (error: any) {
        this.logger.error(`Retry failed for queue item ${item.id}: ${error?.message}`);
      }
    }

    return {
      checked: queueItems.length,
      checkedAt: now,
    };
  }
}
