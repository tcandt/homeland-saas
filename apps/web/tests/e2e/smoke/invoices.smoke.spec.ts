import { expect } from '@playwright/test';
import { test } from '../fixtures/admin.fixture';
import AxeBuilder from '@axe-core/playwright';

test.describe('Invoices Smoke Test', () => {
  const MOCK_INVOICE = {
    id: "inv-001",
    code: "INV-2023-001",
    status: "Created",
    totalAmount: 5000000,
    paidAmount: 0,
    paidPercent: 0,
    period: "10/2023",
    createdAt: new Date().toISOString(),
    dueDate: new Date().toISOString(),
    customer: { name: "Test Customer" },
    contract: { room: { number: "101", building: { name: "Test Building" } } },
  };

  test('should render and pass accessibility checks under populated state', async ({ admin }) => {
    const adminPage = admin.page;
    let consoleErrors: string[] = [];
    adminPage.on('console', msg => {
      if (msg.type() === 'error' && 
          !msg.text().includes('SSE Error') && 
          !msg.text().includes('Failed to load resource: the server responded with a status of 500') &&
          !msg.text().includes('Failed to fetch RSC payload')) {
        consoleErrors.push(msg.text());
      }
    });

    await adminPage.route('**/api/v1/invoices*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [MOCK_INVOICE],
          meta: { page: 1, limit: 20, total: 1 }
        })
      });
    });

    await adminPage.goto('/invoices');

    // Hydration check
    const hydrationErrors = consoleErrors.filter(e => e.includes('Hydration') || e.includes('Minified React error #418') || e.includes('Minified React error #423'));
    expect(hydrationErrors).toEqual([]);

    // 1. Verify Root & Major Components
    await expect(adminPage.locator('[data-testid="invoices-root"]:visible')).toBeVisible();
    await expect(adminPage.locator('[data-testid="invoices-kpi-grid"]:visible')).toBeVisible();
    await expect(adminPage.locator('[data-testid="invoices-filter-bar"]:visible')).toBeVisible();
    await expect(adminPage.locator('[data-testid="billing-pipeline"]:visible')).toBeVisible();
    await expect(adminPage.locator('[data-testid="invoices-list"]:visible')).toBeVisible();

    // Responsive: Right panel only visible on larger screens
    if (adminPage.viewportSize() && adminPage.viewportSize()!.width >= 1280) {
      await expect(adminPage.locator('[data-testid="billing-right-panel"]:visible')).toBeVisible();
    }

    // 2. Open drawer and verify details
    const firstCard = adminPage.locator('[data-testid="invoice-card"]:visible').first();
    await expect(firstCard).toBeVisible();
    await firstCard.click({ position: { x: 10, y: 10 } });

    const drawer = adminPage.locator('[data-testid="invoice-detail-drawer"]:visible');
    await expect(drawer).toBeVisible();
    await expect(drawer.getByTestId('invoice-status-badge')).toBeVisible();
    await expect(drawer.getByText('Chi tiết phí (Breakdown)')).toBeVisible();

    // Close drawer
    await drawer.getByTestId('invoice-detail-close').click();
    await expect(drawer).not.toBeVisible();

    // 3. Axe Accessibility Check
    await adminPage.waitForTimeout(500);
    const accessibilityScanResults = await new AxeBuilder({ page: adminPage })
      .disableRules(['color-contrast', 'heading-order', 'button-name'])
      .analyze();
    expect(accessibilityScanResults.violations).toEqual([]);

    // 4. Screenshot
    await expect(adminPage).toHaveScreenshot('invoices-populated.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.05,
      mask: [adminPage.locator('[data-testid="invoice-card"]:visible')]
    });
    
    expect(consoleErrors).toEqual([]);
  });

  test('should display empty state', async ({ admin }) => {
    const adminPage = admin.page;
    await adminPage.route('**/api/v1/invoices*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [],
          meta: { page: 1, limit: 20, total: 0 }
        })
      });
    });

    await adminPage.goto('/invoices');
    await expect(adminPage.locator('[data-testid="invoices-root"]:visible')).toBeVisible();
    await expect(adminPage.locator('[data-testid="empty-invoices-state"]:visible')).toBeVisible();
  });

  test('should display error state on 500', async ({ admin }) => {
    const adminPage = admin.page;
    await adminPage.route('**/api/v1/invoices*', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: "Internal Server Error" })
      });
    });

    await adminPage.goto('/invoices');
    await expect(adminPage.locator('[data-testid="invoices-root"]:visible')).toBeVisible();
    await expect(adminPage.locator('[data-testid="invoices-error-state"]:visible')).toBeVisible();
  });
});
