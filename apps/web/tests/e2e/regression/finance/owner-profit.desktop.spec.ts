import { expect } from '@playwright/test';
import { test } from '../../fixtures/admin.fixture';

const ownerSummaryRows = [
  {
    owner: { id: 'owner-1', code: 'OWNER_A', name: 'Tính' },
    buildings: [{ id: 'building-1', code: 'LK01-31', name: 'LK01-31' }],
    revenue: 2500000,
    expense: 600000,
    advanceReceivable: 150000,
    advancePayable: 50000,
    profitAfterAdvance: 2000000,
  },
  {
    owner: { id: 'owner-2', code: 'OWNER_B', name: 'Thể' },
    buildings: [{ id: 'building-2', code: 'LK01-32', name: 'LK01-32' }],
    revenue: 1800000,
    expense: 400000,
    advanceReceivable: 0,
    advancePayable: 0,
    profitAfterAdvance: 1400000,
  },
];

function createOwnerDetail(month: string | null) {
  const isAugust = month === '8';
  return {
    owner: { id: 'owner-1', code: 'OWNER_A', name: 'Tính' },
    period: {
      year: 2026,
      month: month ? Number(month) : null,
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2026-12-31T23:59:59.999Z',
    },
    buildings: [{ id: 'building-1', code: 'LK01-31', name: 'LK01-31' }],
    summary: {
      revenue: isAugust ? 2500000 : 3200000,
      expense: isAugust ? 600000 : 900000,
      profitBeforeAdvance: isAugust ? 1900000 : 2300000,
      advanceReceivable: isAugust ? 150000 : 200000,
      advancePayable: isAugust ? 50000 : 100000,
      profitAfterAdvance: isAugust ? 2000000 : 2400000,
    },
    buildingBreakdown: [
      {
        building: { id: 'building-1', code: 'LK01-31', name: 'LK01-31' },
        owner: { id: 'owner-1', name: 'Tính' },
        revenue: isAugust ? 2500000 : 3200000,
        revenueBreakdown: {
          rent: isAugust ? 1800000 : 2200000,
          electricity: isAugust ? 350000 : 420000,
          waterAndService: isAugust ? 270000 : 460000,
          other: isAugust ? 80000 : 120000,
        },
        roomBreakdown: [
          {
            room: { id: 'room-1', code: '31-01', name: 'Văn phòng' },
            revenue: isAugust ? 2500000 : 3200000,
            revenueBreakdown: {
              rent: isAugust ? 1800000 : 2200000,
              electricity: isAugust ? 350000 : 420000,
              waterAndService: isAugust ? 270000 : 460000,
              other: isAugust ? 80000 : 120000,
            },
            contracts: [{ id: 'contract-1' }],
            invoices: [{ id: 'invoice-1' }, { id: 'invoice-2' }],
            expenses: [{ id: 'expense-1' }],
          },
        ],
        expense: isAugust ? 600000 : 900000,
        profit: isAugust ? 1900000 : 2300000,
        margin: isAugust ? 76 : 72,
        overdueInvoices: isAugust ? 1 : 2,
        alerts: isAugust ? ['1 hóa đơn quá hạn'] : ['2 hóa đơn quá hạn'],
      },
    ],
    expenses: [
      {
        id: 'expense-1',
        code: isAugust ? 'EXP-OWNER-08' : 'EXP-OWNER-YEAR',
        category: 'SUPPLIES',
        amount: isAugust ? 600000 : 900000,
        building: { code: 'LK01-31' },
        room: { code: '31-01' },
        paidByName: 'Admin A',
      },
    ],
    trend: Array.from({ length: 12 }, (_, index) => ({
      month: index + 1,
      revenue: index === 7 ? 2500000 : 0,
      expense: index === 7 ? 600000 : 0,
      profit: index === 7 ? 1900000 : 0,
    })),
  };
}

async function mockFinanceOwnerProfit(page: any) {
  let lastDetailQuery: { year?: string | null; month?: string | null } | null = null;

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
      body: JSON.stringify({
        success: true,
        data: ownerSummaryRows,
      }),
    });
  });

  await page.route('**/api/v1/finance/owners/*/profit-detail*', async (route: any) => {
    const url = new URL(route.request().url());
    const year = url.searchParams.get('year');
    const month = url.searchParams.get('month');
    lastDetailQuery = { year, month };

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: createOwnerDetail(month),
      }),
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
      body: JSON.stringify({
        success: true,
        data: [],
      }),
    });
  });

  await page.route('**/api/v1/finance/ledger*', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [],
      }),
    });
  });

  return {
    getLastDetailQuery: () => lastDetailQuery,
  };
}

test.describe('Finance Owner Profit Desktop Regression', () => {
  test.beforeEach(async ({ admin }, testInfo) => {
    test.skip(!/Desktop|Laptop/.test(testInfo.project.name), 'Desktop-only regression');
  });

  test('renders owner profit summary cards on desktop', async ({ admin }) => {
    await mockFinanceOwnerProfit(admin.page);

    await admin.page.goto('/finance', { waitUntil: 'domcontentloaded' });

    await expect(admin.page.getByTestId('owner-profit-summary')).toBeVisible();
    await expect(admin.page.getByTestId('owner-profit-card-owner-1')).toBeVisible();
    await expect(admin.page.getByTestId('owner-profit-card-owner-2')).toBeVisible();
    await expect(admin.page.getByTestId('owner-profit-card-owner-1').getByText('Tính')).toBeVisible();
    await expect(admin.page.getByTestId('owner-profit-card-owner-2').getByText('Thể')).toBeVisible();
  });

  test('opens owner detail modal, filters by month, and expands building room breakdown', async ({ admin }) => {
    const mock = await mockFinanceOwnerProfit(admin.page);

    await admin.page.goto('/finance', { waitUntil: 'domcontentloaded' });

    await admin.page.getByTestId('owner-profit-open-owner-1').click();

    await expect(admin.page.getByTestId('owner-profit-detail-modal')).toBeVisible();
    await expect
      .poll(() => mock.getLastDetailQuery(), { timeout: 10000 })
      .toMatchObject({
        year: String(new Date().getFullYear()),
        month: null,
      });

    await admin.page.getByTestId('owner-profit-detail-month').selectOption('8');

    await expect
      .poll(() => mock.getLastDetailQuery(), { timeout: 10000 })
      .toMatchObject({
        year: '2026',
        month: '8',
      });

    await expect(admin.page.getByTestId('owner-profit-building-row-building-1')).toBeVisible();
    await expect(admin.page.getByText('EXP-OWNER-08')).toBeVisible();

    await admin.page.getByTestId('owner-profit-building-toggle-building-1').click();

    await expect(admin.page.getByTestId('owner-profit-room-breakdown-building-1')).toBeVisible();
    await expect(admin.page.getByTestId('owner-profit-room-breakdown-building-1').getByText('31-01').first()).toBeVisible();
    await expect(admin.page.getByTestId('owner-profit-room-breakdown-building-1').getByText('Văn phòng')).toBeVisible();
  });
});
