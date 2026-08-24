import { Injectable, Logger } from '@nestjs/common';
import { CommunicationProvider } from '../communication.service';
import { NotificationChannel } from '../../automation/automation.constants';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SettingScope } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import nodemailer from 'nodemailer';

type ProviderPayload = {
  tenantId?: string;
  recipient?: string | null;
  title?: string;
  message?: string;
  context?: Record<string, any>;
  [key: string]: any;
};

async function readTenantSetting<T extends Record<string, any>>(
  prisma: PrismaService,
  tenantId: string | undefined,
  key: string,
): Promise<T> {
  if (!tenantId) throw new Error('Missing tenantId for provider dispatch');

  const record = await prisma.appSetting.findUnique({
    where: {
      tenantId_scope_ownerId_key: {
        tenantId,
        scope: SettingScope.TENANT,
        ownerId: tenantId,
        key,
      },
    },
  });

  return ((record?.value as T) || {}) as T;
}

function assertEnabled(settings: Record<string, any>, providerName: string) {
  if (settings.enabled === false) {
    throw new Error(`${providerName} provider is disabled`);
  }
}

function resolveRecipient(payload: ProviderPayload, keys: string[]) {
  if (payload.recipient) return String(payload.recipient);

  for (const key of keys) {
    const value = payload.context?.[key];
    if (value) return String(value);
  }

  return '';
}

function looksLikePhoneNumber(value: string) {
  const normalized = value.replace(/[^\d+]/g, '');
  return /^(\+?84|0)\d{8,11}$/.test(normalized);
}

async function postJsonWithTimeout(url: string, body: Record<string, any>, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const responseBody = await response.json().catch(() => ({}));
    return { response, body: responseBody };
  } finally {
    clearTimeout(timeout);
  }
}

@Injectable()
export class InAppProvider implements CommunicationProvider {
  channel = NotificationChannel.IN_APP;
  
  constructor(private eventEmitter: EventEmitter2) {}

  async send(payload: any): Promise<any> {
    // In-app just emits an event which can be picked up by SSE or WebSockets later
    this.eventEmitter.emit('notification.in_app.sent', payload);
    return { success: true, timestamp: new Date() };
  }
}

@Injectable()
export class ConsoleProvider implements CommunicationProvider {
  channel = NotificationChannel.CONSOLE;
  private readonly logger = new Logger(ConsoleProvider.name);

  async send(payload: any): Promise<any> {
    this.logger.log(`\n\n=== 📢 SYSTEM NOTIFICATION ===\nTitle: ${payload.title}\nMessage: ${payload.message}\n==============================\n`);
    return { success: true };
  }
}

@Injectable() export class EmailProvider implements CommunicationProvider {
  channel = NotificationChannel.EMAIL;
  private readonly transporters = new Map<string, { fingerprint: string; transporter: nodemailer.Transporter }>();

  constructor(private readonly prisma: PrismaService) {}

  private getTransporter(tenantId: string, settings: Record<string, any>) {
    const fingerprint = JSON.stringify({
      host: settings.smtpHost,
      port: Number(settings.smtpPort || 587),
      secure: Boolean(settings.smtpSecure),
      user: settings.smtpUser || '',
      pass: settings.smtpPassword || '',
    });
    const cached = this.transporters.get(tenantId);
    if (cached?.fingerprint === fingerprint) return cached.transporter;
    cached?.transporter.close?.();

    const transporter = nodemailer.createTransport({
      host: String(settings.smtpHost || '').trim(),
      port: Number(settings.smtpPort || 587),
      secure: Boolean(settings.smtpSecure),
      pool: settings.smtpPool !== false,
      maxConnections: Number(settings.smtpMaxConnections || 3),
      maxMessages: Number(settings.smtpMaxMessages || 100),
      connectionTimeout: Number(settings.smtpConnectionTimeoutMs || 10000),
      greetingTimeout: Number(settings.smtpGreetingTimeoutMs || 10000),
      socketTimeout: Number(settings.smtpSocketTimeoutMs || 15000),
      auth: settings.smtpUser
        ? {
            user: settings.smtpUser,
            pass: settings.smtpPassword || '',
          }
        : undefined,
    } as any);

    this.transporters.set(tenantId, { fingerprint, transporter });
    return transporter;
  }

