import { Controller, Get, Patch, Param, Post, Sse, MessageEvent, UseGuards, Req, Delete, Body, ForbiddenException, BadRequestException, Headers, Logger, Query } from '@nestjs/common';
import { CommunicationService } from './communication.service';
import { PrismaService } from '../prisma.service';
import { Observable, interval, timer } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { EmailProvider, TelegramProvider, ZaloProvider } from './providers/communication.providers';
import { Public } from '../shared/decorators/public.decorator';
import { timingSafeEqual } from 'crypto';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class CommunicationController {
  private readonly logger = new Logger(CommunicationController.name);

  constructor(
    private readonly communicationService: CommunicationService,
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly zaloProvider: ZaloProvider,
    private readonly emailProvider: EmailProvider,
    private readonly telegramProvider: TelegramProvider,
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
  async getQueue(@Req() req, @Query() query: any) {
    return this.communicationService.getQueueAdmin(req.user.tenantId, query);
  }

  @Throttle({ short: { limit: 10, ttl: 60000 } })
  @Post('queue/:id/retry')
  async retryQueue(@Req() req, @Param('id') id: string) {
    return this.communicationService.retryQueueItem(req.user.tenantId, id);
  }

  @Post('queue/:id/cancel')
  async cancelQueue(@Req() req, @Param('id') id: string) {
    return this.communicationService.cancelQueueItem(req.user.tenantId, id);
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

  @Public()
  @Post('zalo/webhook')
  @ApiOperation({ summary: 'Receive webhook events from Zalo Bot' })
  async handleZaloWebhook(
    @Body() body: any,
    @Headers('x-bot-api-secret-token') secretTokenHeader?: string,
    @Headers('x-secret-token') legacySecretTokenHeader?: string,
    @Headers('secret-token') rawSecretTokenHeader?: string,
  ) {
    const settings = await this.prisma.appSetting.findMany({
      where: { key: 'zalo-provider', scope: 'TENANT' as any },
      select: { id: true, tenantId: true, value: true },
    });

    const providedSecret = String(secretTokenHeader || legacySecretTokenHeader || rawSecretTokenHeader || '').trim();
    const matched = settings.find((setting) => {
      const expected = String((setting.value as any)?.webhookSecret || '').trim();
      if (!expected || !providedSecret || expected.length !== providedSecret.length) return false;
      return timingSafeEqual(Buffer.from(expected), Buffer.from(providedSecret));
    });

    if (!matched) {
      throw new BadRequestException('ZALO_WEBHOOK_SECRET_INVALID');
    }

    this.logger.log({
      message: 'Accepted Zalo webhook',
      tenantId: matched.tenantId,
      eventName: body?.event_name || body?.eventName || body?.event || null,
      appId: body?.app_id || body?.appId || null,
      timestamp: body?.timestamp || null,
    });

    const capturedChat = extractZaloWebhookChat(body);
    if (capturedChat) {
      await this.prisma.appSetting.update({
        where: { id: matched.id },
        data: {
          value: mergeRecentZaloWebhookChat(matched.value, capturedChat),
        },
      });
    }

    return { success: true, capturedChat: Boolean(capturedChat) };
  }

  @Throttle({ short: { limit: 5, ttl: 60000 } })
  @Post('zalo/test')
  @ApiOperation({ summary: 'Send a test Zalo message with the currently saved tenant settings' })
  async sendZaloTest(
    @Req() req,
    @Body() body: { recipient?: string; title?: string; message?: string },
  ) {
    const recipient = String(body?.recipient || '').trim();
    if (!recipient) {
      throw new BadRequestException('ZALO_TEST_RECIPIENT_REQUIRED');
    }

    const title = String(body?.title || '').trim() || 'Zalo test';
    const message = String(body?.message || '').trim() || `Test message from HomeLand at ${new Date().toISOString()}`;
    const result = await this.zaloProvider.send({
      tenantId: req.user.tenantId,
      recipient,
      title,
      message,
      context: {},
    });

    return {
      success: true,
      recipient,
      result,
    };
  }

  @Throttle({ short: { limit: 5, ttl: 60000 } })
  @Post('email/test')
  @ApiOperation({ summary: 'Send a test email with the currently saved tenant settings' })
  async sendEmailTest(
    @Req() req,
    @Body() body: { recipient?: string; title?: string; message?: string },
  ) {
    const recipient = String(body?.recipient || '').trim();
    if (!recipient) {
      throw new BadRequestException('EMAIL_TEST_RECIPIENT_REQUIRED');
    }

    const title = String(body?.title || '').trim() || 'HomeLand email test';
    const message = String(body?.message || '').trim() || `Test email from HomeLand at ${new Date().toISOString()}`;
    const result = await this.emailProvider.send({
      tenantId: req.user.tenantId,
      recipient,
      title,
      message,
      context: {},
    });

    return {
      success: true,
      recipient,
      result,
    };
  }

  @Throttle({ short: { limit: 5, ttl: 60000 } })
  @Post('telegram/test')
  @ApiOperation({ summary: 'Send a test Telegram message with the currently saved tenant settings' })
  async sendTelegramTest(
    @Req() req,
    @Body() body: { recipient?: string; title?: string; message?: string },
  ) {
    const recipient = String(body?.recipient || '').trim();
    const title = String(body?.title || '').trim() || 'HomeLand Telegram test';
    const message = String(body?.message || '').trim() || `Test Telegram message from HomeLand at ${new Date().toISOString()}`;
    const result = await this.telegramProvider.send({
      tenantId: req.user.tenantId,
      recipient: recipient || null,
      title,
      message,
      context: {},
    });

    return {
      success: true,
      recipient: recipient || null,
      result,
    };
  }
}

type ZaloWebhookChat = {
  chatId: string;
  userId?: string | null;
  displayName?: string | null;
  eventName?: string | null;
  lastSeenAt: string;
};

function extractZaloWebhookChat(body: any): ZaloWebhookChat | null {
  const chatId = firstStringValue(body, [
    'chat_id',
    'chatId',
    'conversation_id',
    'conversationId',
    'thread_id',
    'threadId',
    'message.chat.id',
    'message.chat_id',
    'event.chat_id',
    'event.chat.id',
    'recipient.chat_id',
  ]);
  const userId = firstStringValue(body, [
    'user_id',
    'userId',
    'sender.id',
    'sender.user_id',
    'message.from.id',
    'from.id',
    'event.user_id',
  ]);
  const resolvedChatId = chatId || userId;

  if (!resolvedChatId) return null;

  return {
    chatId: resolvedChatId,
    userId: userId || null,
    displayName: firstStringValue(body, [
      'sender.name',
      'sender.display_name',
      'message.from.name',
      'from.name',
      'user.name',
    ]) || null,
    eventName: firstStringValue(body, ['event_name', 'eventName', 'event', 'type']) || null,
    lastSeenAt: new Date().toISOString(),
  };
}

function mergeRecentZaloWebhookChat(value: any, capturedChat: ZaloWebhookChat) {
  const existing = value && typeof value === 'object' && !Array.isArray(value)
    ? { ...value }
    : {};
  const currentList = Array.isArray(existing.recentWebhookChats) ? existing.recentWebhookChats : [];
  const withoutDuplicate = currentList.filter((item: any) => String(item?.chatId || '') !== capturedChat.chatId);

  return {
    ...existing,
    defaultChatId: existing.defaultChatId || capturedChat.chatId,
    recentWebhookChats: [capturedChat, ...withoutDuplicate].slice(0, 10),
  };
}

function firstStringValue(source: any, paths: string[]) {
  for (const path of paths) {
    const value = getPath(source, path);
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
}

function getPath(source: any, path: string) {
  return path.split('.').reduce((current, key) => {
    if (!current || typeof current !== 'object') return undefined;
    return current[key];
  }, source);
}
