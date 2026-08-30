import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TemplateEngine } from './templates/template.engine';
import { NotificationChannel } from '../automation/automation.constants';
import { buildRoomContext } from '../shared/context/room-context';

export interface CommunicationPayload {
  tenantId: string;
  userId?: string | null;
  templateCode: string;
  moduleType?: string; // e.g. FINANCE, CONTRACT
  channel?: string;
  recipient?: string | null;
  context: any;
}

type DispatchResult = {
  notificationId: string;
  queueIds: string[];
};

export abstract class CommunicationProvider {
  abstract channel: NotificationChannel;
  abstract send(payload: any): Promise<any>;
}

function normalizeDispatchContext(context: any) {
  const baseContext = context && typeof context === 'object' ? context : {};
  const roomSource = baseContext.room || baseContext.contract?.room || null;
  const contractSource = baseContext.contract || null;
  const roomContext = buildRoomContext(roomSource, contractSource);

  return {
    ...baseContext,
    ...roomContext,
  };
}

const DEFAULT_NOTIFICATION_TEMPLATES: Record<string, { name: string; subject?: string; body: string }> = {
  INVOICE_ZALO_PAYMENT_REQUEST: {
    name: 'Yêu cầu thanh toán hóa đơn',
    subject: '🧾 Thông báo hóa đơn thanh toán {{invoiceCode}}',
    body: `Kính gửi anh/chị {{customerName}},

Hệ thống quản lý tòa nhà gửi thông báo hóa đơn:
- Mã hóa đơn: {{invoiceCode}}
- Số tiền cần thanh toán: {{amount}} đ
- Hạn thanh toán: {{dueDate}}

Quý khách vui lòng quét mã VietQR hoặc chuyển khoản theo thông tin:
- Ngân hàng: {{bankName}}
- Số tài khoản: {{bankAccountNumber}}
- Nội dung: {{paymentCode}}

Trân trọng cảm ơn!`,
  },
  DEPOSIT_ZALO_PAYMENT_REQUEST: {
    name: 'Yêu cầu thanh toán cọc',
    subject: '💰 Thông báo thanh toán cọc {{depositCode}}',
    body: `Kính gửi anh/chị {{customerName}},

Thông báo thanh toán cọc:
- Số tiền: {{amount}} đ
- Ngân hàng: {{bankName}}
- STK: {{bankAccountNumber}}
- Nội dung: {{paymentCode}}

Trân trọng cảm ơn!`,
  },
};

@Injectable()
export class CommunicationService {
  private readonly logger = new Logger(CommunicationService.name);
  private providers = new Map<NotificationChannel, CommunicationProvider>();
  private readonly templateEngine = new TemplateEngine();
  private readonly maxRetryCount = 3;
  private readonly immediateDeliveryEnabled = process.env.COMMUNICATION_IMMEDIATE_DELIVERY !== 'false';

  constructor(private readonly prisma: PrismaService) {}

  registerProvider(provider: CommunicationProvider) {
    this.providers.set(provider.channel, provider);
    this.logger.log(`Registered Communication Provider: ${provider.channel}`);
  }

