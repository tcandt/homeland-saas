import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TemplateEngine } from './templates/template.engine';
import { NotificationChannel } from '../automation/automation.constants';

export interface CommunicationPayload {
  tenantId: string;
  userId?: string | null;
  templateCode: string;
  moduleType?: string; // e.g. FINANCE, CONTRACT
  channel?: string;
  recipient?: string | null;
  context: any;
}

export abstract class CommunicationProvider {
  abstract channel: NotificationChannel;
  abstract send(payload: any): Promise<any>;
}

@Injectable()
export class CommunicationService {
  private readonly logger = new Logger(CommunicationService.name);
  private providers = new Map<NotificationChannel, CommunicationProvider>();
  private readonly templateEngine = new TemplateEngine();
  private readonly maxRetryCount = 3;

  constructor(private readonly prisma: PrismaService) {}

  registerProvider(provider: CommunicationProvider) {
    this.providers.set(provider.channel, provider);
    this.logger.log(`Registered Communication Provider: ${provider.channel}`);
  }

  async dispatch(payload: CommunicationPayload) {
    // 1. Fetch template
    const template = await this.prisma.notificationTemplate.findUnique({
      where: { tenantId_code: { tenantId: payload.tenantId, code: payload.templateCode } }
    });

    if (!template) {
      this.logger.error(`Template not found: ${payload.templateCode}`);
      return;
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
    const title = template.subject ? this.templateEngine.compile(template.subject, payload.context) : template.name;
    const message = this.templateEngine.compile(template.body, payload.context);

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
        metadata: payload.context,
      }
    });

    // 5. Enqueue and dispatch to channels
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
            context: payload.context,
          },
          status: 'QUEUED'
        }
      });

      // Attempt immediate delivery
      await this.processQueueItem(queueItem.id);
    }
  }

  async dispatchDirect(payload: CommunicationPayload) {
    return this.dispatch(payload);
  }

  async processQueueItem(queueId: string) {
    const item = await this.prisma.notificationQueue.findUnique({ where: { id: queueId }});
    if (!item) return;
    if (item.status === 'DELIVERED') return;

    await this.prisma.notificationQueue.update({
      where: { id: queueId },
      data: { status: 'SENDING', error: null }
    });
    
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

  private async markQueueFailed(item: { id: string; notificationId: string; retryCount?: number }, error: string) {
    const nextRetryCount = Number(item.retryCount || 0) + 1;
    const shouldRetry = nextRetryCount < this.maxRetryCount;
    const nextRetryAt = shouldRetry ? new Date(Date.now() + nextRetryCount * 5 * 60 * 1000) : null;

    await this.prisma.notificationQueue.update({
      where: { id: item.id },
      data: {
        status: 'FAILED',
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
