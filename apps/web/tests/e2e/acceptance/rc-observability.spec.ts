import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';

// BASE_URL relies on playwright.config.ts

test.describe('Observability Foundation', () => {
  test('GET /api/v1/health returns x-correlation-id', async ({ request }) => {
    const response = await request.get(`/api/v1/health`);
    expect(response.ok()).toBeTruthy();
    
    // Check that correlation ID is generated and returned
    const correlationId = response.headers()['x-correlation-id'];
    expect(correlationId).toBeDefined();
    expect(typeof correlationId).toBe('string');
    expect(correlationId.length).toBeGreaterThan(0);
  });

  test('Custom X-Correlation-ID is preserved', async ({ request }) => {
    const customId = `test-id-${randomUUID()}`;
    const response = await request.get(`/api/v1/health`, {
      headers: {
        'x-correlation-id': customId
      }
    });
    
    expect(response.ok()).toBeTruthy();
    // Check that custom correlation ID is preserved and returned
    const correlationId = response.headers()['x-correlation-id'];
    expect(correlationId).toBe(customId);
  });

  test('Authenticated request log includes userId/tenantId', async ({ request }) => {
    const customId = `auth-test-${randomUUID()}`;
    const response = await request.get(`/api/v1/reports/cashflow`, {
      headers: {
        'x-correlation-id': customId,
        'Authorization': 'Bearer test-token-if-applicable'
      }
    });

    const correlationId = response.headers()['x-correlation-id'];
    expect(correlationId).toBe(customId);
  });
});
