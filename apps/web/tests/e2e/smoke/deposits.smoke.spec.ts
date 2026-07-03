import { expect } from '@playwright/test';
import { test } from '../fixtures/admin.fixture';

test.describe('Deposits Smoke Test', () => {
  
  test('Verify deposits page rendering, grid, and drawer', async ({ admin }) => {
    // Mock successful deposits API
    await admin.page.route('**/api/v1/deposits*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            items: [
              {
                id: 'DEP-001',
                code: 'DEP-001',
                type: 'SECURITY',
                status: 'DRAFT',
                amount: 10000000,
                customerName: 'Nguyen Van A',
                customerPhone: '0901234567',
                buildingName: 'Building A',
                roomCode: 'A101',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              }
            ],
            total: 1,
            page: 1,
            limit: 10
          }
        })
      });
    });

    // 1. Open Deposits page
    await admin.page.goto('/deposits');

    // 2. Verify root container
    const depositsRoot = admin.page.locator('[data-testid="deposits-root"]');
    await expect(depositsRoot).toBeVisible();

    // 3. Verify main layout components (Desktop & Mobile)
    const kpiGrid = admin.page.locator('[data-testid="deposits-kpi-grid"]:visible').first();
    await expect(kpiGrid).toBeVisible();

    const isDesktop = await admin.page.locator('[data-testid="deposits-filter-bar"]:visible').count() > 0;
    if (isDesktop) {
      await expect(admin.page.locator('[data-testid="deposits-filter-bar"]:visible')).toBeVisible();
      await expect(admin.page.locator('[data-testid="deposits-pipeline"]:visible')).toBeVisible();
      
      // Refund center is only visible on xl (>=1280px)
      const isXlDesktop = await admin.page.locator('[data-testid="deposits-refund-center"]:visible').count() > 0;
      if (isXlDesktop) {
        await expect(admin.page.locator('[data-testid="deposits-refund-center"]:visible')).toBeVisible();
      }
    }

    const depositsList = admin.page.locator('[data-testid="deposits-list"]:visible').first();
    await expect(depositsList).toBeVisible();

    // Wait for data to load and cards to render
    const depositCard = admin.page.locator('[data-testid="deposit-card"]:visible').first();
    await expect(depositCard).toBeVisible({ timeout: 10000 });

    // 4. Open Drawer and verify
    // Click with offset to avoid quick-action buttons intercepting the click
    await depositCard.click({ position: { x: 10, y: 10 } });
    
    const drawer = admin.page.locator('[data-testid="deposit-detail-drawer"]:visible');
    await expect(drawer).toBeVisible({ timeout: 15000 });
    
    // Verify badge inside drawer
    await expect(drawer.getByTestId('deposit-status-badge')).toBeVisible();

    // Close the drawer
    await drawer.getByTestId('deposit-detail-close').click();
    await expect(drawer).toBeHidden();

    // 5. Axe Accessibility check
    await admin.page.addScriptTag({ path: require.resolve('axe-core') });
    
    const accessibilityScanResults = await admin.page.evaluate(async () => {
      // @ts-ignore
      return await window.axe.run(document, {
        rules: {
          'color-contrast': { enabled: false }, // Disabling color-contrast temporarily
          'heading-order': { enabled: false },  // Disabling heading-order temporarily
        }
      });
    });
    
    expect(accessibilityScanResults.violations).toEqual([]);

    // 6. Screenshot baseline (full page)
    await expect(admin.page).toHaveScreenshot('deposits-full-page.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.1,
    });
  });

  test('Mock 500 -> ErrorState for Deposits', async ({ admin }) => {
    // Mock 500 error for deposits API
    await admin.page.route('**/api/v1/deposits*', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' })
      });
    });

    await admin.page.goto('/deposits');

    // Wait for error state
    const errorState = admin.page.locator('[data-testid="deposits-error-state"]:visible').first();
    await expect(errorState).toBeVisible({ timeout: 10000 });
  });

  test('Mock Empty -> EmptyState for Deposits', async ({ admin }) => {
    // Mock 200 empty for deposits API
    await admin.page.route('**/api/v1/deposits*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            items: [],
            total: 0,
            page: 1,
            limit: 10
          }
        })
      });
    });

    await admin.page.goto('/deposits');

    // Wait for empty state
    const emptyState = admin.page.locator('[data-testid="empty-deposits-state"]:visible').first();
    await expect(emptyState).toBeVisible({ timeout: 10000 });
  });
});
