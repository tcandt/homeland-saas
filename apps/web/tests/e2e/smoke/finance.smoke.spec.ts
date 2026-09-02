import { expect } from '@playwright/test';
import { test } from '../fixtures/admin.fixture';
import AxeBuilder from '@axe-core/playwright';

test.describe('Finance Smoke Test', () => {
  const MOCK_LEDGER_DATA = [
    {
      id: "ledg-1",
      journalEntry: {
        id: "j-1",
        code: "JRN-001",
        description: "Test Journal",
        sourceType: "MANUAL",
        status: "POSTED"
      },
      createdAt: new Date().toISOString(),
      description: "Test line",
      account: { code: "111", name: "Tiền mặt" },
      costCenter: { name: "CC1" },
      type: "DEBIT",
      amount: 1000000
    }
  ];

  const MOCK_DASHBOARD_DATA = {
    hero: { tasksCount: 1, expiringContracts: 2, cleaningRooms: 3 },
    alerts: [],
    kpis: {
      totalDebt: 5000000,
      totalRevenue: 10000000,
      netProfit: 5000000,
      netCashFlow: 5000000
    },
    occupancy: { rate: 95 }
  };

  test('should render and pass accessibility checks under populated state', async ({ admin }) => {
    const adminPage = admin.page;
    let consoleErrors: string[] = [];
    adminPage.on('console', msg => {
      if (msg.type() === 'error' && 
          !msg.text().includes('SSE Error') && 
          !msg.text().includes('Failed to load resource: the server responded with a status of 500') &&
          !msg.text().includes('Failed to load resource: the server responded with a status of 503') &&
          !msg.text().includes('Failed to fetch RSC payload') &&
          !msg.text().includes('[Header] Fetch failed: 401') &&
          !msg.text().includes('FETCH CLIENT 401 ERROR') &&
          !msg.text().includes('401 (Unauthorized)')) {
        consoleErrors.push(msg.text());
      }
    });

    // Mock Dashboard
    await adminPage.route('**/api/v1/dashboard*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: MOCK_DASHBOARD_DATA }),
      });
    });

    // Mock Ledger
    await adminPage.route('**/api/v1/finance/ledger*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: MOCK_LEDGER_DATA })
      });
    });

    // Mock CashFlow & ProfitLoss (just to prevent real requests)
    await adminPage.route('**/api/v1/finance/cashflow*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) });
    });
    await adminPage.route('**/api/v1/finance/profit-loss*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) });
    });

    await adminPage.goto('/finance');

    // Hydration check
    const hydrationErrors = consoleErrors.filter(e => e.includes('Hydration') || e.includes('Minified React error #418') || e.includes('Minified React error #423'));
    expect(hydrationErrors).toEqual([]);

    // 1. Verify Root & Components
    await expect(adminPage.getByTestId('finance-root')).toBeVisible();
    await expect(adminPage.getByTestId('finance-export-button')).toBeVisible();
    await expect(adminPage.getByTestId('finance-kpi-grid')).toBeVisible();
    await expect(adminPage.getByTestId('finance-chart')).toBeVisible();

    const ledger = adminPage.getByTestId('finance-ledger');
    await expect(ledger).toBeVisible();

    // Responsive: Right panel only visible on larger screens
    if (adminPage.viewportSize() && adminPage.viewportSize()!.width >= 1024) {
      await expect(adminPage.getByTestId('finance-right-panel')).toBeVisible();
    }

    // Wait for virtualized rows and scroll
    const firstRow = adminPage.getByTestId('finance-ledger-row').first();
    await expect(firstRow).toBeVisible({ timeout: 10000 });
    
    // Virtualization: scroll and check
    await ledger.locator('.flex-1.overflow-auto').evaluate(el => el.scrollBy(0, 50));
    await expect(firstRow).toBeVisible();

    // 2. Open drawer
    await firstRow.click({ position: { x: 10, y: 10 } });
    const drawer = adminPage.getByTestId('finance-drawer');
    await expect(drawer).toBeVisible({ timeout: 10000 });
    
    // Check status badge
    await expect(adminPage.getByTestId('finance-status-badge')).toBeVisible();

    // Close drawer
    await adminPage.getByTestId('finance-drawer-close').click();
    await expect(drawer).not.toBeVisible();

    // 3. Accessibility Check
    const axe = new AxeBuilder({ page: adminPage })
      .disableRules(['color-contrast', 'heading-order', 'button-name', 'empty-heading', 'aria-hidden-focus', 'select-name', 'label', 'landmark-unique', 'region']);
    const accessibilityScanResults = await axe.analyze();
    expect(accessibilityScanResults.violations).toEqual([]);

    // 4. Screenshot
    await expect(adminPage).toHaveScreenshot('finance-populated.png', {
      fullPage: true,
      mask: [adminPage.getByTestId('finance-ledger-row')],
      timeout: 15000,
    });

    expect(consoleErrors).toEqual([]);
  });

  test('should display error state on 500', async ({ admin }) => {
    const adminPage = admin.page;
    await adminPage.route('**/api/v1/dashboard*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: MOCK_DASHBOARD_DATA }) });
    });
    
    await adminPage.route('**/api/v1/finance/ledger*', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Internal Server Error' })
      });
    });

    await adminPage.goto('/finance');
    
    const errorState = adminPage.getByTestId('finance-error-state');
    await expect(errorState).toBeVisible({ timeout: 10000 });
  });

  test('should display empty state', async ({ admin }) => {
    const adminPage = admin.page;
    await adminPage.route('**/api/v1/dashboard*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: MOCK_DASHBOARD_DATA }) });
    });
    
    await adminPage.route('**/api/v1/finance/ledger*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] })
      });
    });

    await adminPage.goto('/finance');
    
    const emptyState = adminPage.getByTestId('empty-finance-state');
    await expect(emptyState).toBeVisible({ timeout: 10000 });
  });
});
