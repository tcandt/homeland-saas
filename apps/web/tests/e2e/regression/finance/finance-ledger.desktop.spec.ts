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

const ledgerApiRows = [
  {
    id: 'line-1',
    journalEntry: {
      id: 'journal-1',
      code: 'JE-DEP-001',
      description: 'Thu tiền cọc LK01-31',
      sourceType: 'DEPOSIT',
      status: 'POSTED',
    },
    createdAt: '2026-08-11T08:15:00.000Z',
    description: 'Thu tiền cọc từ khách A',
    account: { code: '111', name: 'Tiền mặt' },
    costCenter: { name: 'LK01-31' },
    type: 'DEBIT',
    amount: 1500000,
  },
  {
    id: 'line-2',
    journalEntry: {
      id: 'journal-1',
      code: 'JE-DEP-001',
      description: 'Thu tiền cọc LK01-31',
      sourceType: 'DEPOSIT',
      status: 'POSTED',
    },
    createdAt: '2026-08-11T08:15:00.000Z',
    description: 'Ghi nhận nợ phải trả tiền cọc',
    account: { code: '338', name: 'Tiền cọc khách thuê' },
    costCenter: { name: 'LK01-31' },
    type: 'CREDIT',
    amount: 1500000,
  },
  {
    id: 'line-3',
    journalEntry: {
      id: 'journal-2',
      code: 'JE-EXP-001',
      description: 'Chi phí sửa cửa phòng 32-01',
      sourceType: 'EXPENSE',
      status: 'DRAFT',
    },
    createdAt: '2026-08-10T14:40:00.000Z',
    description: 'Chi phí vật tư sửa cửa',
    account: { code: '642', name: 'Chi phí quản lý' },
    costCenter: { name: 'LK01-32' },
    type: 'DEBIT',
    amount: 780000,
  },
  {
    id: 'line-4',
    journalEntry: {
      id: 'journal-2',
      code: 'JE-EXP-001',
      description: 'Chi phí sửa cửa phòng 32-01',
      sourceType: 'EXPENSE',
      status: 'DRAFT',
    },
    createdAt: '2026-08-10T14:40:00.000Z',
    description: 'Công nợ phải trả nhà cung cấp',
    account: { code: '331', name: 'Phải trả nhà cung cấp' },
    costCenter: { name: 'LK01-32' },
    type: 'CREDIT',
    amount: 780000,
  },
];

async function mockFinanceLedgerDesktop(page: any) {
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
      body: JSON.stringify({ success: true, data: ledgerApiRows }),
    });
  });
}

test.describe('Finance Ledger Desktop Regression', () => {
  test.beforeEach(async ({ admin }, testInfo) => {
    test.skip(!/Desktop|Laptop/.test(testInfo.project.name), 'Desktop-only regression');
  });

  test('renders desktop ledger rows and right-panel counters from ledger data', async ({ admin }) => {
    await mockFinanceLedgerDesktop(admin.page);

    await admin.page.goto('/finance', { waitUntil: 'domcontentloaded' });

    await expect(admin.page.getByTestId('finance-ledger')).toBeVisible();
    await expect(admin.page.getByTestId('finance-ledger-row-line-1')).toBeVisible();
    await expect(admin.page.getByTestId('finance-ledger-row-line-3')).toBeVisible();
    await expect(admin.page.getByTestId('finance-right-panel')).toBeVisible();
    await expect(admin.page.getByTestId('finance-right-panel')).toContainText('2 bút toán nháp');
    await expect(admin.page.getByTestId('finance-right-panel')).toContainText('2 bút toán đã ghi sổ');
    await expect(admin.page.getByTestId('finance-right-panel')).toContainText('2 nguồn tiền cọc, 2 nguồn chi phí');
  });

  test('opens journal drawer with correct details when selecting a ledger row', async ({ admin }) => {
    await mockFinanceLedgerDesktop(admin.page);

    await admin.page.goto('/finance', { waitUntil: 'domcontentloaded' });

    await admin.page.getByTestId('finance-ledger-row-line-1').click();

    await expect(admin.page.getByTestId('finance-drawer')).toBeVisible();
    await expect(admin.page.getByText('Bút toán: JE-DEP-001')).toBeVisible();
    await expect(admin.page.getByTestId('finance-status-badge')).toContainText('POSTED');
    await expect(admin.page.getByText('DEPOSIT')).toBeVisible();
    await expect(admin.page.getByText('Thu tiền cọc LK01-31')).toBeVisible();
    await expect(admin.page.getByText('111 - Tiền mặt')).toBeVisible();
    await expect(admin.page.getByText('338 - Tiền cọc khách thuê')).toBeVisible();
    await expect(admin.page.getByText('1,500,000').first()).toBeVisible();

    await admin.page.getByTestId('finance-drawer-close').click();
    await expect(admin.page.getByTestId('finance-drawer')).toHaveCount(0);
  });

  test('switches drawer context when selecting another journal line', async ({ admin }) => {
    await mockFinanceLedgerDesktop(admin.page);

    await admin.page.goto('/finance', { waitUntil: 'domcontentloaded' });

    await admin.page.getByTestId('finance-ledger-row-line-3').click();

    await expect(admin.page.getByTestId('finance-drawer')).toBeVisible();
    await expect(admin.page.getByText('Bút toán: JE-EXP-001')).toBeVisible();
    await expect(admin.page.getByTestId('finance-status-badge')).toContainText('DRAFT');
    await expect(admin.page.getByText('EXPENSE')).toBeVisible();
    await expect(admin.page.getByText('Chi phí sửa cửa phòng 32-01')).toBeVisible();
    await expect(admin.page.getByText('642 - Chi phí quản lý')).toBeVisible();
    await expect(admin.page.getByText('331 - Phải trả nhà cung cấp')).toBeVisible();
    await expect(admin.page.getByText('780,000').first()).toBeVisible();
  });
});
