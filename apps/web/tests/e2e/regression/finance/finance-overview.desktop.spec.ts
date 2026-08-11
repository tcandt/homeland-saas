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
      roomBreakdown: [],
      expense: isAugust ? 600000 : 900000,
      profit: isAugust ? 1900000 : 2300000,
      margin: isAugust ? 76 : 72,
      overdueInvoices: isAugust ? 1 : 2,
      alerts: isAugust ? ['1 hóa đơn quá hạn'] : ['2 hóa đơn quá hạn'],
    },
  ];
}

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
  const isAugust = month === '8';
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
      requestCount: isAugust ? 3 : 5,
      confirmedCount: isAugust ? 2 : 4,
      pendingCount: 1,
      cancelledCount: 0,
      confirmedAmount: isAugust ? 3500000 : 6200000,
      pendingAmount: isAugust ? 1200000 : 1600000,
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
      requestCount: isAugust ? 2 : 3,
      confirmedCount: isAugust ? 1 : 2,
      pendingCount: 1,
      cancelledCount: 0,
      confirmedAmount: isAugust ? 1800000 : 2600000,
      pendingAmount: isAugust ? 600000 : 900000,
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

type ReconciliationRow = {
  id: string;
  createdAt: string;
  status: string;
  paymentCode: string;
  sourceType: string | null;
  requestStatus: string | null;
  providerTransactionId: string | null;
  amount: number;
  expectedAmount: number;
  accountNumber: string | null;
  bankAccount?: { bankName?: string | null } | null;
  owner?: { name?: string | null } | null;
  overpaymentResolution?: 'CREDIT_BALANCE' | 'CARRY_FORWARD' | 'REFUND_PENDING' | null;
  overpaymentRefundCompletedAt?: string | null;
  overpaymentAmount?: number | null;
  overpaymentTaskTitle?: string | null;
};

function createSePayRows(status: string | null): ReconciliationRow[] {
  const rows: ReconciliationRow[] = [
    {
      id: 'log-unmatched-1',
      createdAt: '2026-08-10T08:00:00.000Z',
      status: 'UNMATCHED',
      paymentCode: 'INV-LK0131-202608-A1',
      sourceType: null,
      requestStatus: null,
      providerTransactionId: 'txn-unmatched-1',
      amount: 2500000,
      expectedAmount: 2500000,
      accountNumber: '9704221234567890',
      bankAccount: { bankName: 'MB Bank' },
      owner: { name: 'Tính' },
      overpaymentResolution: null,
      overpaymentRefundCompletedAt: null,
      overpaymentAmount: null,
      overpaymentTaskTitle: null,
    },
    {
      id: 'log-over-1',
      createdAt: '2026-08-11T02:00:00.000Z',
      status: 'OVER_AMOUNT',
      paymentCode: 'INV-LK0132-202608-B1',
      sourceType: 'INVOICE',
      requestStatus: 'CONFIRMED',
      providerTransactionId: 'txn-over-1',
      amount: 3700000,
      expectedAmount: 3500000,
      accountNumber: '9704221234567890',
      bankAccount: { bankName: 'MB Bank' },
      owner: { name: 'Thể' },
      overpaymentResolution: null,
      overpaymentRefundCompletedAt: null,
      overpaymentAmount: 200000,
      overpaymentTaskTitle: null,
    },
  ];

  return status ? rows.filter((row) => row.status === status) : rows;
}

function buildSePayResponse(status: string | null) {
  const rows = createSePayRows(status);
  return {
    summary: {
      total: status ? rows.length : 2,
      matched: 0,
      unmatched: status === 'UNMATCHED' ? 1 : 1,
      shortAmount: 0,
      overAmount: status === 'OVER_AMOUNT' ? 1 : 1,
      wrongBank: 0,
    },
    rows,
  };
}

