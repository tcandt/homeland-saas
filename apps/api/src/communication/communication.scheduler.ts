import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import { CommunicationService } from './communication.service';
import * as fs from 'fs';
import * as path from 'path';
import { notificationWorkerHeartbeatPath, shouldRunNotificationWorker } from '../shared/config/runtime-mode';

@Injectable()
export class CommunicationScheduler {
  private readonly logger = new Logger(CommunicationScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly communicationService: CommunicationService,
  ) {}

  @Cron('*/5 * * * *')
  async retryFailedQueueItems() {
    if (!shouldRunNotificationWorker()) {
      return {
        checked: 0,
        recovered: 0,
        checkedAt: new Date(),
        skipped: true,
      };
    }

    const now = new Date();
    const staleSendingBefore = new Date(now.getTime() - 10 * 60 * 1000);
    const recovered = await this.prisma.notificationQueue.updateMany({
      where: {
        status: 'SENDING',
        updatedAt: { lte: staleSendingBefore },
      },
      data: {
        status: 'FAILED',
        error: 'Recovered stale SENDING lock',
        nextRetryAt: now,
      },
    });

    const queueItems = await this.prisma.notificationQueue.findMany({
      where: {
        error: { not: 'Cancelled manually' },
        OR: [
          { status: 'QUEUED' },
          {
            status: { in: ['FAILED', 'RETRYING'] as any },
            retryCount: { lt: 3 },
            OR: [
              { nextRetryAt: null },
              { nextRetryAt: { lte: now } },
            ],
          },
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

    const result = {
      checked: queueItems.length,
      recovered: recovered.count,
      checkedAt: now,
    };
    this.writeHeartbeat(result);
    return result;
  }

  private writeHeartbeat(result: { checked: number; recovered: number; checkedAt: Date }) {
    try {
      const heartbeatPath = notificationWorkerHeartbeatPath();
      const directory = path.dirname(heartbeatPath);
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(heartbeatPath, JSON.stringify({
        role: 'notification-worker',
        pid: process.pid,
        checked: result.checked,
        recovered: result.recovered,
        checkedAt: result.checkedAt.toISOString(),
      }, null, 2));
    } catch (error: any) {
      this.logger.warn(`Failed to write notification worker heartbeat: ${error?.message}`);
    }
  }
}
