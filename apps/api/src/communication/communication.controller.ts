import { Controller, Get, Patch, Param, Post, Sse, MessageEvent, UseGuards, Req, Delete, Body, ForbiddenException } from '@nestjs/common';
import { CommunicationService } from './communication.service';
import { PrismaService } from '../prisma.service';
import { Observable, interval, timer } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class CommunicationController {
  constructor(
    private readonly communicationService: CommunicationService,
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  @Get()
  async getNotifications(@Req() req) {
    const tenantId = req.user.tenantId;
    const userId = req.user.id;
    return this.prisma.notification.findMany({
      where: { tenantId, userId, channel: 'IN_APP' },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
  }

  @Get('unread-count')
  async getUnreadCount(@Req() req) {
    const tenantId = req.user.tenantId;
    const userId = req.user.id;
    const count = await this.prisma.notification.count({
      where: { tenantId, userId, channel: 'IN_APP', status: { in: ['CREATED', 'QUEUED', 'SENDING', 'SENT', 'DELIVERED'] } }
    });
    return { count };
  }

  @Sse('stream')
  stream(@Req() req): Observable<MessageEvent> {
    const tenantId = req.user.tenantId;
    const userId = req.user.id;
    
    // Fallback/Simulated SSE using rxjs timer to emit immediately then every 5s
    return timer(0, 5000).pipe(
      switchMap(async () => {
        const count = await this.prisma.notification.count({
          where: { tenantId, userId, channel: 'IN_APP', status: { in: ['CREATED', 'QUEUED', 'SENDING', 'SENT', 'DELIVERED'] } }
        });
        return { data: { count } } as MessageEvent;
      })
    );
  }

  @Patch('read-all')
  async markAllAsRead(@Req() req) {
    const tenantId = req.user.tenantId;
    const userId = req.user.id;
    await this.prisma.notification.updateMany({
      where: { tenantId, userId, channel: 'IN_APP', status: { not: 'READ' } },
      data: { status: 'READ', readAt: new Date() }
    });
    return { success: true };
  }

  @Patch(':id/read')
  async markAsRead(@Req() req, @Param('id') id: string) {
    const tenantId = req.user.tenantId;
    await this.prisma.notification.update({
      where: { id, tenantId },
      data: { status: 'READ', readAt: new Date() }
    });
    return { success: true };
  }

  @Delete(':id')
  async deleteNotification(@Req() req, @Param('id') id: string) {
    const tenantId = req.user.tenantId;
    await this.prisma.notification.delete({ where: { id, tenantId } });
    return { success: true };
  }

  @Get('queue')
  async getQueue(@Req() req) {
    const tenantId = req.user.tenantId;
    return this.prisma.notificationQueue.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
  }

  @Throttle({ short: { limit: 10, ttl: 60000 } })
  @Post('queue/:id/retry')
  async retryQueue(@Req() req, @Param('id') id: string) {
    const tenantId = req.user.tenantId;
    await this.prisma.notificationQueue.update({
      where: { id, tenantId },
      data: { status: 'QUEUED', error: null, nextRetryAt: null }
    });
    await this.communicationService.processQueueItem(id);
    return { success: true };
  }

  @Post('queue/:id/cancel')
  async cancelQueue(@Req() req, @Param('id') id: string) {
    const tenantId = req.user.tenantId;
    await this.prisma.notificationQueue.update({
      where: { id, tenantId },
      data: { status: 'FAILED', error: 'Cancelled manually' }
    });
    return { success: true };
  }

  @Post('test-utils/queue/failed')
  async createFailedQueueItem(@Req() req) {
    if (process.env.ENABLE_E2E_TEST_UTILS !== 'true' && process.env.NODE_ENV !== 'test') {
      throw new ForbiddenException('Not available outside test environment');
    }
    const tenantId = req.user.tenantId;
    
    // 1. Create a notification
    const notification = await this.prisma.notification.create({
      data: {
        tenantId,
        userId: req.user.id,
        title: 'Test Failed Notification',
        message: 'This is a test notification that is meant to fail',
        type: 'TEST_FAIL',
        status: 'FAILED',
        metadata: {}
      }
    });

    // 2. Create a failed queue item
    const queueItem = await this.prisma.notificationQueue.create({
      data: {
        tenantId,
        notificationId: notification.id,
        channel: 'EMAIL', // Assuming EMAIL can fail
        payload: { title: 'Test Failed Notification', message: 'This is a test notification that is meant to fail', testMode: 'FAIL_PROVIDER' },
        status: 'FAILED',
        error: 'Simulated failure for E2E testing'
      }
    });

    return queueItem;
  }

  @Get('templates')
  async getTemplates(@Req() req) {
    return this.prisma.notificationTemplate.findMany({
      where: { tenantId: req.user.tenantId }
    });
  }

  @Get('preferences')
  async getPreferences(@Req() req) {
    return this.prisma.notificationPreference.findMany({
      where: { tenantId: req.user.tenantId, userId: req.user.id }
    });
  }
}
