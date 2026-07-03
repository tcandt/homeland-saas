import { expect } from '@playwright/test';
import { test } from '../fixtures/admin.fixture';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import AxeBuilder from '@axe-core/playwright';

test.describe('Auth and Dashboard Smoke Test', () => {
  test('Login, verify dashboard rendering, and logout', { tag: '@smoke' }, async ({ admin }, testInfo) => {
    // 1. Storage state verification is implicit: if we can access the dashboard directly without UI login, it worked.
    const dashboardPage = new DashboardPage(admin.page);
    
    // 2. Mock 500 to verify ErrorState + Retry
    await admin.page.route(/.*\/api\/v1\/dashboard.*/, async route => {
      await route.fulfill({ 
        status: 500, 
        headers: { 'x-intentional-error': 'true' },
        body: 'Internal Server Error' 
      });
    });
    
    await dashboardPage.goto();

    // Verify Error State
    await expect(admin.page.getByText('Không thể tải dữ liệu Dashboard. Vui lòng thử lại.')).toBeVisible({ timeout: 15000 });
    const retryBtn = admin.page.getByRole('button', { name: 'Thử lại' });
    await expect(retryBtn).toBeVisible();

    // Unroute so the next fetch succeeds
    await admin.page.unroute(/.*\/api\/v1\/dashboard.*/);

    // Click Retry
    await retryBtn.click();

    // 3. Verify Dashboard loads successfully
    await dashboardPage.verifyDashboardLoaded();
    
    // Verify KPI visible
    await dashboardPage.verifyKpiVisible();
    await dashboardPage.verifyHeaderVisible();
    await dashboardPage.verifySidebarVisible();
    
    // 4. Accessibility test (Axe)
    const accessibilityScanResults = await new AxeBuilder({ page: admin.page })
      .disableRules(['color-contrast', 'page-has-heading-one', 'link-name', 'button-name'])
      .analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
    
    // 5. Visual Regression Baseline
    // Take a screenshot of the dashboard.
    // It will be saved as 'dashboard-baseline.png' or similar for future diffing.
    await expect(admin.page).toHaveScreenshot('dashboard-baseline.png', { fullPage: true });

    // 6. Test Global Console Handler by deliberately firing a console error at the end of the test.
    // We expect this to fail the test, verifying the handler works.
    // But since we want this test to PASS overall, we can't intentionally fail the main test.
    // Let's create a separate test case in this suite for verifying the console handler.

    // Logout
    await dashboardPage.logout();
    
    // Redirect to login
    const loginPage = new LoginPage(admin.page);
    await loginPage.page.waitForURL('**/login');
  });

  // This test expects to fail due to the global console error handler.
  test.fail('Verify Global Console Error Handler fails the test', { tag: '@smoke' }, async ({ admin }) => {
    const dashboardPage = new DashboardPage(admin.page);
    await dashboardPage.goto();
    
    await admin.page.evaluate(() => {
      console.error("Playwright Test: Intended Error");
    });

    // Wait slightly to ensure console event is caught by Node
    await admin.page.waitForTimeout(200);
  });
});
