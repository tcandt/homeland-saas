import { HttpException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import nodemailer from 'nodemailer';
import { EmailProvider, TelegramProvider, ZaloProvider, SMSProvider, PushProvider, InAppProvider } from './communication.providers';

describe('external communication staging guard', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it.each([
    { DEPLOY_ENV: 'staging', COMMUNICATION_EXTERNAL_DELIVERY_ENABLED: 'true' },
    { DEPLOY_ENV: 'production', COMMUNICATION_EXTERNAL_DELIVERY_ENABLED: 'false' },
  ])('blocks all direct and management paths before settings or network access: %j', async (env) => {
    vi.stubEnv('DEPLOY_ENV', env.DEPLOY_ENV);
    vi.stubEnv('COMMUNICATION_EXTERNAL_DELIVERY_ENABLED', env.COMMUNICATION_EXTERNAL_DELIVERY_ENABLED);
    const prisma = { appSetting: { findUnique: vi.fn() } };
    const network = vi.fn();
    vi.stubGlobal('fetch', network);
    const smtp = vi.spyOn(nodemailer, 'createTransport');
    const zalo = new ZaloProvider(prisma as any);
    const payload = { tenantId: 'synthetic-tenant', recipient: 'synthetic-chat', photo: 'https://example.invalid/qr.png' };
    const paths = [
      () => new EmailProvider(prisma as any).send(payload),
      () => new TelegramProvider(prisma as any).send(payload),
      () => zalo.send(payload), () => zalo.sendPhoto(payload),
      () => zalo.getMe(payload.tenantId), () => zalo.getWebhookInfo(payload.tenantId),
      () => zalo.getUpdates(payload.tenantId),
      () => zalo.setWebhook(payload.tenantId, { url: 'https://example.invalid', secretToken: 'synthetic' }),
      () => zalo.deleteWebhook(payload.tenantId),
      () => new SMSProvider().send(payload), () => new PushProvider().send(payload),
    ];
    for (const call of paths) {
      const error = await call().catch((value) => value);
      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(503);
      expect(error.getResponse()).toMatchObject({
        code: env.DEPLOY_ENV === 'staging'
          ? 'EXTERNAL_PROVIDER_DISABLED_IN_STAGING'
          : 'EXTERNAL_PROVIDER_DISABLED_IN_ENVIRONMENT',
      });
    }
    expect(prisma.appSetting.findUnique).not.toHaveBeenCalled();
    expect(network).not.toHaveBeenCalled();
    expect(smtp).not.toHaveBeenCalled();
  });

  it('keeps in-app delivery available on staging', async () => {
    vi.stubEnv('DEPLOY_ENV', 'staging');
    const events = { emit: vi.fn() };
    await expect(new InAppProvider(events as any).send({ title: 'Synthetic' })).resolves.toMatchObject({ success: true });
    expect(events.emit).toHaveBeenCalledOnce();
  });
});
