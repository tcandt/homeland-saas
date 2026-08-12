import { expect } from '@playwright/test';
import { test } from '../../fixtures/admin.fixture';

async function mockHunonicSettings(page: any) {
  await page.route('**/api/v1/settings/hunonic*', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          key: 'hunonic',
          scope: 'TENANT',
          value: {
            enabled: true,
            mode: 'mobile',
            username: 'admin',
            password: 'secret-value',
            baseUrl: 'https://api.hunonicpro.com/v2',
            timeoutMs: 15000,
            syncIntervalMinutes: 60,
            retentionYears: 3,
          },
          updatedAt: '2026-08-12T10:00:00.000Z',
        },
      }),
    });
  });

  await page.route('**/api/v1/hunonic/overview*', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { summary: { totalMeters: 14, onlineMeters: 14 }, latestLog: null } }),
    });
  });

  await page.route('**/api/v1/hunonic/rates*', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { summary: { totalMeters: 14, residentialMeters: 0, customMeters: 14 }, rows: [], residentialTemplate: [] } }),
    });
  });

  await page.route('**/api/v1/hunonic/history*', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { summary: {}, filters: { rooms: [], lockedPeriods: [] }, monthlyRows: [], qualityAlerts: [], readings: [], pagination: { page: 1, limit: 25, total: 0, totalPages: 1 } } }),
    });
  });

  await page.route('**/api/v1/hunonic/reconciliation*', async (route: any) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { summary: {}, rows: [] } }) });
  });
}

test.describe('Hunonic Permissions Desktop Regression', () => {
  test.beforeEach(async ({ admin }, testInfo) => {
    test.skip(!/Desktop|Laptop/.test(testInfo.project.name), 'Desktop-only regression');
    await mockHunonicSettings(admin.page);
  });

  test('locks secrets for the regular admin and keeps operational controls available', async ({ admin }) => {
    await admin.page.goto('/settings?section=hunonic', { waitUntil: 'domcontentloaded' });

    const main = admin.page.locator('main');
    const secret = main.locator('input[type="password"]');
    await expect(secret).toHaveCount(1);
    await expect(secret).toBeDisabled();
    await expect(main.getByText('Chỉ owner admin A/B được chỉnh sửa token hoặc mật khẩu tích hợp Hunonic.')).toBeVisible();
    await expect(main.getByRole('button', { name: 'Kiểm tra kết nối' })).toBeEnabled();
    await expect(main.getByRole('button', { name: 'Đồng bộ ngay' })).toBeEnabled();
    await expect(main.getByRole('button', { name: 'Lưu cấu hình' })).toBeEnabled();
    await expect(main).toContainText('Kiểm tra dữ liệu đồng bộ 3 năm');
    await expect(main).toContainText('Mở thiết lập giá');
    await expect(main).not.toContainText('Check Connection');
    await expect(main).not.toContainText('Open Rate Settings');
  });
});