async function mockFinanceOverview(page: any) {
  let lastCashflowQuery: { year?: string | null; month?: string | null } | null = null;
  let lastSePayQuery: { year?: string | null; month?: string | null; status?: string | null } | null = null;
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
      body: JSON.stringify({ success: true, data: ownerSummaryRows }),
    });
  });

  await page.route('**/api/v1/finance/banks/cashflow*', async (route: any) => {
    const url = new URL(route.request().url());
    const year = url.searchParams.get('year');
    const month = url.searchParams.get('month');
    lastCashflowQuery = { year, month };
    const rows = createCashflowRows(month);

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: buildCashflowResponse(rows, month) }),
    });
  });

  await page.route('**/api/v1/finance/sepay/reconciliation*', async (route: any) => {
    const url = new URL(route.request().url());
    const year = url.searchParams.get('year');
    const month = url.searchParams.get('month');
    const status = url.searchParams.get('status');
    lastSePayQuery = { year, month, status };

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: buildSePayResponse(status) }),
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
      body: JSON.stringify({ success: true, data: createBuildingSummary(month) }),
    });
  });

  await page.route('**/api/v1/finance/ledger*', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [] }),
    });
  });

  return {
    getLastCashflowQuery: () => lastCashflowQuery,
    getLastSePayQuery: () => lastSePayQuery,
    getLastBuildingQuery: () => lastBuildingQuery,
  };
}

test.describe('Finance Overview Desktop Regression', () => {
  test.beforeEach(async ({ admin }, testInfo) => {
    test.skip(!/Desktop|Laptop/.test(testInfo.project.name), 'Desktop-only regression');
  });

  test('renders finance desktop overview sections together', async ({ admin }) => {
    const mock = await mockFinanceOverview(admin.page);

    await admin.page.goto('/finance', { waitUntil: 'domcontentloaded' });

    await expect
      .poll(() => ({
        cashflow: mock.getLastCashflowQuery(),
        sepay: mock.getLastSePayQuery(),
        building: mock.getLastBuildingQuery(),
      }), { timeout: 10000 })
      .toMatchObject({
        cashflow: { year: '2026', month: null },
        sepay: { year: '2026', month: null, status: null },
        building: { year: '2026', month: null },
      });

    await expect(admin.page.getByTestId('owner-profit-summary')).toBeVisible();
    await expect(admin.page.getByTestId('bank-cashflow-summary')).toBeVisible();
    await expect(admin.page.getByTestId('sepay-reconciliation-summary')).toBeVisible();
    await expect(admin.page.getByTestId('building-profit-summary')).toBeVisible();
    await expect(admin.page.getByTestId('bank-cashflow-row-bank-1')).toBeVisible();
    await expect(admin.page.getByTestId('sepay-row-log-unmatched-1')).toBeVisible();
    await expect(admin.page.getByTestId('building-profit-row-building-1')).toBeVisible();
    await expect(admin.page.getByTestId('owner-profit-card-owner-1')).toBeVisible();
  });

  test('keeps desktop finance sections working under independent filters', async ({ admin }) => {
    const mock = await mockFinanceOverview(admin.page);

    await admin.page.goto('/finance', { waitUntil: 'domcontentloaded' });

    await admin.page.getByTestId('bank-cashflow-month').selectOption('8');
    await admin.page.getByTestId('sepay-reconciliation-status').selectOption('OVER_AMOUNT');
    await admin.page.getByTestId('building-profit-month').selectOption('8');

    await expect
      .poll(() => ({
        cashflow: mock.getLastCashflowQuery(),
        sepay: mock.getLastSePayQuery(),
        building: mock.getLastBuildingQuery(),
      }), { timeout: 10000 })
      .toMatchObject({
        cashflow: { year: '2026', month: '8' },
        sepay: { year: '2026', month: null, status: 'OVER_AMOUNT' },
        building: { year: '2026', month: '8' },
      });

    await expect(admin.page.getByTestId('bank-cashflow-kpis')).toContainText('5');
    await expect(admin.page.getByTestId('bank-cashflow-kpis')).toContainText('5.300.000');
    await expect(admin.page.getByTestId('sepay-row-log-over-1')).toBeVisible();
    await expect(admin.page.getByTestId('sepay-row-log-unmatched-1')).toHaveCount(0);
    await expect(admin.page.getByTestId('building-profit-row-building-1')).toBeVisible();
  });
});
