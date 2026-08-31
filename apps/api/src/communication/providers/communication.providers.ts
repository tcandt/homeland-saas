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
  photo?: string;
  caption?: string;
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

function buildZaloBotBaseUrl(apiBase: string, botToken: string) {
  return `${apiBase}/bot${botToken}`;
}

function hasOwn(source: Record<string, any>, key: string) {
  return Object.prototype.hasOwnProperty.call(source, key);
}

function isExplicitZaloApiFailure(body: any) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  if (body.ok === false) return true;
  if (body.success === false) return true;
  if (typeof body.error_code === 'number' && body.error_code !== 0) return true;
  if (typeof body.err === 'number' && body.err !== 0) return true;
  if (hasOwn(body, 'error') && body.error && body.error !== 0 && body.error !== '0') return true;
  return false;
}

function assertZaloApiSuccess(response: Response, body: any, action: string) {
  if (!response.ok || isExplicitZaloApiFailure(body)) {
    throw new Error(pickZaloApiErrorMessage(body) || `Zalo ${action} failed with ${response.status}`);
  }
}

function pickZaloApiErrorMessage(body: any) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return '';
  const candidates = [
    body.message,
    body.error_name,
    body.error_message,
    body.description,
    body.msg,
    typeof body.error === 'string' ? body.error : '',
    typeof body.error === 'object' ? body.error?.message : '',
  ];
  for (const item of candidates) {
    if (typeof item === 'string' && item.trim()) return item.trim();
  }
  return '';
}

function extractZaloUpdates(body: any): any[] {
  const candidates = [
    body,
    body?.result,
    body?.data,
    body?.updates,
    body?.result?.updates,
    body?.result?.data,
    body?.data?.updates,
    body?.data?.data,
    body?.response,
    body?.response?.data,
    body?.response?.updates,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }

  for (const candidate of candidates) {
    if (
      candidate
      && typeof candidate === 'object'
      && !Array.isArray(candidate)
      && (
        typeof candidate.event_name === 'string'
        || candidate.message
        || candidate.chat
      )
    ) {
      return [candidate];
    }
  }

  return [];
}

