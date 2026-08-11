import { expect } from '@playwright/test';
import { test } from '../../fixtures/admin.fixture';

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

function createBaseRows(): ReconciliationRow[] {
  return [
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
    {
      id: 'log-short-1',
      createdAt: '2026-08-11T03:30:00.000Z',
      status: 'SHORT_AMOUNT',
      paymentCode: 'INV-LK0131-202608-D1',
      sourceType: 'INVOICE',
      requestStatus: 'PENDING',
      providerTransactionId: 'txn-short-1',
      amount: 1200000,
      expectedAmount: 1500000,
      accountNumber: '9704221234567890',
      bankAccount: { bankName: 'MB Bank' },
      owner: { name: 'TÃ­nh' },
      overpaymentResolution: null,
      overpaymentRefundCompletedAt: null,
      overpaymentAmount: null,
      overpaymentTaskTitle: null,
    },
    {
      id: 'log-wrong-bank-1',
      createdAt: '2026-08-11T03:40:00.000Z',
      status: 'WRONG_BANK',
      paymentCode: 'INV-LK0132-202608-E1',
      sourceType: 'INVOICE',
      requestStatus: 'PENDING',
      providerTransactionId: 'txn-wrong-bank-1',
      amount: 2100000,
      expectedAmount: 2100000,
      accountNumber: '9704220000000000',
      bankAccount: { bankName: 'ACB' },
      owner: { name: 'Thá»ƒ' },
      overpaymentResolution: null,
      overpaymentRefundCompletedAt: null,
      overpaymentAmount: null,
      overpaymentTaskTitle: null,
    },
    {
      id: 'log-outgoing-1',
      createdAt: '2026-08-11T03:50:00.000Z',
      status: 'IGNORED_OUTGOING',
      paymentCode: 'OUT-LK0132-202608-F1',
      sourceType: null,
      requestStatus: null,
      providerTransactionId: 'txn-outgoing-1',
      amount: 500000,
      expectedAmount: 0,
      accountNumber: '9704221234567890',
      bankAccount: { bankName: 'MB Bank' },
      owner: { name: 'Thá»ƒ' },
      overpaymentResolution: null,
      overpaymentRefundCompletedAt: null,
      overpaymentAmount: null,
      overpaymentTaskTitle: null,
    },
    {
      id: 'log-refund-1',
      createdAt: '2026-08-11T03:00:00.000Z',
      status: 'OVER_AMOUNT',
      paymentCode: 'DEP-LK0132-202608-C1',
      sourceType: 'DEPOSIT',
      requestStatus: 'CONFIRMED',
      providerTransactionId: 'txn-refund-1',
      amount: 1800000,
      expectedAmount: 1500000,
      accountNumber: '9704221234567890',
      bankAccount: { bankName: 'MB Bank' },
      owner: { name: 'Thể' },
      overpaymentResolution: 'REFUND_PENDING',
      overpaymentRefundCompletedAt: null,
      overpaymentAmount: 300000,
      overpaymentTaskTitle: 'Hoàn lại tiền thừa SePay cho phiếu cọc DEP-32-01',
    },
  ];
}

function buildSummary(rows: ReconciliationRow[]) {
  return rows.reduce(
    (summary, row) => {
      summary.total += 1;
      if (row.status === 'MATCHED') summary.matched += 1;
      if (row.status === 'UNMATCHED') summary.unmatched += 1;
      if (row.status === 'SHORT_AMOUNT') summary.shortAmount += 1;
      if (row.status === 'OVER_AMOUNT') summary.overAmount += 1;
      if (row.status === 'WRONG_BANK') summary.wrongBank += 1;
      if (row.status === 'IGNORED_OUTGOING') summary.ignoredOutgoing += 1;
      return summary;
    },
    { total: 0, matched: 0, unmatched: 0, shortAmount: 0, overAmount: 0, wrongBank: 0, ignoredOutgoing: 0 },
  );
}

