import { expect } from '@playwright/test';
import { test } from '../../fixtures/admin.fixture';

test.describe('Tenant desktop layout', () => {
  test.beforeEach(async ({ admin }, testInfo) => {
    test.skip(!/Desktop|Laptop/.test(testInfo.project.name), 'Desktop-only regression');
    await admin.page.goto('/tenants', { waitUntil: 'domcontentloaded' });
  });

  test('uses row navigation and a collapsible tenant overview panel', async ({ admin }) => {
    await expect(admin.page.getByTestId('tenants-list').filter({ visible: true }).first()).toBeVisible();
    await expect(admin.page.getByText('Thao tác', { exact: true })).toHaveCount(0);

    const firstTenant = admin.page.getByTestId('tenant-card').filter({ visible: true }).first();
    await expect(firstTenant).toBeVisible();
    await expect(firstTenant).toHaveAttribute('role', 'button');
    await expect(firstTenant).toHaveAttribute('tabindex', '0');

    const panel = admin.page.getByTestId('tenants-side-panel');
    const toggle = admin.page.getByTestId('tenants-side-panel-toggle');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(panel.getByRole('heading', { name: 'Tình hình khách thuê' })).toBeVisible();

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });
});