function isPollingTimeout(body: any) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  const description = String(body.description || body.message || body.error_name || '').trim().toLowerCase();
  return Number(body.error_code) === 408 || description === 'request timeout';
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

    const title = (payload.title || '').trim();
    const message = (payload.message || '').trim();
    const text = message
      ? (title && !message.startsWith(title) ? `${title}\n\n${message}` : message)
      : title;

    const { response, body } = await postJsonWithTimeout(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        chat_id: chatId,
        text,
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
  private readonly logger = new Logger(ZaloProvider.name);

  constructor(private readonly prisma: PrismaService) {}

  private async resolveSettings(tenantId?: string, options: { requireEnabled?: boolean } = {}) {
    const settings = await readTenantSetting<any>(this.prisma, tenantId, 'zalo-provider');
    if (options.requireEnabled !== false) {
      assertEnabled(settings, 'Zalo');
    }
    const botToken = String(settings.botToken || '').trim();
    const configuredApiBase = String(settings.apiBaseUrl || '').trim();
    const apiBase = (configuredApiBase || this.defaultApiBase).replace(/\/+$/, '');
    const timeoutMs = Number(settings.providerTimeoutMs || 10000);
    return { settings, botToken, apiBase, timeoutMs };
  }

  async getMe(tenantId?: string) {
    const { botToken, apiBase, timeoutMs } = await this.resolveSettings(tenantId, { requireEnabled: false });
    if (!botToken) throw new Error('Zalo provider is not configured');

    const { response, body } = await postJsonWithTimeout(
      `${buildZaloBotBaseUrl(apiBase, botToken)}/getMe`,
      {},
      timeoutMs,
    );
    assertZaloApiSuccess(response, body, 'getMe');
    return body;
  }

  async setWebhook(
    tenantId: string | undefined,
    payload: { url: string; secretToken: string },
  ) {
    const { botToken, apiBase, timeoutMs } = await this.resolveSettings(tenantId, { requireEnabled: false });
    if (!botToken) throw new Error('Zalo provider is not configured');
    if (!payload.url || !payload.secretToken) {
      throw new Error('Missing Zalo webhook URL or secret token');
    }

    const { response, body } = await postJsonWithTimeout(
      `${buildZaloBotBaseUrl(apiBase, botToken)}/setWebhook`,
      {
        url: payload.url,
        secret_token: payload.secretToken,
      },
      timeoutMs,
    );
    assertZaloApiSuccess(response, body, 'setWebhook');
    return body;
  }

  async getWebhookInfo(tenantId?: string) {
    const { botToken, apiBase, timeoutMs } = await this.resolveSettings(tenantId, { requireEnabled: false });
    if (!botToken) throw new Error('Zalo provider is not configured');

    const { response, body } = await postJsonWithTimeout(
      `${buildZaloBotBaseUrl(apiBase, botToken)}/getWebhookInfo`,
      {},
      timeoutMs,
    );
    assertZaloApiSuccess(response, body, 'getWebhookInfo');
    return body;
  }

  async deleteWebhook(tenantId?: string) {
    const { botToken, apiBase, timeoutMs } = await this.resolveSettings(tenantId, { requireEnabled: false });
    if (!botToken) throw new Error('Zalo provider is not configured');

    const { response, body } = await postJsonWithTimeout(
      `${buildZaloBotBaseUrl(apiBase, botToken)}/deleteWebhook`,
      {},
      timeoutMs,
    );
    assertZaloApiSuccess(response, body, 'deleteWebhook');
    return body;
  }

  async getUpdates(
    tenantId: string | undefined,
    payload: { offset?: number; limit?: number; timeout?: number } = {},
  ) {
    const { botToken, apiBase, timeoutMs } = await this.resolveSettings(tenantId, { requireEnabled: false });
    if (!botToken) throw new Error('Zalo provider is not configured');

    const { response, body } = await postJsonWithTimeout(
      `${buildZaloBotBaseUrl(apiBase, botToken)}/getUpdates`,
      {
        ...(payload.offset !== undefined ? { offset: payload.offset } : {}),
        ...(payload.limit !== undefined ? { limit: payload.limit } : {}),
        ...(payload.timeout !== undefined ? { timeout: payload.timeout } : {}),
      },
      Math.max(timeoutMs, ((payload.timeout || 0) + 5) * 1000),
    );
    const updates = extractZaloUpdates(body);
    if (!response.ok) {
      throw new Error(pickZaloApiErrorMessage(body) || `Zalo getUpdates failed with ${response.status}`);
    }

    if (updates.length > 0) {
      return {
        ...(body && typeof body === 'object' && !Array.isArray(body) ? body : {}),
        result: updates,
      };
    }

    if (isPollingTimeout(body)) {
      this.logger.log({
        message: 'Zalo getUpdates returned polling timeout with no pending updates',
        tenantId,
        status: response.status,
      });
      return {
        ...(body && typeof body === 'object' && !Array.isArray(body) ? body : {}),
        result: [],
      };
    }

    if (isExplicitZaloApiFailure(body)) {
      throw new Error(pickZaloApiErrorMessage(body) || `Zalo getUpdates failed with ${response.status}`);
    }

    this.logger.log({
      message: 'Zalo getUpdates returned an empty or non-standard success payload',
      tenantId,
      status: response.status,
      bodyKeys: body && typeof body === 'object' && !Array.isArray(body) ? Object.keys(body).slice(0, 12) : [],
    });

    return {
      ...(body && typeof body === 'object' && !Array.isArray(body) ? body : {}),
      result: [],
    };
  }

  async send(payload: ProviderPayload): Promise<any> {
    const { botToken, apiBase, timeoutMs } = await this.resolveSettings(payload.tenantId);
    const recipient = resolveRecipient(payload, ['zaloChatId', 'customerZaloChatId', 'chatId', 'zaloUserId', 'customerZaloUserId']);

    if (!botToken || !recipient) {
      throw new Error('Zalo provider is not configured');
    }
    if (looksLikePhoneNumber(recipient)) {
      throw new Error('Zalo Bot requires chat_id or user_id. Current recipient looks like a phone number.');
    }

    const qrUrl = String(payload.context?.qrUrl || payload.photo || '').trim();
    const title = (payload.title || '').trim();
    const message = (payload.message || '').trim();
    const text = message
      ? (title && !message.startsWith(title) ? `${title}\n\n${message}` : message)
      : title;

    // 1. Send main message
    const { response, body } = await postJsonWithTimeout(
      `${buildZaloBotBaseUrl(apiBase, botToken)}/sendMessage`,
      {
        chat_id: recipient,
        text,
      },
      timeoutMs,
    );
    assertZaloApiSuccess(response, body, 'send');

    // 2. If QR URL is present, send QR photo
    if (qrUrl) {
      try {
        const bankLine = [payload.context?.bankAccountNumber, payload.context?.bankName].filter(Boolean).join(' / ');
        const holderLine = payload.context?.accountHolder || '';
        const ndLine = payload.context?.paymentCode ? `ND: ${payload.context.paymentCode}` : '';
        const captionLines = [bankLine, holderLine, ndLine].filter(Boolean);
        const caption = captionLines.length > 0
          ? captionLines.join('\n')
          : `Mã VietQR thanh toán ${payload.context?.invoiceCode || payload.context?.paymentCode || ''}`;

        await postJsonWithTimeout(
          `${buildZaloBotBaseUrl(apiBase, botToken)}/sendPhoto`,
          {
            chat_id: recipient,
            photo: qrUrl,
            caption,
          },
          timeoutMs,
        );
      } catch (err) {
        this.logger.warn(`Failed to send QR photo via Zalo: ${err.message}`);
      }
    }

    return { success: true, zaloResponse: body };
  }

  async sendPhoto(payload: ProviderPayload): Promise<any> {
    const { botToken, apiBase, timeoutMs } = await this.resolveSettings(payload.tenantId);
    const recipient = resolveRecipient(payload, ['zaloChatId', 'customerZaloChatId', 'chatId', 'zaloUserId', 'customerZaloUserId']);
    const photo = String(payload.photo || '').trim();
    const caption = String(payload.caption || payload.message || '').trim();

    if (!botToken || !recipient) {
      throw new Error('Zalo provider is not configured');
    }
    if (looksLikePhoneNumber(recipient)) {
      throw new Error('Zalo Bot requires chat_id or user_id. Current recipient looks like a phone number.');
    }
    if (!photo) {
      throw new Error('Zalo photo URL is required');
    }

    const { response, body } = await postJsonWithTimeout(
      `${buildZaloBotBaseUrl(apiBase, botToken)}/sendPhoto`,
      {
        chat_id: recipient,
        photo,
        ...(caption ? { caption } : {}),
      },
      timeoutMs,
    );
    assertZaloApiSuccess(response, body, 'sendPhoto');

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
