import { expect } from '@playwright/test';
import { test } from '../../fixtures/admin.fixture';

test.describe('Settings password change desktop regression', () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(!/Desktop|Laptop/.test(testInfo.project.name), 'Desktop-only regression');
  });

  test('submits the real password-change payload and clears the local session', async ({ admin }) => {
    let payload: Record<string, unknown> | null = null;
    await admin.page.route('**/api/v1/auth/change-password', async (route) => {
      payload = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { success: true } }),
      });
    });

    await admin.page.goto('/settings?section=security', { waitUntil: 'domcontentloaded' });
    await admin.page.getByTestId('settings-current-password').fill('CurrentPassword@123');
    await admin.page.getByTestId('settings-new-password').fill('NewPassword@456');
    await admin.page.getByTestId('settings-confirm-password').fill('NewPassword@456');
    await admin.page.getByTestId('settings-change-password-submit').click();

    await expect.poll(() => payload).toEqual({
      oldPassword: 'CurrentPassword@123',
      newPassword: 'NewPassword@456',
      confirmPassword: 'NewPassword@456',
    });
    await expect(admin.page).toHaveURL(/\/login$/);
    await expect.poll(() => admin.page.evaluate(() => {
      const stored = localStorage.getItem('auth-storage');
      return stored ? JSON.parse(stored).state?.isAuthenticated : null;
    })).toBe(false);
  });
});
