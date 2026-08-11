import { expect } from '@playwright/test';
import { test } from '../../fixtures/admin.fixture';

type CashflowRow = {
  bankAccount: {
    id: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
    isActive: boolean;
  };
  owner: {
    id: string;
    code: string;
    name: string;
  } | null;
  requestCount: number;
  confirmedCount: number;
  pendingCount: number;
  cancelledCount: number;
  confirmedAmount: number;
  pendingAmount: number;
  latestPaidAt: string | null;
  latestRequestAt: string | null;
};

function createCashflowRows(month: string | null): CashflowRow[] {
  if (month === '7') {
    return [];
  }

  const augustVariant = month === '8';
  return [
    {
      bankAccount: {
        id: 'bank-1',
        bankName: 'MB Bank',
        accountNumber: '1234567890',
        accountName: 'Owner A',
        isActive: true,
      },
      owner: { id: 'owner-1', code: 'OWNER_A', name: 'Tính' },
      requestCount: augustVariant ? 3 : 5,
      confirmedCount: augustVariant ? 2 : 4,
      pendingCount: 1,
      cancelledCount: 0,
      confirmedAmount: augustVariant ? 3500000 : 6200000,
      pendingAmount: augustVariant ? 1200000 : 1600000,
      latestPaidAt: '2026-08-11T09:15:00.000Z',
      latestRequestAt: '2026-08-11T08:00:00.000Z',
    },
    {
      bankAccount: {
        id: 'bank-2',
        bankName: 'ACB',
        accountNumber: '9988776655',
        accountName: 'Owner B',
        isActive: false,
      },
      owner: { id: 'owner-2', code: 'OWNER_B', name: 'Thể' },
      requestCount: augustVariant ? 2 : 3,
      confirmedCount: augustVariant ? 1 : 2,
      pendingCount: augustVariant ? 1 : 1,
      cancelledCount: 0,
      confirmedAmount: augustVariant ? 1800000 : 2600000,
      pendingAmount: augustVariant ? 600000 : 900000,
      latestPaidAt: '2026-08-10T12:00:00.000Z',
      latestRequestAt: '2026-08-10T10:30:00.000Z',
    },
  ];
}

function buildCashflowResponse(rows: CashflowRow[], month: string | null) {
  return {
    period: {
      year: 2026,
      month: month ? Number(month) : null,
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2026-12-31T23:59:59.999Z',
    },
    summary: {
      bankCount: rows.length,
      requestCount: rows.reduce((sum, row) => sum + row.requestCount, 0),
      confirmedAmount: rows.reduce((sum, row) => sum + row.confirmedAmount, 0),
      pendingAmount: rows.reduce((sum, row) => sum + row.pendingAmount, 0),
    },
    rows,
  };
}

async function mockFinanceBankCashflow(page: any) {
  let lastQuery: { year?: string | null; month?: string | null } | null = null;

  await page.route('**/api/v1/dashboard', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
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
        },
      }),
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

  await page.route('**/api/v1/finance/buildings/profit-summary*', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [] }),
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

  await page.route('**/api/v1/finance/ledger*', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [] }),
    });
  });

  await page.route('**/api/v1/finance/banks/cashflow*', async (route: any) => {
    const url = new URL(route.request().url());
    const year = url.searchParams.get('year');
    const month = url.searchParams.get('month');
    lastQuery = { year, month };
    const rows = createCashflowRows(month);

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: buildCashflowResponse(rows, month),
      }),
    });
  });

  return {
    getLastQuery: () => lastQuery,
  };
}

test.describe('Finance Bank Cashflow Desktop Regression', () => {
  test.beforeEach(async ({ admin }, testInfo) => {
    test.skip(!/Desktop|Laptop/.test(testInfo.project.name), 'Desktop-only regression');
  });

  test('renders bank cashflow summary and rows on desktop', async ({ admin }) => {
    const mock = await mockFinanceBankCashflow(admin.page);

    await admin.page.goto('/finance', { waitUntil: 'domcontentloaded' });

    await expect
      .poll(() => mock.getLastQuery(), { timeout: 10000 })
      .toMatchObject({
        year: String(new Date().getFullYear()),
        month: null,
      });

    await expect(admin.page.getByTestId('bank-cashflow-summary')).toBeVisible();
    await expect(admin.page.getByTestId('bank-cashflow-kpis')).toBeVisible();
    await expect(admin.page.getByTestId('bank-cashflow-table')).toBeVisible();
    await expect(admin.page.getByTestId('bank-cashflow-row-bank-1')).toBeVisible();
    await expect(admin.page.getByTestId('bank-cashflow-row-bank-2')).toBeVisible();
    await expect(admin.page.getByTestId('bank-cashflow-kpis')).toContainText('2');
    await expect(admin.page.getByTestId('bank-cashflow-kpis')).toContainText('8');
    await expect(admin.page.getByTestId('bank-cashflow-kpis')).toContainText('8.800.000');
    await expect(admin.page.getByTestId('bank-cashflow-kpis')).toContainText('2.500.000');
  });

  test('filters cashflow by month on desktop', async ({ admin }) => {
    const mock = await mockFinanceBankCashflow(admin.page);

    await admin.page.goto('/finance', { waitUntil: 'domcontentloaded' });

    await admin.page.getByTestId('bank-cashflow-month').selectOption('8');

    await expect
      .poll(() => mock.getLastQuery(), { timeout: 10000 })
      .toMatchObject({
        year: '2026',
        month: '8',
      });

    await expect(admin.page.getByTestId('bank-cashflow-row-bank-1')).toBeVisible();
    await expect(admin.page.getByTestId('bank-cashflow-row-bank-2')).toBeVisible();
    await expect(admin.page.getByTestId('bank-cashflow-kpis')).toContainText('5');
    await expect(admin.page.getByTestId('bank-cashflow-kpis')).toContainText('5.300.000');
    await expect(admin.page.getByTestId('bank-cashflow-kpis')).toContainText('1.800.000');
  });

  test('shows empty state when selected month has no bank cashflow rows', async ({ admin }) => {
    const mock = await mockFinanceBankCashflow(admin.page);

    await admin.page.goto('/finance', { waitUntil: 'domcontentloaded' });

    await admin.page.getByTestId('bank-cashflow-month').selectOption('7');

    await expect
      .poll(() => mock.getLastQuery(), { timeout: 10000 })
      .toMatchObject({
        year: '2026',
        month: '7',
      });

    await expect(admin.page.getByTestId('bank-cashflow-empty')).toBeVisible();
    await expect(admin.page.getByTestId('bank-cashflow-row-bank-1')).toHaveCount(0);
    await expect(admin.page.getByTestId('bank-cashflow-row-bank-2')).toHaveCount(0);
    await expect(admin.page.getByTestId('bank-cashflow-kpis')).toContainText('0');
  });
});
