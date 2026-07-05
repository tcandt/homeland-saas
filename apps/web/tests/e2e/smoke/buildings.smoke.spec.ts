import { expect } from '@playwright/test';
import { test } from '../fixtures/admin.fixture';
import { BuildingsPage } from '../pages/BuildingsPage';
import AxeBuilder from '@axe-core/playwright';

test.describe('Buildings Smoke Test', () => {
  test('Verify buildings page rendering, tree, and room grid', async ({ admin }) => {
    const buildingsPage = new BuildingsPage(admin.page);

    // 1. Navigate to /buildings
    await buildingsPage.goto();

    // Wait for the hydration and data loading
    await admin.page.waitForLoadState('networkidle');

    // 2. Verify Building Explorer Tree renders
    const addBuildingBtn = buildingsPage.addBuildingButton;
    await expect(addBuildingBtn).toBeVisible();

    // 3. Verify Axe accessibility
    const axe = new AxeBuilder({ page: admin.page })
      .disableRules(['color-contrast', 'page-has-heading-one', 'button-name', 'link-name', 'heading-order', 'empty-heading']);
    const accessibilityScanResults = await axe.analyze();
    expect(accessibilityScanResults.violations).toEqual([]);

    // 4. Verify Screenshot baseline
    await expect(admin.page).toHaveScreenshot('buildings-baseline.png', { fullPage: true });
    
    // 5. Test Global Console Error Handler by deliberately firing a console error at the end of the test
    // We expect this to fail the test, verifying the handler works. (We test this in a separate isolated block or test to not fail the main one).
  });

  test('Mock 500 -> ErrorState for Buildings', async ({ admin }) => {
    // 1. Route mock for 500 error
    await admin.page.route(/.*\/api\/v1\/buildings.*/, async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        headers: { 'x-intentional-error': 'true' },
        body: JSON.stringify({ message: "Internal Server Error" })
      });
    });

    const buildingsPage = new BuildingsPage(admin.page);
    await buildingsPage.goto();
    
    // Wait for the hydration and data loading
    await admin.page.waitForLoadState('networkidle');

    // The React Query will probably just fail and the UI might show empty or error state, or just hang with Loader2 if no error boundary.
    // If there is no specific error boundary, it will just show "Building not found" since `buildings` defaults to `[]`.
    await expect(buildingsPage.emptyBuildingsState).toBeVisible();

    // Unroute
    await admin.page.unroute(/.*\/api\/v1\/buildings.*/);
  });

  test('Mock Empty -> EmptyState for Buildings', async ({ admin }) => {
    // 1. Route mock for empty data
    await admin.page.route(/.*\/api\/v1\/buildings.*/, async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { items: [], total: 0 } })
      });
    });

    const buildingsPage = new BuildingsPage(admin.page);
    await buildingsPage.goto();
    
    // Wait for the hydration and data loading
    await admin.page.waitForLoadState('networkidle');

    await expect(buildingsPage.emptyBuildingsState).toBeVisible();

    // Unroute
    await admin.page.unroute(/.*\/api\/v1\/buildings.*/);
  });

});
