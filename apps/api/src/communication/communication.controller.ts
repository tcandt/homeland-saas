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
import { randomBytes, timingSafeEqual } from 'crypto';
import { buildTenantWebhookUrl, extractZaloWebhookChat, mergeRecentZaloWebhookChat, normalizeZaloUpdate } from './adapters/zalo-normalizer';
import { ZaloRegistrationService } from './services/zalo-registration.service';
import {
  buildAdminGroupConnectedMessage,
  buildAdminGroupTestMessage,
  buildServerOverloadAlertMessage,
  buildUpdateAvailableMessage,
} from './services/admin-zalo-message-builder';

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
    private readonly zaloRegistrationService: ZaloRegistrationService,
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
    @Req() request: any,
    @Body() body: any,
    @Headers('x-bot-api-secret-token') secretTokenHeader?: string,
    @Headers('x-secret-token') legacySecretTokenHeader?: string,
    @Headers('secret-token') rawSecretTokenHeader?: string,
    @Headers('content-type') contentTypeHeader?: string,
    @Headers('user-agent') userAgentHeader?: string,
  ) {
    const settings = await this.prisma.appSetting.findMany({
      where: { key: 'zalo-provider', scope: 'TENANT' as any },
      select: { id: true, tenantId: true, value: true },
    });

    const providedSecret = String(secretTokenHeader || legacySecretTokenHeader || rawSecretTokenHeader || '').trim();
    const provisionalNormalized = normalizeZaloUpdate(body);
    const rejectedPreview = buildWebhookPreview(body, provisionalNormalized, {
      contentType: contentTypeHeader,
      userAgent: userAgentHeader,
      rawBodyLength: String(request?.rawBody || '').length,
      secretProvided: Boolean(providedSecret),
    });
    const matched = settings.find((setting) => {
      const expected = String((setting.value as any)?.webhookSecret || '').trim();
      if (!expected || !providedSecret || expected.length !== providedSecret.length) return false;
      return timingSafeEqual(Buffer.from(expected), Buffer.from(providedSecret));
    });

    if (!matched) {
      if (settings.length === 1) {
        const only = settings[0];
        const onlyValue = ((only?.value as any) || {});
        await this.prisma.appSetting.update({
          where: { id: only.id },
          data: {
            value: {
              ...onlyValue,
              lastWebhookReceivedAt: new Date().toISOString(),
              lastWebhookEventName: provisionalNormalized.eventName || null,
              lastWebhookChatId: provisionalNormalized.chatId || null,
              lastWebhookChatType: provisionalNormalized.chatType || 'unknown',
              lastWebhookSenderId: provisionalNormalized.senderId || null,
              lastWebhookRejectedReason: 'SECRET_INVALID_OR_MISSING',
              lastWebhookPreview: rejectedPreview,
            },
          },
        });
      }
      this.logger.warn({
        message: 'Rejected Zalo webhook due to invalid secret',
        providedSecretLength: providedSecret.length,
        eventName: provisionalNormalized.eventName,
        payloadKeys: summarizePayloadKeys(body),
        contentType: contentTypeHeader || null,
        rawBodyLength: String(request?.rawBody || '').length,
      });
      throw new BadRequestException('ZALO_WEBHOOK_SECRET_INVALID');
    }

    const normalized = provisionalNormalized;
    const capturedChat = extractZaloWebhookChat(body);
    const lastWebhookRejectedReason = normalized.chatId ? null : 'CHAT_ID_NOT_FOUND';
    const nextValue = {
      ...((matched.value as any) || {}),
      lastWebhookReceivedAt: new Date().toISOString(),
      lastWebhookEventName: normalized.eventName || null,
      lastWebhookChatId: normalized.chatId || null,
      lastWebhookChatType: normalized.chatType || 'unknown',
      lastWebhookSenderId: normalized.senderId || null,
      lastWebhookRejectedReason,
      lastWebhookPreview: buildWebhookPreview(body, normalized, {
        contentType: contentTypeHeader,
        userAgent: userAgentHeader,
        rawBodyLength: String(request?.rawBody || '').length,
        secretProvided: Boolean(providedSecret),
      }),
    };
    const mergedValue = capturedChat ? mergeRecentZaloWebhookChat(nextValue, capturedChat) : nextValue;

    this.logger.log({
      message: 'Accepted Zalo webhook',
      tenantId: matched.tenantId,
      eventName: normalized.eventName,
      chatId: normalized.chatId,
      chatType: normalized.chatType,
      senderId: normalized.senderId,
      appId: body?.app_id || body?.appId || null,
      timestamp: body?.timestamp || null,
      payloadKeys: summarizePayloadKeys(body),
      rejectedReason: lastWebhookRejectedReason,
    });

    await this.prisma.appSetting.update({
      where: { id: matched.id },
      data: {
        value: mergedValue,
      },
    });

    try {
      await this.zaloRegistrationService.handleIncomingMessage(
        matched.tenantId,
        normalized,
        mergedValue,
      );
    } catch (error: any) {
      this.logger.error(
        `Zalo webhook business handling failed for tenant ${matched.tenantId}: ${String(error?.message || error)}`,
        error?.stack,
      );
    }

    return { success: true, capturedChat: Boolean(capturedChat) };
  }

  @Public()
  @Get('zalo/webhook/health')
  @ApiOperation({ summary: 'Public health endpoint for Zalo webhook routing' })
  getZaloWebhookHealth() {
    return {
      service: 'zalo-webhook',
      status: 'OK',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('zalo/status')
  @ApiOperation({ summary: 'Get current Zalo integration status for the tenant' })
  async getZaloStatus(@Req() req) {
    const tenantId = req.user.tenantId;
    const setting = await this.prisma.appSetting.findUnique({
      where: {
        tenantId_scope_ownerId_key: {
          tenantId,
          scope: 'TENANT' as any,
          ownerId: tenantId,
          key: 'zalo-provider',
        },
      },
    });
    const value = (setting?.value as any) || {};
    const webhookUrl = buildTenantWebhookUrl(value);
    const recentWebhookChats = Array.isArray(value.recentWebhookChats) ? value.recentWebhookChats : [];
    return {
      success: true,
      status: {
        enabled: value.enabled !== false,
        webhookUrl,
        botTokenConfigured: Boolean(value.botToken),
        webhookSecretConfigured: Boolean(value.webhookSecret),
        adminGroupChatIdConfigured: Boolean(value.adminGroupChatId),
        adminGroupConnectedAt: value.adminGroupConnectedAt || null,
        adminSetupCodePending: Boolean(value.adminSetupCode && value.adminSetupCodeExpiresAt),
        adminSetupCodeExpiresAt: value.adminSetupCodeExpiresAt || null,
        lastWebhookConnectedAt: value.lastWebhookConnectedAt || null,
        lastWebhookStatus: value.lastWebhookStatus || null,
        lastWebhookReceivedAt: value.lastWebhookReceivedAt || null,
        lastWebhookEventName: value.lastWebhookEventName || null,
        lastWebhookChatId: value.lastWebhookChatId || null,
        lastWebhookChatType: value.lastWebhookChatType || null,
        lastWebhookSenderId: value.lastWebhookSenderId || null,
        lastWebhookRejectedReason: value.lastWebhookRejectedReason || null,
        lastWebhookPreview: value.lastWebhookPreview || null,
        defaultChatId: value.defaultChatId || null,
        recentWebhookChats: recentWebhookChats.slice(0, 10),
      },
    };
  }

  @Post('zalo/test-bot')
  @ApiOperation({ summary: 'Validate Zalo Bot token via getMe' })
  async testZaloBot(@Req() req) {
    const result = await this.zaloProvider.getMe(req.user.tenantId);
    return { success: true, result };
  }

  @Post('zalo/admin-group/setup-code')
  @ApiOperation({ summary: 'Generate a one-time admin group setup code for /setadmin <CODE>' })
  async generateZaloAdminGroupSetupCode(@Req() req) {
    const tenantId = req.user.tenantId;
    const setting = await this.prisma.appSetting.findUnique({
      where: {
        tenantId_scope_ownerId_key: {
          tenantId,
          scope: 'TENANT' as any,
          ownerId: tenantId,
          key: 'zalo-provider',
        },
      },
    });
    if (!setting?.id) {
      throw new BadRequestException('ZALO_SETTINGS_NOT_SAVED');
    }

    const value = (setting.value as any) || {};
    const code = randomBytes(4).toString('hex').toUpperCase();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await this.prisma.appSetting.update({
      where: { id: setting.id },
      data: {
        value: {
          ...value,
          adminSetupCode: code,
          adminSetupCodeExpiresAt: expiresAt,
        },
      },
    });

    return {
      success: true,
      code,
      expiresAt,
      command: `/setadmin ${code}`,
    };
  }

  @Post('zalo/test-admin-group')
  @ApiOperation({ summary: 'Send a test Zalo message to the configured admin group' })
  async testZaloAdminGroup(
    @Req() req,
    @Body() body: { message?: string; template?: 'default' | 'connected' | 'update' | 'overload'; currentVersion?: string; latestVersion?: string; suspiciousIpCount?: number; topSource?: string; currentRps?: number },
  ) {
    const tenantId = req.user.tenantId;
    const setting = await this.prisma.appSetting.findUnique({
      where: {
        tenantId_scope_ownerId_key: {
          tenantId,
          scope: 'TENANT' as any,
          ownerId: tenantId,
          key: 'zalo-provider',
        },
      },
    });
    const value = (setting?.value as any) || {};
    const adminGroupChatId = String(value.adminGroupChatId || '').trim();
    if (!adminGroupChatId) {
      throw new BadRequestException('ZALO_ADMIN_GROUP_CHAT_ID_REQUIRED');
    }
    const template = String(body?.template || 'default').trim().toLowerCase();
    const built =
      template === 'connected'
        ? buildAdminGroupConnectedMessage({
            chatId: adminGroupChatId,
            connectedAt: new Date(),
            domain: process.env.APP_URL || null,
          })
        : template === 'update'
        ? buildUpdateAvailableMessage({
            currentVersion: String(body?.currentVersion || process.env.APP_VERSION || 'v1.1.6'),
            latestVersion: String(body?.latestVersion || 'v1.1.7'),
            checkedAt: new Date(),
          })
        : template === 'overload'
          ? buildServerOverloadAlertMessage({
              currentRps: Number(body?.currentRps || 0) || null,
              suspiciousIpCount: Number(body?.suspiciousIpCount || 0) || null,
              topSource: String(body?.topSource || '').trim() || null,
              detectedAt: new Date(),
            })
          : buildAdminGroupTestMessage();

    const result = await this.zaloProvider.send({
      tenantId,
      recipient: adminGroupChatId,
      title: built.title,
      message: String(body?.message || '').trim() || built.message,
      context: {},
    });
    return { success: true, recipient: adminGroupChatId, result };
  }

  @Delete('zalo/admin-group')
  @ApiOperation({ summary: 'Clear the configured Zalo admin group binding' })
  async clearZaloAdminGroup(@Req() req) {
    const tenantId = req.user.tenantId;
    const setting = await this.prisma.appSetting.findUnique({
      where: {
        tenantId_scope_ownerId_key: {
          tenantId,
          scope: 'TENANT' as any,
          ownerId: tenantId,
          key: 'zalo-provider',
        },
      },
    });
    if (!setting?.id) {
      throw new BadRequestException('ZALO_SETTINGS_NOT_SAVED');
    }

    const value = (setting.value as any) || {};
    await this.prisma.appSetting.update({
      where: { id: setting.id },
      data: {
        value: {
          ...value,
          adminGroupChatId: null,
          adminGroupConnectedAt: null,
          adminSetupCode: null,
          adminSetupCodeExpiresAt: null,
        },
      },
    });

    return { success: true };
  }

  @Post('zalo/auto-detect-admin-group')
  @ApiOperation({ summary: 'Pick the latest webhook chat_id, preferring group chats, and save it as the admin group chat id' })
  async autoDetectAdminGroup(@Req() req) {
    const tenantId = req.user.tenantId;
    const setting = await this.prisma.appSetting.findUnique({
      where: {
        tenantId_scope_ownerId_key: {
          tenantId,
          scope: 'TENANT' as any,
          ownerId: tenantId,
          key: 'zalo-provider',
        },
      },
    });
    if (!setting?.id) {
      throw new BadRequestException('ZALO_SETTINGS_NOT_SAVED');
    }

    const value = (setting.value as any) || {};
    const recentWebhookChats = Array.isArray(value.recentWebhookChats) ? value.recentWebhookChats : [];
    const detectedChat =
      recentWebhookChats.find((chat: any) => String(chat?.chatType || '').toLowerCase() === 'group')
      || recentWebhookChats[0]
      || (
        value.lastWebhookChatId
          ? {
              chatId: value.lastWebhookChatId,
              chatType: value.lastWebhookChatType || 'unknown',
              userId: value.lastWebhookSenderId || null,
              eventName: value.lastWebhookEventName || null,
              lastSeenAt: value.lastWebhookReceivedAt || null,
            }
          : null
      )
      || null;

    if (!detectedChat?.chatId) {
      throw new BadRequestException({
        message: 'ZALO_NO_WEBHOOK_CHAT_AVAILABLE',
        lastWebhookReceivedAt: value.lastWebhookReceivedAt || null,
        lastWebhookEventName: value.lastWebhookEventName || null,
        lastWebhookRejectedReason: value.lastWebhookRejectedReason || null,
      });
    }

    await this.prisma.appSetting.update({
      where: { id: setting.id },
      data: {
        value: {
          ...value,
          adminGroupChatId: detectedChat.chatId,
        },
      },
    });

    return {
      success: true,
      chat: detectedChat,
    };
  }

  @Post('zalo/connect-webhook')
  @ApiOperation({ summary: 'Call Zalo setWebhook with the current tenant webhook URL and secret token' })
  async connectZaloWebhook(@Req() req) {
    const tenantId = req.user.tenantId;
    const setting = await this.prisma.appSetting.findUnique({
      where: {
        tenantId_scope_ownerId_key: {
          tenantId,
          scope: 'TENANT' as any,
          ownerId: tenantId,
          key: 'zalo-provider',
        },
      },
    });
    const value = (setting?.value as any) || {};
    const webhookSecret = String(value.webhookSecret || '').trim();
    const webhookUrl = buildTenantWebhookUrl(value);
    if (!setting?.id) throw new BadRequestException('ZALO_SETTINGS_NOT_SAVED');
    if (!webhookSecret) throw new BadRequestException('ZALO_WEBHOOK_SECRET_REQUIRED');
    if (!webhookUrl) throw new BadRequestException('ZALO_WEBHOOK_URL_REQUIRED');

    const result = await this.zaloProvider.setWebhook(tenantId, {
      url: webhookUrl,
      secretToken: webhookSecret,
    });

    await this.prisma.appSetting.update({
      where: { id: setting!.id },
      data: {
        value: {
          ...value,
          lastWebhookConnectedAt: new Date().toISOString(),
          lastWebhookStatus: 'CONNECTED',
        },
      },
    });

    return { success: true, webhookUrl, result };
  }

  @Post('zalo/test-endpoint')
  @ApiOperation({ summary: 'Validate current Zalo webhook endpoint configuration without calling the provider' })
  async testZaloEndpoint(@Req() req) {
    const tenantId = req.user.tenantId;
    const setting = await this.prisma.appSetting.findUnique({
      where: {
        tenantId_scope_ownerId_key: {
          tenantId,
          scope: 'TENANT' as any,
          ownerId: tenantId,
          key: 'zalo-provider',
        },
      },
    });
    const value = (setting?.value as any) || {};
    const webhookUrl = buildTenantWebhookUrl(value);
    const webhookSecretConfigured = Boolean(String(value.webhookSecret || '').trim());
    const botTokenConfigured = Boolean(String(value.botToken || '').trim());
    return {
      success: Boolean(webhookUrl && webhookSecretConfigured && botTokenConfigured),
      webhookUrl,
      webhookSecretConfigured,
      botTokenConfigured,
    };
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

function summarizePayloadKeys(body: any) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return [];
  return Object.keys(body).slice(0, 12);
}

function buildWebhookPreview(
  body: any,
  normalized: ReturnType<typeof normalizeZaloUpdate>,
  extra: {
    contentType?: string;
    userAgent?: string;
    rawBodyLength?: number;
    secretProvided?: boolean;
  } = {},
) {
  return {
    eventName: normalized.eventName || null,
    chatId: normalized.chatId || null,
    chatType: normalized.chatType || 'unknown',
    senderId: normalized.senderId || null,
    hasText: Boolean(normalized.text),
    contentType: extra.contentType || null,
    userAgent: extra.userAgent || null,
    rawBodyLength: Number(extra.rawBodyLength || 0),
    secretProvided: Boolean(extra.secretProvided),
    payloadKeys: summarizePayloadKeys(body),
    messageKeys: summarizePayloadKeys(body?.message),
    eventKeys: summarizePayloadKeys(body?.event),
    dataKeys: summarizePayloadKeys(body?.data),
  };
}
