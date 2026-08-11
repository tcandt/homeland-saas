import { expect } from '@playwright/test';
import { test } from '../../fixtures/admin.fixture';

function createBuildingSummary(month: string | null) {
  const isAugust = month === '8';
  return [
    {
      building: {
        id: 'building-1',
        code: 'LK01-31',
        name: 'LK01-31',
        roomCount: 2,
        occupiedRooms: 1,
        occupancyRate: 50,
      },
      owner: { id: 'owner-1', code: 'OWNER_A', name: 'Tính' },
      revenue: isAugust ? 2500000 : 3200000,
      revenueBreakdown: {
        rent: isAugust ? 1800000 : 2200000,
        electricity: isAugust ? 350000 : 420000,
        waterAndService: isAugust ? 270000 : 460000,
        other: isAugust ? 80000 : 120000,
      },
      roomBreakdown: [
        {
          room: { id: 'room-1', code: '31-01', name: 'Văn phòng', status: 'OCCUPIED' },
          revenue: isAugust ? 2500000 : 3200000,
          revenueBreakdown: {
            rent: isAugust ? 1800000 : 2200000,
            electricity: isAugust ? 350000 : 420000,
            waterAndService: isAugust ? 270000 : 460000,
            other: isAugust ? 80000 : 120000,
          },
          contracts: [
            {
              id: 'contract-1',
              code: 'HD-31-01',
              status: 'ACTIVE',
              startDate: '2026-08-01T00:00:00.000Z',
              endDate: '2027-07-31T00:00:00.000Z',
              monthlyRent: 1800000,
              customer: { id: 'customer-1', fullName: 'Khách A' },
            },
          ],
          invoices: [
            {
              id: 'invoice-1',
              code: 'INV-31-01-08',
              status: 'OVERDUE',
              dueDate: '2026-08-05T00:00:00.000Z',
              total: 2500000,
              remainingAmount: 500000,
              customer: { id: 'customer-1', fullName: 'Khách A' },
            },
          ],
          expenses: [
            {
              id: 'expense-1',
              code: 'EXP-ROOM-31-01',
              status: 'PAID',
              category: 'SUPPLIES',
              amount: 300000,
              settlementStatus: 'REIMBURSED',
              description: 'Mua vật tư vệ sinh',
              paidByName: 'Admin A',
            },
          ],
        },
        {
          room: { id: 'room-2', code: '31-02', name: 'Phòng trống', status: 'AVAILABLE' },
          revenue: 0,
          revenueBreakdown: {
            rent: 0,
            electricity: 0,
            waterAndService: 0,
            other: 0,
          },
          contracts: [],
          invoices: [],
          expenses: [],
        },
      ],
      expense: isAugust ? 600000 : 900000,
      profit: isAugust ? 1900000 : 2300000,
      margin: isAugust ? 76 : 72,
      overdueInvoices: isAugust ? 1 : 2,
      alerts: isAugust ? ['1 hóa đơn quá hạn'] : ['2 hóa đơn quá hạn'],
    },
  ];
}

async function mockFinanceBuildingProfit(page: any) {
  let lastBuildingQuery: { year?: string | null; month?: string | null } | null = null;

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
        data: [],
      }),
    });
  });

  await page.route('**/api/v1/finance/buildings/profit-summary*', async (route: any) => {
    const url = new URL(route.request().url());
    const year = url.searchParams.get('year');
    const month = url.searchParams.get('month');
    lastBuildingQuery = { year, month };

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: createBuildingSummary(month),
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
    getLastBuildingQuery: () => lastBuildingQuery,
  };
}

test.describe('Finance Building Profit Desktop Regression', () => {
  test.beforeEach(async ({ admin }, testInfo) => {
    test.skip(!/Desktop|Laptop/.test(testInfo.project.name), 'Desktop-only regression');
  });

  test('renders building profit summary with real revenue breakdown columns', async ({ admin }) => {
    await mockFinanceBuildingProfit(admin.page);

    await admin.page.goto('/finance', { waitUntil: 'domcontentloaded' });

    await expect(admin.page.getByTestId('building-profit-summary')).toBeVisible();
    await expect(admin.page.getByTestId('building-profit-row-building-1')).toBeVisible();
    await expect(admin.page.getByTestId('building-profit-row-building-1').getByText('LK01-31')).toBeVisible();
    await expect(admin.page.getByTestId('building-profit-row-building-1').getByText('Tính')).toBeVisible();
  });

  test('filters building report by month and expands room, contract, invoice, and expense details', async ({ admin }) => {
    const mock = await mockFinanceBuildingProfit(admin.page);

    await admin.page.goto('/finance', { waitUntil: 'domcontentloaded' });

    await expect
      .poll(() => mock.getLastBuildingQuery(), { timeout: 10000 })
      .toMatchObject({
        year: String(new Date().getFullYear()),
        month: null,
      });

    await admin.page.getByTestId('building-profit-month').selectOption('8');

    await expect
      .poll(() => mock.getLastBuildingQuery(), { timeout: 10000 })
      .toMatchObject({
        year: '2026',
        month: '8',
      });

    await admin.page.getByTestId('building-profit-toggle-building-1').click();
    await expect(admin.page.getByTestId('building-profit-room-table-building-1')).toBeVisible();
    await expect(admin.page.getByTestId('building-profit-room-row-building-1-room-1')).toBeVisible();

    await admin.page.getByTestId('building-profit-room-toggle-building-1-room-1').click();

    await expect(admin.page.getByTestId('building-profit-contracts-building-1-room-1')).toBeVisible();
    await expect(admin.page.getByTestId('building-profit-invoices-building-1-room-1')).toBeVisible();
    await expect(admin.page.getByTestId('building-profit-expenses-building-1-room-1')).toBeVisible();
    await expect(admin.page.getByText('HD-31-01')).toBeVisible();
    await expect(admin.page.getByText('INV-31-01-08')).toBeVisible();
    await expect(admin.page.getByText('EXP-ROOM-31-01')).toBeVisible();
  });
});