  async dispatch(payload: CommunicationPayload): Promise<DispatchResult | null> {
    const context = normalizeDispatchContext(payload.context);

    // 1. Fetch template or use default system template
    let template = await this.prisma.notificationTemplate.findUnique({
      where: { tenantId_code: { tenantId: payload.tenantId, code: payload.templateCode } }
    });

    if (!template) {
      const defaultTpl = DEFAULT_NOTIFICATION_TEMPLATES[payload.templateCode];
      if (defaultTpl) {
        template = {
          id: 'default',
          tenantId: payload.tenantId,
          code: payload.templateCode,
          name: defaultTpl.name,
          subject: defaultTpl.subject || defaultTpl.name,
          body: defaultTpl.body,
          type: 'SYSTEM' as any,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any;
      } else {
        this.logger.error(`Template not found: ${payload.templateCode}`);
        return null;
      }
    }

    // 2. Fetch User Preferences (Fallback to IN_APP and CONSOLE if none)
    const preferences = await this.prisma.notificationPreference.findUnique({
      where: {
        tenantId_userId_type: { tenantId: payload.tenantId, userId: payload.userId, type: payload.moduleType || 'SYSTEM' }
      }
    });

    const channelsToUse = payload.channel
      ? [payload.channel]
      : preferences?.channels || [NotificationChannel.IN_APP, NotificationChannel.CONSOLE];

    // 3. Compile template
    const title = template.subject ? this.templateEngine.compile(template.subject, context) : template.name;
    const message = this.templateEngine.compile(template.body, context);

    // 4. Create master Notification record
    const notification = await this.prisma.notification.create({
      data: {
        tenantId: payload.tenantId,
        userId: payload.userId,
        channel: payload.channel ? (payload.channel as NotificationChannel) : NotificationChannel.IN_APP,
        title,
        message,
        type: payload.templateCode,
        status: 'QUEUED',
        metadata: context,
      }
    });

    // 5. Enqueue and dispatch to channels
    const queueIds: string[] = [];
    for (const ch of channelsToUse) {
      const channelEnum = ch as NotificationChannel;
      
      const queueItem = await this.prisma.notificationQueue.create({
        data: {
          tenantId: payload.tenantId,
          notificationId: notification.id,
          channel: channelEnum,
          payload: {
            tenantId: payload.tenantId,
            userId: payload.userId,
            recipient: payload.recipient,
            templateCode: payload.templateCode,
            moduleType: payload.moduleType,
            channel: channelEnum,
            title,
            message,
            context,
          },
          status: 'QUEUED'
        }
      });
      queueIds.push(queueItem.id);

      if (this.immediateDeliveryEnabled) {
        await this.processQueueItem(queueItem.id);
      }
    }

    return {
      notificationId: notification.id,
      queueIds,
    };
  }

  async dispatchDirect(payload: CommunicationPayload) {
    const result = await this.dispatch(payload);
    if (!result || !this.immediateDeliveryEnabled || result.queueIds.length === 0) {
      return result;
    }

    const queueItems = await this.prisma.notificationQueue.findMany({
      where: { id: { in: result.queueIds } },
      select: {
        id: true,
        status: true,
        error: true,
      },
    });
    const failedItem = queueItems.find((item) => item.status !== 'DELIVERED');
    if (failedItem) {
      throw new BadRequestException(failedItem.error || `Communication delivery failed: ${failedItem.status}`);
    }

    return {
      ...result,
      delivered: true,
    };
  }

  async getQueueAdmin(
    tenantId: string,
    options: { status?: string; channel?: string; search?: string; limit?: string | number } = {},
  ) {
    const requestedLimit = Number(options.limit || 100);
    const limit = Number.isFinite(requestedLimit) ? Math.min(300, Math.max(20, Math.round(requestedLimit))) : 100;
    const status = String(options.status || '').trim().toUpperCase();
    const channel = String(options.channel || '').trim().toUpperCase();
    const search = String(options.search || '').trim().toLowerCase();

    const rows = await this.prisma.notificationQueue.findMany({
      where: {
        tenantId,
        ...(status ? { status: status as any } : {}),
        ...(channel ? { channel: channel as any } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: search ? Math.min(limit * 3, 500) : limit,
    });

    const notificationIds = Array.from(new Set(rows.map((row) => row.notificationId).filter(Boolean)));
    const notifications = notificationIds.length
      ? await this.prisma.notification.findMany({
          where: { tenantId, id: { in: notificationIds } },
          select: {
            id: true,
            title: true,
            message: true,
            type: true,
            userId: true,
            createdAt: true,
          },
        })
      : [];
    const notificationById = new Map(notifications.map((item) => [item.id, item]));

    const hydrated = rows
      .map((row) => {
        const payload = row.payload && typeof row.payload === 'object' ? (row.payload as Record<string, any>) : {};
        const notification = notificationById.get(row.notificationId) || null;
        return {
          ...row,
          notification,
          payloadTitle: String(payload.title || notification?.title || '').trim() || null,
          payloadMessage: String(payload.message || notification?.message || '').trim() || null,
          recipient: String(payload.recipient || '').trim() || null,
          templateCode: String(payload.templateCode || notification?.type || '').trim() || null,
        };
      })
      .filter((row) => {
        if (!search) return true;
        const haystack = [
          row.id,
          row.channel,
          row.status,
          row.error,
          row.payloadTitle,
          row.payloadMessage,
          row.recipient,
          row.templateCode,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(search);
      });

    const limitedRows = hydrated.slice(0, limit);
    const summary = {
      total: hydrated.length,
      queued: hydrated.filter((row) => row.status === 'QUEUED').length,
      sending: hydrated.filter((row) => row.status === 'SENDING').length,
      delivered: hydrated.filter((row) => row.status === 'DELIVERED').length,
      failed: hydrated.filter((row) => row.status === 'FAILED').length,
      deadLetter: hydrated.filter((row) => row.status === 'DEAD_LETTER').length,
    };

    return {
      filters: {
        status: status || null,
        channel: channel || null,
        search: search || null,
        limit,
      },
      summary,
      rows: limitedRows,
    };
  }

  async retryQueueItem(tenantId: string, queueId: string) {
    const item = await this.prisma.notificationQueue.findFirst({
      where: { id: queueId, tenantId },
    });
    if (!item) throw new BadRequestException('Không tìm thấy queue item.');
    if (item.status === 'DELIVERED') {
      throw new BadRequestException('Queue item đã gửi thành công, không thể retry.');
    }

    await this.prisma.notificationQueue.update({
      where: { id: queueId },
      data: { status: 'QUEUED', error: null, nextRetryAt: null },
    });
    await this.processQueueItem(queueId);

    return { success: true };
  }

  async cancelQueueItem(tenantId: string, queueId: string) {
    const item = await this.prisma.notificationQueue.findFirst({
      where: { id: queueId, tenantId },
    });
    if (!item) throw new BadRequestException('Không tìm thấy queue item.');
    if (item.status === 'DELIVERED') {
      throw new BadRequestException('Queue item đã gửi thành công, không thể hủy.');
    }

    await this.prisma.notificationQueue.update({
      where: { id: queueId },
      data: {
        status: 'DEAD_LETTER',
        error: 'Cancelled manually',
        nextRetryAt: null,
      },
    });
    await this.prisma.notification.update({
      where: { id: item.notificationId },
      data: { status: 'FAILED' },
    });

    return { success: true };
  }

  async processQueueItem(queueId: string) {
    const item = await this.prisma.notificationQueue.findUnique({ where: { id: queueId }});
    if (!item) return;
    if (item.status === 'DELIVERED' || item.status === 'DEAD_LETTER') return;
    if (item.status === 'FAILED' && item.nextRetryAt && item.nextRetryAt > new Date()) return;

    const claimed = await this.prisma.notificationQueue.updateMany({
      where: {
        id: queueId,
        status: { in: ['QUEUED', 'FAILED', 'RETRYING'] as any },
      },
      data: { status: 'SENDING', error: null },
    });
    if (claimed.count !== 1) return;
    
    const provider = this.providers.get(item.channel as NotificationChannel);
    
    if (!provider) {
       await this.markQueueFailed(item, 'No provider registered');
       return;
    }

    try {
      const response = await provider.send(item.payload);
      
      await this.prisma.notificationQueue.update({
        where: { id: queueId },
        data: { status: 'DELIVERED', error: null, nextRetryAt: null }
      });
      await this.prisma.notification.update({ where: { id: item.notificationId }, data: { status: 'DELIVERED' }});
      
      await this.prisma.notificationDelivery.create({
        data: {
          notificationId: item.notificationId,
          channel: item.channel as NotificationChannel,
          status: 'DELIVERED',
          providerId: this.extractProviderMessageId(response),
          providerResponse: response || {}
        }
      });

    } catch (err) {
      this.logger.error(`Failed to send via ${item.channel}`, err.stack);
      await this.markQueueFailed(item, err.message);
      await this.prisma.notificationDelivery.create({
        data: {
          notificationId: item.notificationId,
          channel: item.channel as NotificationChannel,
          status: 'FAILED',
          error: err.message
        }
      });
    }
  }

  private extractProviderMessageId(response: any): string | null {
    if (!response || typeof response !== 'object') return null;

    const candidates = [
      response.providerMessageId,
      response.telegramMessageId,
      response.messageId,
      response.id,
      response.zaloMessageId,
      response.zaloResponse?.message_id,
      response.zaloResponse?.result?.message_id,
      response.zaloResponse?.data?.message_id,
      response.zaloResponse?.data?.messageId,
    ];

    const providerId = candidates.find((value) => value !== undefined && value !== null && String(value).trim());
    return providerId === undefined ? null : String(providerId);
  }

  private async markQueueFailed(item: { id: string; notificationId: string; retryCount?: number }, error: string) {
    const nextRetryCount = Number(item.retryCount || 0) + 1;
    const shouldRetry = nextRetryCount < this.maxRetryCount;
    const nextRetryAt = shouldRetry ? new Date(Date.now() + nextRetryCount * 5 * 60 * 1000) : null;

    await this.prisma.notificationQueue.update({
      where: { id: item.id },
      data: {
        status: shouldRetry ? 'FAILED' : 'DEAD_LETTER',
        error,
        retryCount: nextRetryCount,
        nextRetryAt,
      }
    });
    await this.prisma.notification.update({
      where: { id: item.notificationId },
      data: { status: 'FAILED' }
    });
  }
}
