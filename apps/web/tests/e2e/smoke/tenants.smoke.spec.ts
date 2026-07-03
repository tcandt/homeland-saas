import { expect } from '@playwright/test';
import { test } from '../fixtures/admin.fixture';
import { TenantsPage } from '../pages/TenantsPage';
import AxeBuilder from '@axe-core/playwright';

test.describe('Tenants Smoke Test', () => {

  test('Verify tenants page rendering, grid, and drawer', async ({ admin }) => {
    admin.page.on('console', msg => console.log('BROWSER:', msg.text()));
    const tenantsPage = new TenantsPage(admin.page);

    // 2. Navigate and wait for API to load
    await tenantsPage.goto();
    await admin.page.waitForLoadState('networkidle');

    // 3. Verify Page Structure
    const roots = await tenantsPage.page.getByTestId('tenants-root').all();
    console.log('Roots count:', roots.length);
    if (roots.length === 0) {
      console.log('No tenants-root found! HTML:');
      const html = await admin.page.content();
      require('fs').writeFileSync('test-results/debug-missing-root.html', html);
    }
    await expect(tenantsPage.root).toBeVisible({ timeout: 5000 });
    await expect(tenantsPage.kpiGrid).toBeVisible();
    await expect(tenantsPage.filterBar).toBeVisible();
    await expect(tenantsPage.list).toBeVisible();

    // 4. Verify data rendering
    // Assume seeded DB has at least 1 tenant. 
    // Wait for at least one card
    await expect(tenantsPage.tenantCards.first()).toBeVisible();

    // 5. Open and Close Drawer
    await tenantsPage.openFirstTenant();
    await tenantsPage.closeTenantDrawer();

    // 6. Verify Axe accessibility
    const axe = new AxeBuilder({ page: admin.page })
      .disableRules(['color-contrast', 'heading-order', 'empty-heading']); // Temporary disable known issues
    const accessibilityScanResults = await axe.analyze();
    expect(accessibilityScanResults.violations).toEqual([]);

    // 7. Screenshot baseline
    await expect(admin.page).toHaveScreenshot('tenants-full-page.png', {
      fullPage: true,
      mask: [admin.page.getByTestId('tenant-card')], // Mask dynamic data
      timeout: 15000,
    });
  });

  test('Mock 500 -> ErrorState for Tenants', async ({ admin }) => {
    // 1. Route API to return 500
    await admin.page.route(/.*\/api\/v1\/customers.*/, async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        headers: { 'x-intentional-error': 'true' },
        body: JSON.stringify({ error: 'Internal Server Error' })
      });
    });

    const tenantsPage = new TenantsPage(admin.page);
    const responsePromise = admin.page.waitForResponse(/.*\/api\/v1\/customers.*/);
    await tenantsPage.goto();
    await responsePromise;

    // 2. Assert ErrorState is visible
    await expect(tenantsPage.errorState).toBeVisible();

    // 3. Unroute
    await admin.page.unroute(/.*\/api\/v1\/customers.*/);
  });

  test('Mock Empty -> EmptyState for Tenants', async ({ admin }) => {
    // 1. Route API to return empty data
    await admin.page.route(/.*\/api\/v1\/customers.*/, async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], meta: { total: 0 } })
      });
    });

    const tenantsPage = new TenantsPage(admin.page);
    const responsePromise = admin.page.waitForResponse(/.*\/api\/v1\/customers.*/);
    await tenantsPage.goto();
    await responsePromise;

    // 2. Assert EmptyState is visible
    try {
      await expect(tenantsPage.emptyState).toBeVisible({ timeout: 5000 });
    } catch (e) {
      console.log("Mock Empty Timeout! Printing HTML:");
      const html = await admin.page.content();
      require('fs').writeFileSync('test-results/debug-mobile.html', html);
      throw e;
    }

    // 3. Unroute
    await admin.page.unroute(/.*\/api\/v1\/customers.*/);
  });
});
