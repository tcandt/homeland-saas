import { describe, expect, it } from 'vitest';
import { buildTenantWebhookUrl } from './zalo-normalizer';

describe('buildTenantWebhookUrl', () => {
  it('normalizes a base URL that was saved with an API route already attached', () => {
    expect(buildTenantWebhookUrl({
      webhookBaseUrl: 'https://homeland.example/api/v1/payments/sepay/webhook',
    })).toBe('https://homeland.example/api/v1/notifications/zalo/webhook');
  });
});
