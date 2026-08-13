import { expect } from '@playwright/test';
import { test } from '../../fixtures/rbac.fixture';

test.describe('Settings RBAC Desktop Regression', () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(!/Desktop|Laptop/.test(testInfo.project.name), 'Desktop-only regression');
  });

  test('blocks manager from Settings in both API and UI', async ({ manager }) => {
    const response = await manager.api.get('http://127.0.0.1:3001/api/v1/settings/owners?scope=TENANT');
    expect(response.status()).toBe(403);

    await manager.page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await expect(manager.page.getByTestId('settings-access-denied')).toBeVisible();
    await expect(manager.page.getByTestId('sidebar-nav-settings')).toHaveCount(0);
  });

  test('allows owner admins to read Settings and edit integration secret fields', async ({ ownerAdminA, ownerAdminB }) => {
    for (const ownerAdmin of [ownerAdminA, ownerAdminB]) {
      const response = await ownerAdmin.api.get('http://127.0.0.1:3001/api/v1/settings/owners?scope=TENANT');
      expect(response.ok()).toBeTruthy();

      await ownerAdmin.page.goto('/settings?section=integrations', { waitUntil: 'domcontentloaded' });
      const secretFields = ownerAdmin.page.getByTestId('integration-secret-field');
      await expect(secretFields).toHaveCount(5);
      for (let index = 0; index < 5; index += 1) {
        await expect(secretFields.nth(index)).toBeEnabled();
      }
    }
  });

  test('shows the real account directory to the full-access account', async ({ admin }) => {
    const response = await admin.api.get('http://127.0.0.1:3001/api/v1/auth/team');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    const accounts = body.data || body;
    const emails = accounts.map((item: any) => item.email.toLowerCase());

    expect(emails).toEqual(expect.arrayContaining([
      'manager@homeland.local',
      'admina@homeland.local',
      'adminb@homeland.local',
      'admin@homeland.local',
    ]));
    expect(accounts.every((item: any) => !('passwordHash' in item) && !('refreshTokenHash' in item))).toBeTruthy();

    await admin.page.goto('/settings?section=team', { waitUntil: 'domcontentloaded' });
    const directory = admin.page.getByTestId('settings-team-real-data');
    await expect(directory).toBeVisible();
    await expect(directory).toContainText('manager@homeland.local');
    await expect(directory).toContainText('adminA@homeland.local');
    await expect(directory).toContainText('adminB@homeland.local');
    await expect(directory).toContainText('admin@homeland.local');
    await expect(directory).not.toContainText('Permission Matrix');
    await expect(directory.getByRole('button', { name: /Thêm thành viên|Lưu phân quyền/ })).toHaveCount(0);
  });
});