async function mockFinanceSePay(page: any) {
  let rows = createBaseRows();
  let lastFilters: { year?: string | null; month?: string | null; status?: string | null } | null = null;
  let manualAssignPayload: any = null;
  let resolvePayload: any = null;
  let refundPayload: any = null;

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

  await page.route('**/api/v1/finance/ledger*', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [] }),
    });
  });

  await page.route('**/api/v1/finance/sepay/reconciliation*', async (route: any) => {
    const url = new URL(route.request().url());
    const year = url.searchParams.get('year');
    const month = url.searchParams.get('month');
    const status = url.searchParams.get('status');
    lastFilters = { year, month, status };

    const filteredRows = rows.filter((row) => {
      const rowDate = new Date(row.createdAt);
      const yearMatches = !year || String(rowDate.getUTCFullYear()) === year;
      const monthMatches = !month || String(rowDate.getUTCMonth() + 1) === month;
      const statusMatches = !status || row.status === status;
      return yearMatches && monthMatches && statusMatches;
    });

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          summary: buildSummary(filteredRows),
          rows: filteredRows,
        },
      }),
    });
  });

  await page.route('**/api/v1/payments/sepay/manual-assign', async (route: any) => {
    manualAssignPayload = route.request().postDataJSON?.() || {};
    rows = rows.map((row) =>
      row.id === manualAssignPayload.logId
        ? {
            ...row,
            status: 'MATCHED',
            sourceType: manualAssignPayload.sourceType,
            requestStatus: 'CONFIRMED',
          }
        : row,
    );

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          success: true,
          paymentCode: rows.find((row) => row.id === manualAssignPayload.logId)?.paymentCode,
          sourceType: manualAssignPayload.sourceType,
          sourceCode: manualAssignPayload.sourceCode,
        },
      }),
    });
  });

  await page.route('**/api/v1/payments/sepay/resolve-overpayment', async (route: any) => {
    resolvePayload = route.request().postDataJSON?.() || {};
    rows = rows.map((row) =>
      row.id === resolvePayload.logId
        ? {
            ...row,
            overpaymentResolution: resolvePayload.resolution,
            overpaymentTaskTitle:
              resolvePayload.resolution === 'REFUND_PENDING'
                ? `Hoàn lại tiền thừa SePay cho ${row.paymentCode}`
                : row.overpaymentTaskTitle,
          }
        : row,
    );

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          success: true,
          paymentCode: rows.find((row) => row.id === resolvePayload.logId)?.paymentCode,
          resolution: resolvePayload.resolution,
        },
      }),
    });
  });

  await page.route('**/api/v1/payments/sepay/complete-overpayment-refund', async (route: any) => {
    refundPayload = route.request().postDataJSON?.() || {};
    rows = rows.map((row) =>
      row.id === refundPayload.logId
        ? {
            ...row,
            overpaymentRefundCompletedAt: '2026-08-11T04:00:00.000Z',
          }
        : row,
    );

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          success: true,
          paymentCode: rows.find((row) => row.id === refundPayload.logId)?.paymentCode,
        },
      }),
    });
  });

  return {
    getLastFilters: () => lastFilters,
    getManualAssignPayload: () => manualAssignPayload,
    getResolvePayload: () => resolvePayload,
    getRefundPayload: () => refundPayload,
  };
}

