import { BadRequestException, Injectable, Logger, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma.service';
import { TemplateEngine } from './templates/template.engine';
import { NotificationChannel } from '../automation/automation.constants';
import { buildRoomContext } from '../shared/context/room-context';
import {
  DEFAULT_NOTIFICATION_TEMPLATES,
  getNotificationTemplateDefinition,
  NOTIFICATION_TEMPLATE_CATALOG,
  type NotificationTemplateDefinition,
} from './templates/notification-template-catalog';

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

type TemplateContentInput = {
  name?: string;
  subject?: string | null;
  body?: string;
};

type TemplateContent = {
  name: string;
  subject: string | null;
  body: string;
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
  const roomCode = roomContext.roomCode || baseContext.roomCode || null;
  const buildingName = roomContext.buildingName || baseContext.buildingName || null;
  const formatMoney = (value: unknown) => {
    if (value === undefined || value === null || value === '') return '';
    const raw = String(value).trim();
    const amount = /^-?\d{1,3}(?:[.,]\d{3})+$/.test(raw)
      ? Number(raw.replace(/[.,]/g, ''))
      : Number(value);
    return Number.isFinite(amount) ? `${amount.toLocaleString('vi-VN')} đ` : String(value);
  };

  return {
    ...baseContext,
    ...roomContext,
    customerName: baseContext.customerName ?? '',
    roomCode,
    buildingName,
    roomAndBuilding: baseContext.roomAndBuilding || [roomCode, buildingName].filter(Boolean).join(' - '),
    // Default templates use display-only fields. Keep source amount fields unchanged
    // so published tenant templates continue to render with their existing values.
    paymentAmountDisplay: baseContext.paymentAmountDisplay ?? formatMoney(baseContext.paymentAmount),
    amountDisplay: baseContext.amountDisplay ?? formatMoney(baseContext.amount ?? baseContext.paidAmount),
    paidAmountDisplay: baseContext.paidAmountDisplay ?? formatMoney(baseContext.paidAmount),
    remainingAmountDisplay: baseContext.remainingAmountDisplay ?? formatMoney(baseContext.remainingAmount),
    overdueLabel: baseContext.overdueLabel ?? '',
    // Older queued payment requests predate the due-date field. Keep their
    // snapshots renderable when the tenant selects the current default.
    dueDate: baseContext.dueDate ?? '',
  };
}

@Injectable()
export class CommunicationService {
  private readonly logger = new Logger(CommunicationService.name);
  private providers = new Map<NotificationChannel, CommunicationProvider>();
  private readonly templateEngine = new TemplateEngine();
  private readonly maxRetryCount = 3;
  private readonly immediateDeliveryEnabled = process.env.COMMUNICATION_IMMEDIATE_DELIVERY !== 'false';

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly eventEmitter?: EventEmitter2,
  ) {}

  registerProvider(provider: CommunicationProvider) {
    this.providers.set(provider.channel, provider);
    this.logger.log(`Registered Communication Provider: ${provider.channel}`);
  }

  private getDefinition(code: string): NotificationTemplateDefinition {
    const definition = getNotificationTemplateDefinition(code);
    if (!definition) {
      throw new BadRequestException(`Không hỗ trợ mã mẫu tin ${code}.`);
    }
    return definition;
  }

  private normalizeTemplateContent(definition: NotificationTemplateDefinition, input: TemplateContentInput): TemplateContent {
    const name = String(input?.name ?? definition.name).trim();
    const subjectInput = input?.subject === undefined ? definition.subject || null : input.subject;
    const subject = subjectInput === null ? null : String(subjectInput).trim() || null;
    const body = String(input?.body ?? definition.body).trim();

    if (!name || name.length > 120) {
      throw new BadRequestException('Tên mẫu tin phải có từ 1 đến 120 ký tự.');
    }
    if (subject && subject.length > 250) {
      throw new BadRequestException('Tiêu đề mẫu tin không được quá 250 ký tự.');
    }
    if (!body || body.length > 5000) {
      throw new BadRequestException('Nội dung mẫu tin phải có từ 1 đến 5.000 ký tự.');
    }

    const allowedVariables = definition.variables.map((variable) => variable.path);
    try {
      if (subject) this.templateEngine.validateTemplate(subject, allowedVariables);
      this.templateEngine.validateTemplate(body, allowedVariables);
    } catch (error: any) {
      throw new BadRequestException(error?.message || 'Mẫu tin không hợp lệ.');
    }

    return { name, subject, body };
  }

  private serializeTemplateVersion(version: any) {
    return {
      id: version.id,
      version: version.version,
      name: version.name,
      subject: version.subject,
      body: version.body,
      status: version.status,
      createdById: version.createdById || null,
      createdAt: version.createdAt,
      updatedAt: version.updatedAt,
    };
  }

  async getTemplateCatalog(tenantId: string) {
    const [published, versions] = await Promise.all([
      this.prisma.notificationTemplate.findMany({
        where: { tenantId },
        orderBy: { code: 'asc' },
      }),
      this.prisma.notificationTemplateVersion.findMany({
        where: { tenantId },
        orderBy: [{ code: 'asc' }, { version: 'desc' }],
      }),
    ]);
    const publishedByCode = new Map(published.map((template) => [template.code, template]));
    const versionsByCode = new Map<string, any[]>();
    for (const version of versions) {
      const existing = versionsByCode.get(version.code) || [];
      existing.push(version);
      versionsByCode.set(version.code, existing);
    }

    return {
      templates: NOTIFICATION_TEMPLATE_CATALOG.map((definition) => {
        const tenantTemplate = publishedByCode.get(definition.code) || null;
        const history = versionsByCode.get(definition.code) || [];
        const draft = history.find((version) => version.status === 'DRAFT') || null;
        return {
          code: definition.code,
          audience: definition.audience || 'SYSTEM',
          category: definition.category || 'SYSTEM',
          variables: definition.variables,
          default: {
            name: definition.name,
            subject: definition.subject || null,
            body: definition.body,
          },
          effective: tenantTemplate
            ? {
                name: tenantTemplate.name,
                subject: tenantTemplate.subject,
                body: tenantTemplate.body,
                source: 'TENANT',
                version: tenantTemplate.publishedVersion || 0,
                publishedAt: tenantTemplate.publishedAt,
              }
            : {
                name: definition.name,
                subject: definition.subject || null,
                body: definition.body,
                source: 'DEFAULT',
                version: 0,
                publishedAt: null,
              },
          draft: draft ? this.serializeTemplateVersion(draft) : null,
          versions: history.slice(0, 20).map((version) => this.serializeTemplateVersion(version)),
        };
      }),
    };
  }

  async saveTemplateDraft(tenantId: string, code: string, input: TemplateContentInput, actorId: string) {
    const definition = this.getDefinition(code);
    const content = this.normalizeTemplateContent(definition, input);
    const existingDraft = await this.prisma.notificationTemplateVersion.findFirst({
      where: { tenantId, code: definition.code, status: 'DRAFT' as any },
      orderBy: { version: 'desc' },
    });

    if (existingDraft) {
      const draft = await this.prisma.notificationTemplateVersion.update({
        where: { id: existingDraft.id },
        data: { ...content, createdById: actorId },
      });
      return { draft: this.serializeTemplateVersion(draft) };
    }

    const latest = await this.prisma.notificationTemplateVersion.findFirst({
      where: { tenantId, code: definition.code },
      orderBy: { version: 'desc' },
    });
    const template = await this.prisma.notificationTemplate.findUnique({
      where: { tenantId_code: { tenantId, code: definition.code } },
      select: { publishedVersion: true },
    });
    const version = Math.max(Number(latest?.version || 0), Number(template?.publishedVersion || 0)) + 1;
    const draft = await this.prisma.notificationTemplateVersion.create({
      data: {
        tenantId,
        code: definition.code,
        version,
        ...content,
        status: 'DRAFT' as any,
        createdById: actorId,
      },
    });
    return { draft: this.serializeTemplateVersion(draft) };
  }

  async previewTemplate(code: string, input: TemplateContentInput, context?: Record<string, unknown>) {
    const definition = this.getDefinition(code);
    const content = this.normalizeTemplateContent(definition, input);
    const previewContext = { ...definition.sampleContext, ...(context || {}) };
    try {
      return {
        code: definition.code,
        title: content.subject ? this.templateEngine.compile(content.subject, previewContext) : content.name,
        message: this.templateEngine.compile(content.body, previewContext),
        variables: definition.variables,
      };
    } catch (error: any) {
      throw new BadRequestException(error?.message || 'Không thể render mẫu tin.');
    }
  }

  async publishTemplate(tenantId: string, code: string, actorId: string) {
    const definition = this.getDefinition(code);
    return this.prisma.$transaction(async (tx) => {
      const draft = await tx.notificationTemplateVersion.findFirst({
        where: { tenantId, code: definition.code, status: 'DRAFT' as any },
        orderBy: { version: 'desc' },
      });
      if (!draft) {
        throw new BadRequestException('Chưa có bản nháp để xuất bản.');
      }

      const published = await tx.notificationTemplateVersion.update({
        where: { id: draft.id },
        data: { status: 'PUBLISHED' as any, createdById: actorId },
      });
      const now = new Date();
      const template = await tx.notificationTemplate.upsert({
        where: { tenantId_code: { tenantId, code: definition.code } },
        create: {
          tenantId,
          code: definition.code,
          name: published.name,
          subject: published.subject,
          body: published.body,
          publishedVersion: published.version,
          publishedAt: now,
          publishedById: actorId,
        },
        update: {
          name: published.name,
          subject: published.subject,
          body: published.body,
          publishedVersion: published.version,
          publishedAt: now,
          publishedById: actorId,
        },
      });
      return { template, version: this.serializeTemplateVersion(published) };
    });
  }

  async rollbackTemplate(tenantId: string, code: string, targetVersion: number, actorId: string) {
    const definition = this.getDefinition(code);
    const requestedVersion = Number(targetVersion);
    if (!Number.isInteger(requestedVersion) || requestedVersion < 1) {
      throw new BadRequestException('Phiên bản cần khôi phục không hợp lệ.');
    }

    return this.prisma.$transaction(async (tx) => {
      const source = await tx.notificationTemplateVersion.findFirst({
        where: { tenantId, code: definition.code, version: requestedVersion, status: 'PUBLISHED' as any },
      });
      if (!source) {
        throw new BadRequestException('Không tìm thấy phiên bản đã xuất bản cần khôi phục.');
      }
      const latest = await tx.notificationTemplateVersion.findFirst({
        where: { tenantId, code: definition.code },
        orderBy: { version: 'desc' },
      });
      const nextVersion = Number(latest?.version || 0) + 1;
      const restored = await tx.notificationTemplateVersion.create({
        data: {
          tenantId,
          code: definition.code,
          version: nextVersion,
          name: source.name,
          subject: source.subject,
          body: source.body,
          status: 'PUBLISHED' as any,
          createdById: actorId,
        },
      });
      const now = new Date();
      const template = await tx.notificationTemplate.upsert({
        where: { tenantId_code: { tenantId, code: definition.code } },
        create: {
          tenantId,
          code: definition.code,
          name: restored.name,
          subject: restored.subject,
          body: restored.body,
          publishedVersion: restored.version,
          publishedAt: now,
          publishedById: actorId,
        },
        update: {
          name: restored.name,
          subject: restored.subject,
          body: restored.body,
          publishedVersion: restored.version,
          publishedAt: now,
          publishedById: actorId,
        },
      });
      return { template, version: this.serializeTemplateVersion(restored) };
    });
  }

  async dispatch(payload: CommunicationPayload): Promise<DispatchResult | null> {
    const context = normalizeDispatchContext(payload.context);

    // 1. Fetch template or use default system template
    const defaultTpl = DEFAULT_NOTIFICATION_TEMPLATES[payload.templateCode];
    let template = await this.prisma.notificationTemplate.findUnique({
      where: { tenantId_code: { tenantId: payload.tenantId, code: payload.templateCode } }
    });

    if (!template) {
      if (defaultTpl) {
        template = {
          id: 'default',
          tenantId: payload.tenantId,
          code: payload.templateCode,
          name: defaultTpl.name,
          subject: defaultTpl.subject || defaultTpl.name,
          body: defaultTpl.body,
          publishedVersion: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any;
      } else {
        this.logger.error(`Template not found: ${payload.templateCode}`);
        return null;
      }
    }

    // 2. Fetch User Preferences (Fallback to IN_APP and CONSOLE if none)
    const preferences = payload.userId
      ? await this.prisma.notificationPreference.findUnique({
          where: {
            tenantId_userId_type: {
              tenantId: payload.tenantId,
              userId: payload.userId,
              type: payload.moduleType || 'SYSTEM',
            },
          },
        })
      : null;

    const channelsToUse = payload.channel
      ? [payload.channel]
      : preferences?.channels || [NotificationChannel.IN_APP, NotificationChannel.CONSOLE];

    // 3. Compile template
    let title: string;
    let message: string;
    try {
      title = template.subject ? this.templateEngine.compile(template.subject, context) : template.name;
      message = this.templateEngine.compile(template.body, context);
    } catch (error: any) {
      this.logger.error(`Cannot render notification template ${payload.templateCode}: ${error?.message || error}`);
      throw new BadRequestException(error?.message || 'Không thể render mẫu thông báo.');
    }
    const templateSnapshot = {
      code: payload.templateCode,
      source: template.id === 'default' ? 'DEFAULT' : 'TENANT',
      templateId: template.id || null,
      version: Number((template as any).publishedVersion || 0),
      name: template.name,
      subject: template.subject || null,
      body: template.body,
      title,
      message,
      renderedAt: new Date().toISOString(),
    };

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
        metadata: { ...context, templateSnapshot },
      }
    });
    if (notification.channel === NotificationChannel.IN_APP) {
      this.eventEmitter?.emit('notification.in_app.created', {
        tenantId: notification.tenantId,
        userId: notification.userId,
        notificationId: notification.id,
        type: notification.type,
      });
    }

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
            templateSnapshot,
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
    if (!result || result.queueIds.length === 0) {
      return result;
    }

    // Always process immediately for direct dispatches
    for (const qId of result.queueIds) {
      await this.processQueueItem(qId);
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

  private async syncNotificationStatus(notificationId: string) {
    const queueItems = await this.prisma.notificationQueue.findMany({
      where: { notificationId },
      select: { status: true },
    });
    if (!queueItems.length) return;

    const statuses = queueItems.map((queueItem) => String(queueItem.status));
    let status: string;
    if (statuses.every((value) => value === 'DELIVERED')) {
      status = 'DELIVERED';
    } else if (statuses.includes('SENDING')) {
      status = 'SENDING';
    } else if (statuses.includes('QUEUED') || statuses.includes('RETRYING')) {
      status = 'QUEUED';
    } else if (statuses.includes('FAILED')) {
      status = 'FAILED';
    } else if (statuses.includes('DEAD_LETTER')) {
      status = 'DEAD_LETTER';
    } else {
      status = 'QUEUED';
    }

    await this.prisma.notification.update({
      where: { id: notificationId },
      data: { status: status as any },
    });
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
    await this.syncNotificationStatus(item.notificationId);

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
      const error = 'No provider registered';
      await this.markQueueFailed(item, error);
      await this.prisma.notificationDelivery.create({
        data: {
          notificationId: item.notificationId,
          channel: item.channel as NotificationChannel,
          status: 'FAILED',
          error,
        },
      });
      await this.syncNotificationStatus(item.notificationId);
      return;
    }

    try {
      const response = await provider.send(item.payload);
      
      await this.prisma.notificationQueue.update({
        where: { id: queueId },
        data: { status: 'DELIVERED', error: null, nextRetryAt: null }
      });
      
      await this.prisma.notificationDelivery.create({
        data: {
          notificationId: item.notificationId,
          channel: item.channel as NotificationChannel,
          status: 'DELIVERED',
          providerId: this.extractProviderMessageId(response),
          providerResponse: response || {}
        }
      });
      await this.syncNotificationStatus(item.notificationId);

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
      await this.syncNotificationStatus(item.notificationId);
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

    try {
      const currentNotif = await this.prisma.notification.findUnique({
        where: { id: item.notificationId },
        select: { metadata: true },
      });
      const currentMeta = (currentNotif?.metadata && typeof currentNotif.metadata === 'object')
        ? (currentNotif.metadata as Record<string, any>)
        : {};

      await this.prisma.notification.update({
        where: { id: item.notificationId },
        data: {
          status: 'FAILED',
          metadata: {
            ...currentMeta,
            lastError: error,
          },
        },
      });
    } catch {
      await this.prisma.notification.update({
        where: { id: item.notificationId },
        data: { status: 'FAILED' },
      });
    }
  }
}
