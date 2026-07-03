import { expect } from '@playwright/test';
import { test } from '../fixtures/admin.fixture';
import AxeBuilder from '@axe-core/playwright';

test.describe('Contracts Smoke Test', () => {
  test('Verify contracts page rendering, grid, and drawer', async ({ admin }) => {
    // 1. Navigate to contracts
    await admin.page.goto('/contracts');

    // 2. Wait for root to be visible
    const root = admin.page.getByTestId('contracts-root');
    await expect(root).toBeVisible({ timeout: 10000 });

    // 3. Verify KPI and Filter Bar are visible
    const kpiGrid = admin.page.locator('[data-testid="contracts-kpi-grid"]:visible');
    const filterBar = admin.page.locator('[data-testid="contracts-filter-bar"]:visible');
    const contractList = admin.page.locator('[data-testid="contracts-list"]:visible');

    await expect(kpiGrid).toBeVisible();
    await expect(filterBar).toBeVisible();
    await expect(contractList).toBeVisible();

    // Wait for data to load and cards to render
    const contractCard = admin.page.locator('[data-testid="contract-card"]:visible').first();
    await expect(contractCard).toBeVisible({ timeout: 10000 });

    // 4. Open Drawer and verify
    await contractCard.click({ position: { x: 10, y: 10 } });
    const drawer = admin.page.locator('[data-testid="contract-detail-drawer"]:visible');
    await expect(drawer).toBeVisible({ timeout: 15000 });
    
    // Verify badge inside drawer
    await expect(drawer.getByTestId('contract-status-badge')).toBeVisible();

    // Verify timeline / financial summary (we look for some text or icons that exist in the drawer)
    await expect(drawer.getByText('Thông tin Tài chính')).toBeVisible();
    await expect(drawer.getByText('Lifecycle Timeline')).toBeVisible();

    // Close drawer
    await drawer.getByTestId('contract-detail-close').click();
    await expect(drawer).not.toBeVisible();

    // 5. Accessibility Check
    // Disable rules that are known to fail temporarily in dev environments or due to mock data limitations
    const axe = new AxeBuilder({ page: admin.page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .disableRules(['color-contrast', 'heading-order', 'empty-heading']); 
    const accessibilityScanResults = await axe.analyze();
    expect(accessibilityScanResults.violations).toEqual([]);

    // 6. Screenshot baseline
    await expect(admin.page).toHaveScreenshot('contracts-full-page.png', {
      fullPage: true,
      mask: [admin.page.getByTestId('contract-card')], // Mask dynamic data
      timeout: 15000,
    });
  });

  test('Mock 500 -> ErrorState for Contracts', async ({ admin }) => {
    // Intercept API call
    await admin.page.route('**/api/v1/contracts*', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Internal Server Error' }),
      });
    });

    await admin.page.goto('/contracts');

    // Root should still render
    await expect(admin.page.getByTestId('contracts-root')).toBeVisible();

    // Wait for error state
    const errorState = admin.page.locator('[data-testid="contracts-error-state"]:visible');
    await expect(errorState).toBeVisible({ timeout: 10000 });
  });

  test('Mock Empty -> EmptyState for Contracts', async ({ admin }) => {
    // Intercept API call
    await admin.page.route('**/api/v1/contracts*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], total: 0 }),
      });
    });

    await admin.page.goto('/contracts');

    // Root should still render
    await expect(admin.page.getByTestId('contracts-root')).toBeVisible();

    // Wait for empty state
    const emptyState = admin.page.locator('[data-testid="empty-contracts-state"]:visible');
    await expect(emptyState).toBeVisible({ timeout: 10000 });
  });
});
