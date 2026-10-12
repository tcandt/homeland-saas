import { expect } from '@playwright/test';
import { test } from '../../fixtures/rbac.fixture';

const apiBaseUrl = process.env.E2E_API_BASE_URL || 'http://127.0.0.1:3001';

test.describe('Settings RBAC Desktop Regression', () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(!/Desktop|Laptop/.test(testInfo.project.name), 'Desktop-only regression');
  });

  test('blocks manager from Settings in both API and UI', async ({ manager }) => {
    const response = await manager.api.get(`${apiBaseUrl}/api/v1/settings/owners?scope=TENANT`);
    expect(response.status()).toBe(403);

    await manager.page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await expect(manager.page.getByTestId('settings-access-denied')).toBeVisible();
    await expect(manager.page.getByTestId('sidebar-nav-settings')).toHaveCount(0);
  });

  test('allows system admin to read provider summaries and edit permitted integration fields', async ({ admin }) => {
    const response = await admin.api.get(`${apiBaseUrl}/api/v1/settings/owners?scope=TENANT`);
    expect(response.ok()).toBeTruthy();

    await admin.page.goto('/settings?section=integrations', { waitUntil: 'domcontentloaded' });
    const secretFields = admin.page.getByTestId('integration-secret-field');
    await expect(secretFields).toHaveCount(6);
    for (let index = 0; index < 5; index += 1) {
      await expect(secretFields.nth(index)).toBeDisabled();
    }
    await expect(secretFields.nth(5)).toBeEnabled();

    const sePaySummary = admin.page
      .getByText('Tích hợp Webhook & Cấu hình SePay', { exact: true })
      .locator('..');
    await sePaySummary.getByRole('button', { name: 'Thiết lập cấu hình', exact: true }).click();
    await expect(admin.page.getByText('Thiết lập cấu hình SePay Gateway', { exact: true })).toBeVisible();
    await expect(admin.page.getByPlaceholder('Nhập API key')).toBeEnabled();
    await admin.page.getByRole('button', { name: 'Hủy bỏ', exact: true }).click();

    const zaloSummary = admin.page
      .getByText('Tích hợp Webhook & Zalo Bot', { exact: true })
      .locator('..');
    await zaloSummary.getByRole('button', { name: 'Thiết lập cấu hình', exact: true }).click();
    await expect(admin.page.getByText('Thiết lập cấu hình Zalo Provider & Webhook', { exact: true })).toBeVisible();
    await expect(admin.page.getByPlaceholder('Dán Bot Token từ Zalo Developer / Bot Platform')).toBeEnabled();
    await admin.page.getByRole('button', { name: 'Hủy bỏ', exact: true }).click();
  });

  test('shows the account directory for the system admin', async ({ admin }) => {
    const response = await admin.api.get(`${apiBaseUrl}/api/v1/auth/team`);
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    const accounts = body.data || body;
    const emails = accounts.map((item: any) => item.email.toLowerCase());

    expect(emails).toEqual(expect.arrayContaining([
      'manager@homeland.local',
      'admin@homeland.vn',
    ]));
    expect(accounts.every((item: any) => !('passwordHash' in item) && !('refreshTokenHash' in item))).toBeTruthy();

    await admin.page.goto('/settings?section=team', { waitUntil: 'domcontentloaded' });
    const directory = admin.page.getByTestId('settings-team-real-data');
    await expect(directory).toBeVisible();
    await expect(directory).toContainText('manager@homeland.local');
    await expect(directory).toContainText('admin@homeland.vn');
    await expect(directory).not.toContainText('adminA@homeland.local');
    await expect(directory).not.toContainText('adminB@homeland.local');
    await expect(directory).not.toContainText('Permission Matrix');
    await expect(directory.getByRole('button', { name: /Thêm thành viên|Lưu phân quyền/ })).toHaveCount(0);
  });
});
