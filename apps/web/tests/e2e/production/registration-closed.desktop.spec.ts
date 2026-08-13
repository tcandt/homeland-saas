import { expect, test } from '@playwright/test';

const apiBaseUrl = process.env.E2E_API_BASE_URL || 'http://127.0.0.1:3001';

test.describe('Production registration gate', () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'Desktop 1920', 'Desktop production audit');
  });

  test('keeps public registration closed in both API and UI', async ({ page, request }) => {
    const response = await request.post(`${apiBaseUrl}/api/v1/auth/register`, {
      data: {},
    });
    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body.error?.code).toBe('AUTH_REGISTRATION_DISABLED');

    await page.goto('/register', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Đăng ký đang đóng' })).toBeVisible();
    await expect(page.getByText('Tài khoản được cấp bởi quản trị viên hệ thống.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tạo tài khoản' })).toHaveCount(0);
  });

  test('adds and preserves the web correlation ID', async ({ request }) => {
    const generatedResponse = await request.get('/login');
    expect(generatedResponse.ok()).toBeTruthy();
    expect(generatedResponse.headers()['x-correlation-id']).toMatch(/^[0-9a-f-]{36}$/i);

    const upstreamId = 'production-gate-correlation-id';
    const preservedResponse = await request.get('/login', {
      headers: { 'x-correlation-id': upstreamId },
    });
    expect(preservedResponse.ok()).toBeTruthy();
    expect(preservedResponse.headers()['x-correlation-id']).toBe(upstreamId);
  });
});
