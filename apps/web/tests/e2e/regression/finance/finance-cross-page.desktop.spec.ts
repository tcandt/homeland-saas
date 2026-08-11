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

const transactionRows = [
  {
    id: 'txn-1',
    createdAt: '2026-08-11T08:15:00.000Z',
    direction: 'IN',
    amount: 2500000,
    content: 'Thu tien phong LK01-31',
    paymentCode: 'PAY-LK0131-001',
    providerTransactionId: 'MB-0001',
    reference: 'REF-001',
    owner: { id: 'owner-1', name: 'Tính' },
    bankAccount: {
      id: 'bank-1',
      bankName: 'MB Bank',
      accountName: 'Owner A',
      accountNumber: '1234567890',
    },
    match: { status: 'MATCHED_INVOICE' },
  },
  {
    id: 'txn-2',
    createdAt: '2026-08-10T14:40:00.000Z',
    direction: 'OUT',
    amount: 780000,
    content: 'Chi sua cua phong 32-01',
    paymentCode: 'EXP-001',
    providerTransactionId: 'ACB-0002',
    reference: 'REF-002',
    owner: { id: 'owner-2', name: 'Thể' },
    bankAccount: {
      id: 'bank-2',
      bankName: 'ACB',
      accountName: 'Owner B',
      accountNumber: '9988776655',
    },
    match: null,
  },
];

function buildTransactionResponse(rows: any[]) {
  const inflow = rows.filter((row) => row.direction === 'IN').reduce((sum, row) => sum + row.amount, 0);
  const outflow = rows.filter((row) => row.direction === 'OUT').reduce((sum, row) => sum + row.amount, 0);

  return {
    rows,
    summary: {
      total: rows.length,
      inflow,
      outflow,
      net: inflow - outflow,
    },
    filters: {
      bankAccounts: [
        {
          id: 'bank-1',
          bankName: 'MB Bank',
          accountName: 'Owner A',
          accountNumber: '1234567890',
        },
        {
          id: 'bank-2',
          bankName: 'ACB',
          accountName: 'Owner B',
          accountNumber: '9988776655',
        },
      ],
    },
  };
}

function buildCashflowResponse() {
  return {
    period: {
      year: 2026,
      month: 8,
      startDate: '2026-08-01T00:00:00.000Z',
      endDate: '2026-08-31T23:59:59.999Z',
    },
    summary: {
      bankCount: 2,
      requestCount: 5,
      confirmedAmount: 5300000,
      pendingAmount: 1800000,
    },
    rows: [
      {
        bankAccount: {
          id: 'bank-1',
          bankName: 'MB Bank',
          accountNumber: '1234567890',
          accountName: 'Owner A',
          isActive: true,
        },
        owner: { id: 'owner-1', code: 'OWNER_A', name: 'Tính' },
        requestCount: 3,
        confirmedCount: 2,
        pendingCount: 1,
        cancelledCount: 0,
        confirmedAmount: 3500000,
        pendingAmount: 1200000,
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
        requestCount: 2,
        confirmedCount: 1,
        pendingCount: 1,
        cancelledCount: 0,
        confirmedAmount: 1800000,
        pendingAmount: 600000,
        latestPaidAt: '2026-08-10T12:00:00.000Z',
        latestRequestAt: '2026-08-10T10:30:00.000Z',
      },
    ],
  };
}

async function mockCrossPageFinance(page: any) {
  let lastCashflowQuery: { year?: string | null; month?: string | null } | null = null;
  let lastTransactionQuery:
    | {
        year?: string | null;
        month?: string | null;
        direction?: string | null;
        content?: string | null;
        search?: string | null;
        bankAccountId?: string | null;
      }
    | null = null;

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
    lastCashflowQuery = {
      year: url.searchParams.get('year'),
      month: url.searchParams.get('month'),
    };

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: buildCashflowResponse() }),
    });
  });

  await page.route('**/api/v1/finance/banks/transactions*', async (route: any) => {
    const url = new URL(route.request().url());
    const year = url.searchParams.get('year');
    const month = url.searchParams.get('month');
    const direction = url.searchParams.get('direction') || '';
    const content = (url.searchParams.get('content') || '').toLowerCase();
    const search = (url.searchParams.get('search') || '').toLowerCase();
    const bankAccountId = url.searchParams.get('bankAccountId') || '';
    lastTransactionQuery = {
      year,
      month,
      direction: direction || null,
      content: content || null,
      search: search || null,
      bankAccountId: bankAccountId || null,
    };

    let rows = [...transactionRows].filter((row) => {
      const rowDate = new Date(row.createdAt);
      const yearMatches = !year || String(rowDate.getUTCFullYear()) === year;
      const monthMatches = !month || String(rowDate.getUTCMonth() + 1) === month;
      return yearMatches && monthMatches;
    });

    if (direction) rows = rows.filter((row) => row.direction === direction);
    if (bankAccountId) rows = rows.filter((row) => row.bankAccount.id === bankAccountId);
    if (content) rows = rows.filter((row) => row.content.toLowerCase().includes(content));
    if (search) {
      rows = rows.filter((row) =>
        [row.paymentCode, row.providerTransactionId, row.reference, row.bankAccount.accountName, row.bankAccount.bankName]
          .join(' ')
          .toLowerCase()
          .includes(search),
      );
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: buildTransactionResponse(rows) }),
    });
  });

  return {
    getLastCashflowQuery: () => lastCashflowQuery,
    getLastTransactionQuery: () => lastTransactionQuery,
  };
}

test.describe('Finance Cross Page Desktop Regression', () => {
  test.beforeEach(async ({ admin }, testInfo) => {
    test.skip(!/Desktop|Laptop/.test(testInfo.project.name), 'Desktop-only regression');
  });

  test('keeps August bank dataset consistent between finance overview and transactions pages', async ({ admin }) => {
    const mock = await mockCrossPageFinance(admin.page);

    await admin.page.goto('/finance', { waitUntil: 'domcontentloaded' });
    await admin.page.getByTestId('bank-cashflow-month').selectOption('8');

    await expect
      .poll(() => mock.getLastCashflowQuery(), { timeout: 10000 })
      .toMatchObject({
        year: '2026',
        month: '8',
      });

    await expect(admin.page.getByTestId('bank-cashflow-row-bank-1')).toBeVisible();
    await expect(admin.page.getByTestId('bank-cashflow-row-bank-2')).toBeVisible();
    await expect(admin.page.getByTestId('bank-cashflow-kpis')).toContainText('5.300.000');

    await admin.page.goto('/finance/transactions', { waitUntil: 'domcontentloaded' });
    await admin.page.getByTestId('bank-transactions-month').selectOption('8');
    await admin.page.getByTestId('bank-transactions-account').selectOption('bank-1');

    await expect
      .poll(() => mock.getLastTransactionQuery(), { timeout: 10000 })
      .toMatchObject({
        year: '2026',
        month: '8',
        bankAccountId: 'bank-1',
      });

    await expect(admin.page.getByTestId('bank-transaction-row-txn-1')).toBeVisible();
    await expect(admin.page.getByTestId('bank-transaction-row-txn-2')).toHaveCount(0);
    await expect(admin.page.getByTestId('bank-transactions-kpis')).toContainText('2.500.000');
  });
});
