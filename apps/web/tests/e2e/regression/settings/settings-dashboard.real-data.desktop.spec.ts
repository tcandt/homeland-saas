import { expect } from '@playwright/test';
import { test } from '../../fixtures/admin.fixture';

async function mockSettingsDashboard(page: any) {
  const settings: Record<string, Record<string, unknown>> = {
    owners: { ownerAName: 'Tính', ownerBName: 'Thể' },
    team: {},
    'invoice-rules': {},
    'email-provider': {},
    sepay: { webhookUrl: 'https://example.test/sepay' },
    'zalo-provider': { enabled: true },
    hunonic: { enabled: true },
  };

  await page.route('**/api/v1/settings/*', async (route: any) => {
    const key = route.request().url().split('/settings/')[1]?.split('?')[0] || '';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          key,
          scope: 'TENANT',
          value: settings[key] || {},
          updatedAt: '2026-08-12T10:00:00.000Z',
        },
      }),
    });
  });

  await page.route('**/api/v1/audit/logs*', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [
          {
            id: 'audit-real-1',
            createdAt: '2026-08-12T10:05:00.000Z',
            module: 'Settings',
            action: 'UPDATE',
            entity: 'Owner',
            entityId: 'owner-a',
            userId: 'admin-1',
            user: { id: 'admin-1', email: 'admin@homeland.local', fullName: 'Admin dữ liệu thật' },
            ip: '127.0.0.1',
            userAgent: 'Playwright',
            before: null,
            after: null,
          },
        ],
      }),
    });
  });
}

test.describe('Settings Real Data Desktop Regression', () => {
  test.beforeEach(async ({ admin }, testInfo) => {
    test.skip(!/Desktop|Laptop/.test(testInfo.project.name), 'Desktop-only regression');
    await mockSettingsDashboard(admin.page);
  });

  test('shows configured integrations and real audit data without demo content', async ({ admin }) => {
    await admin.page.goto('/settings', { waitUntil: 'domcontentloaded' });

    const main = admin.page.locator('main');
    await expect(main).toContainText('SePayThanh toánĐã cấu hình');
    await expect(main).toContainText('Email SMTPGửi emailChưa cấu hình');
    await expect(main).toContainText('HunonicĐiện & IoTĐã cấu hình');
    await expect(main).toContainText('Admin dữ liệu thật');
    await expect(main).not.toContainText('Thông tin doanh nghiệp');
    await expect(main).not.toContainText('Trần Văn An');

    await admin.page.getByRole('button', { name: 'Nhật ký hệ thống' }).click();
    await expect(admin.page.getByText('Nhật ký hoạt động', { exact: true })).toBeVisible();
    await expect(main).toContainText('Admin dữ liệu thật');
    await expect(main).toContainText('Settings');
    await expect(main).toContainText('Cập nhật');
    await expect(main).toContainText('owner-a');
  });
});
