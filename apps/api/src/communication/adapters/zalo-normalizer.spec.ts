import { describe, expect, it } from 'vitest';
import { buildTenantWebhookUrl } from './zalo-normalizer';

describe('buildTenantWebhookUrl', () => {
  it('normalizes a base URL that was saved with an API route already attached', () => {
    expect(buildTenantWebhookUrl({
      webhookBaseUrl: 'https://homeland.example/api/v1/payments/sepay/webhook',
    })).toBe('https://homeland.example/api/v1/notifications/zalo/webhook');
  });

  it('prefers the current base URL over a stale legacy webhook URL', () => {
    expect(buildTenantWebhookUrl({
      baseUrl: 'https://live.example',
      webhookBaseUrl: 'https://stale.example',
    })).toBe('https://live.example/api/v1/notifications/zalo/webhook');
  });

  it('falls back from a blank current base URL to the legacy URL', () => {
    expect(buildTenantWebhookUrl({
      baseUrl: '   ',
      webhookBaseUrl: ' https://legacy.example/ ',
    })).toBe('https://legacy.example/api/v1/notifications/zalo/webhook');
  });
});
