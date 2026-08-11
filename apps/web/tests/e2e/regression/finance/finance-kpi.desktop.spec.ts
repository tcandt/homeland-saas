import { expect } from '@playwright/test';
import { test } from '../../fixtures/admin.fixture';

const dashboardData = {
  kpis: {
    totalRevenue: 4300000,
    totalExpense: 1000000,
    totalDebt: 200000,
    depositHeld: 5000000,
    netProfit: 3300000,
    netCashFlow: 3300000,
  },
  occupancy: {
    rate: 75,
    rented: 3,
    available: 1,
    maintenance: 0,
    reserved: 0,
  },
  buildingHealth: [],
  revenueHistory: [],
  recentActivity: [],
  tasks: [],
  insights: [],
};

async function mockFinanceKpi(page: any) {
  await page.route('**/api/v1/dashboard', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: dashboardData }),
    });
  });

  await page.route('**/api/v1/buildings*', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          items: [],
          total: 0,
        },
      }),
    });
  });

  await page.route('**/api/v1/finance/owners/profit-summary', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [] }),
    });
  });

  await page.route('**/api/v1/finance/banks/cashflow*', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          summary: { bankCount: 0, requestCount: 0, confirmedAmount: 0, pendingAmount: 0 },
          rows: [],
        },
      }),
    });
  });

  await page.route('**/api/v1/finance/sepay/reconciliation*', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          summary: { total: 0, matched: 0, unmatched: 0, shortAmount: 0, overAmount: 0, wrongBank: 0 },
          rows: [],
        },
      }),
    });
  });

  await page.route('**/api/v1/finance/buildings/profit-summary*', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [] }),
    });
  });

  await page.route('**/api/v1/finance/ledger*', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [] }),
    });
  });
}

test.describe('Finance KPI Desktop Regression', () => {
  test.beforeEach(async ({ admin }, testInfo) => {
    test.skip(!/Desktop|Laptop/.test(testInfo.project.name), 'Desktop-only regression');
  });

  test('renders all finance KPI cards with expected values on desktop', async ({ admin }) => {
    await mockFinanceKpi(admin.page);

    await admin.page.goto('/finance', { waitUntil: 'domcontentloaded' });

    await expect(admin.page.getByTestId('finance-kpi-grid')).toBeVisible();
    await expect(admin.page.getByTestId('finance-kpi-card-tien-mat-rong')).toContainText('3.300.000');
    await expect(admin.page.getByTestId('finance-kpi-card-doanh-thu-p-l')).toContainText('4.300.000');
    await expect(admin.page.getByTestId('finance-kpi-card-chi-phi-p-l')).toContainText('1.000.000');
    await expect(admin.page.getByTestId('finance-kpi-card-loi-nhuan-rong')).toContainText('3.300.000');
    await expect(admin.page.getByTestId('finance-kpi-card-phai-thu')).toContainText('200.000');
    await expect(admin.page.getByTestId('finance-kpi-card-tien-coc-giu')).toContainText('5.000.000');
    await expect(admin.page.getByTestId('finance-kpi-card-ty-le-thu')).toContainText('96%');
    await expect(admin.page.getByTestId('finance-kpi-card-lap-day')).toContainText('75');
  });
});