test.describe('Finance SePay Reconciliation Desktop Regression', () => {
  test.beforeEach(async ({ admin }, testInfo) => {
    test.skip(!/Desktop|Laptop/.test(testInfo.project.name), 'Desktop-only regression');
  });

  test('renders reconciliation rows and filters by status on desktop', async ({ admin }) => {
    const mock = await mockFinanceSePay(admin.page);

    await admin.page.goto('/finance', { waitUntil: 'domcontentloaded' });

    await expect(admin.page.getByTestId('sepay-reconciliation-summary')).toBeVisible();
    await expect
      .poll(() => mock.getLastFilters(), { timeout: 10000 })
      .toMatchObject({
        year: String(new Date().getFullYear()),
        month: null,
        status: null,
      });

    await expect(admin.page.getByTestId('sepay-row-log-unmatched-1')).toBeVisible();
    await expect(admin.page.getByTestId('sepay-row-log-over-1')).toBeVisible();
    await expect(admin.page.getByTestId('sepay-row-log-refund-1')).toBeVisible();
    await expect(admin.page.getByTestId('sepay-row-log-short-1')).toBeVisible();
    await expect(admin.page.getByTestId('sepay-row-log-wrong-bank-1')).toBeVisible();
    await expect(admin.page.getByTestId('sepay-row-log-outgoing-1')).toBeVisible();

    await admin.page.getByTestId('sepay-reconciliation-status').selectOption('OVER_AMOUNT');

    await expect
      .poll(() => mock.getLastFilters(), { timeout: 10000 })
      .toMatchObject({
        year: '2026',
        month: null,
        status: 'OVER_AMOUNT',
      });

    await expect(admin.page.getByTestId('sepay-row-log-over-1')).toBeVisible();
    await expect(admin.page.getByTestId('sepay-row-log-refund-1')).toBeVisible();
    await expect(admin.page.getByTestId('sepay-row-log-unmatched-1')).toHaveCount(0);
  });

  test('filters short amount, wrong bank, and outgoing transactions with correct action availability', async ({ admin }) => {
    const mock = await mockFinanceSePay(admin.page);

    await admin.page.goto('/finance', { waitUntil: 'domcontentloaded' });

    await admin.page.getByTestId('sepay-reconciliation-status').selectOption('SHORT_AMOUNT');

    await expect
      .poll(() => mock.getLastFilters(), { timeout: 10000 })
      .toMatchObject({
        year: '2026',
        month: null,
        status: 'SHORT_AMOUNT',
      });

    await expect(admin.page.getByTestId('sepay-row-log-short-1')).toBeVisible();
    await expect(admin.page.getByTestId('sepay-manual-assign-open-log-short-1')).toBeVisible();
    await expect(admin.page.getByTestId('sepay-row-log-wrong-bank-1')).toHaveCount(0);

    await admin.page.getByTestId('sepay-reconciliation-status').selectOption('WRONG_BANK');

    await expect
      .poll(() => mock.getLastFilters(), { timeout: 10000 })
      .toMatchObject({
        year: '2026',
        month: null,
        status: 'WRONG_BANK',
      });

    await expect(admin.page.getByTestId('sepay-row-log-wrong-bank-1')).toBeVisible();
    await expect(admin.page.getByTestId('sepay-manual-assign-open-log-wrong-bank-1')).toBeVisible();
    await expect(admin.page.getByTestId('sepay-row-log-short-1')).toHaveCount(0);

    await admin.page.getByTestId('sepay-reconciliation-status').selectOption('IGNORED_OUTGOING');

    await expect
      .poll(() => mock.getLastFilters(), { timeout: 10000 })
      .toMatchObject({
        year: '2026',
        month: null,
        status: 'IGNORED_OUTGOING',
      });

    await expect(admin.page.getByTestId('sepay-row-log-outgoing-1')).toBeVisible();
    await expect(admin.page.getByTestId('sepay-manual-assign-open-log-outgoing-1')).toHaveCount(0);
    await expect(admin.page.getByTestId('sepay-resolve-open-log-outgoing-1')).toHaveCount(0);
    await expect(admin.page.getByTestId('sepay-refund-complete-open-log-outgoing-1')).toHaveCount(0);
  });

  test('manually assigns an unmatched SePay transaction with the expected payload', async ({ admin }) => {
    const mock = await mockFinanceSePay(admin.page);

    await admin.page.goto('/finance', { waitUntil: 'domcontentloaded' });

    await admin.page.getByTestId('sepay-manual-assign-open-log-unmatched-1').click();
    await expect(admin.page.getByTestId('sepay-manual-assign-modal')).toBeVisible();

    await admin.page.getByTestId('sepay-manual-assign-source-type').selectOption('INVOICE');
    await admin.page.getByTestId('sepay-manual-assign-source-code').fill('INV-31-202608');
    await admin.page.getByTestId('sepay-manual-assign-submit').click();

    await expect
      .poll(() => mock.getManualAssignPayload(), { timeout: 10000 })
      .toMatchObject({
        logId: 'log-unmatched-1',
        sourceType: 'INVOICE',
        sourceCode: 'INV-31-202608',
      });

    await expect(admin.page.getByTestId('sepay-manual-assign-modal')).toHaveCount(0);
    await expect(admin.page.getByTestId('sepay-manual-assign-open-log-unmatched-1')).toHaveCount(0);
  });

  test('resolves SePay overpayment into pending refund with the expected payload', async ({ admin }) => {
    const mock = await mockFinanceSePay(admin.page);

    await admin.page.goto('/finance', { waitUntil: 'domcontentloaded' });

    await admin.page.getByTestId('sepay-resolve-open-log-over-1').click();
    await expect(admin.page.getByTestId('sepay-resolve-modal')).toBeVisible();

    await admin.page.getByTestId('sepay-resolve-select').selectOption('REFUND_PENDING');
    await admin.page.getByTestId('sepay-resolve-submit').click();

    await expect
      .poll(() => mock.getResolvePayload(), { timeout: 10000 })
      .toMatchObject({
        logId: 'log-over-1',
        resolution: 'REFUND_PENDING',
      });

    await expect(admin.page.getByTestId('sepay-resolve-modal')).toHaveCount(0);
    await expect(admin.page.getByTestId('sepay-refund-complete-open-log-over-1')).toBeVisible();
  });

  test('completes a pending SePay overpayment refund with note payload', async ({ admin }) => {
    const mock = await mockFinanceSePay(admin.page);

    await admin.page.goto('/finance', { waitUntil: 'domcontentloaded' });

    await admin.page.getByTestId('sepay-refund-complete-open-log-refund-1').click();
    await expect(admin.page.getByTestId('sepay-refund-complete-modal')).toBeVisible();

    await admin.page.getByTestId('sepay-refund-complete-note').fill('Đã hoàn qua MB Bank lúc 10:30');
    await admin.page.getByTestId('sepay-refund-complete-submit').click();

    await expect
      .poll(() => mock.getRefundPayload(), { timeout: 10000 })
      .toMatchObject({
        logId: 'log-refund-1',
        note: 'Đã hoàn qua MB Bank lúc 10:30',
      });

    await expect(admin.page.getByTestId('sepay-refund-complete-modal')).toHaveCount(0);
    await expect(admin.page.getByTestId('sepay-refund-complete-open-log-refund-1')).toHaveCount(0);
  });
});