  async send(payload: ProviderPayload): Promise<any> {
    if (payload?.testMode === 'FAIL_PROVIDER') {
      throw new Error('Simulated failure for E2E testing');
    }

    const settings = await readTenantSetting<any>(this.prisma, payload.tenantId, 'email-provider');
    assertEnabled(settings, 'Email');

    const host = String(settings.smtpHost || '').trim();
    const recipient = resolveRecipient(payload, ['email', 'customerEmail', 'userEmail']);

    if (!host || !recipient) {
      throw new Error('Email provider is not configured');
    }

    const transporter = this.getTransporter(payload.tenantId!, settings);

    const fromName = settings.fromName || 'HomeLand';
    const fromEmail = settings.fromEmail || settings.smtpUser;
    if (!fromEmail) throw new Error('Email sender is not configured');

    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: recipient,
      subject: payload.title || 'HomeLand notification',
      text: payload.message || '',
      html: settings.sendHtml === false ? undefined : String(payload.message || '').replace(/\n/g, '<br />'),
    });

    return { success: true, providerMessageId: info.messageId };
  }
}

@Injectable() export class TelegramProvider implements CommunicationProvider {
  channel = NotificationChannel.TELEGRAM;

  constructor(private readonly prisma: PrismaService) {}

  async send(payload: ProviderPayload): Promise<any> {
    const settings = await readTenantSetting<any>(this.prisma, payload.tenantId, 'telegram-provider');
    assertEnabled(settings, 'Telegram');

    const botToken = String(settings.botToken || '').trim();
    const chatId = resolveRecipient(payload, ['telegramChatId', 'chatId']) || String(settings.defaultChatId || '').trim();
    const timeoutMs = Number(settings.providerTimeoutMs || 10000);

    if (!botToken || !chatId) {
      throw new Error('Telegram provider is not configured');
    }

    const { response, body } = await postJsonWithTimeout(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        chat_id: chatId,
        text: [payload.title, payload.message].filter(Boolean).join('\n\n'),
        parse_mode: settings.parseMode || undefined,
        disable_web_page_preview: settings.disableWebPreview ?? true,
      },
      timeoutMs,
    );

    if (!response.ok || body?.ok === false) {
      throw new Error(body?.description || `Telegram send failed with ${response.status}`);
    }

    return { success: true, telegramMessageId: body?.result?.message_id };
  }
}

@Injectable() export class ZaloProvider implements CommunicationProvider {
  channel = NotificationChannel.ZALO;
  private readonly defaultApiBase = 'https://bot-api.zaloplatforms.com';

  constructor(private readonly prisma: PrismaService) {}

  async send(payload: ProviderPayload): Promise<any> {
    const settings = await readTenantSetting<any>(this.prisma, payload.tenantId, 'zalo-provider');
    assertEnabled(settings, 'Zalo');

    const botToken = String(settings.botToken || '').trim();
    const apiBase = String(settings.apiBaseUrl || this.defaultApiBase).trim().replace(/\/+$/, '');
    const recipient = resolveRecipient(payload, ['zaloChatId', 'customerZaloChatId', 'chatId', 'zaloUserId', 'customerZaloUserId']);
    const timeoutMs = Number(settings.providerTimeoutMs || 10000);

    if (!botToken || !recipient) {
      throw new Error('Zalo provider is not configured');
    }
    if (looksLikePhoneNumber(recipient)) {
      throw new Error('Zalo Bot requires chat_id or user_id. Current recipient looks like a phone number.');
    }

    const { response, body } = await postJsonWithTimeout(
      `${apiBase}/bot${botToken}/sendMessage`,
      {
        chat_id: recipient,
        text: [payload.title, payload.message].filter(Boolean).join('\n\n'),
      },
      timeoutMs,
    );

    if (!response.ok || body?.ok === false || body?.error) {
      throw new Error(body?.message || body?.error_name || `Zalo send failed with ${response.status}`);
    }

    return { success: true, zaloResponse: body };
  }
}

@Injectable() export class SMSProvider implements CommunicationProvider {
  channel = NotificationChannel.SMS;
  async send(payload: any): Promise<any> { return { success: true, stub: true }; }
}

@Injectable() export class PushProvider implements CommunicationProvider {
  channel = NotificationChannel.PUSH;
  async send(payload: any): Promise<any> { return { success: true, stub: true }; }
}
