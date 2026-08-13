import { expect } from '@playwright/test';
import { test } from '../../fixtures/admin.fixture';

type BankTransactionRow = {
  id: string;
  createdAt: string;
  direction: 'IN' | 'OUT';
  amount: number;
  content: string;
  paymentCode?: string | null;
  providerTransactionId?: string | null;
  reference?: string | null;
  owner?: { id: string; name: string | null } | null;
  bankAccount?: {
    id: string;
    bankName: string;
    accountName: string;
    accountNumber: string;
  } | null;
  match?: { status: string } | null;
};

const bankAccounts = [
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
];

const baseRows: BankTransactionRow[] = [
  {
    id: 'txn-0',
    createdAt: '2026-07-15T09:00:00.000Z',
    direction: 'IN',
    amount: 900000,
    content: 'Thu coc giu phong LK08-24',
    paymentCode: 'DEP-LK0824-001',
    providerTransactionId: 'MB-0000',
    reference: 'REF-000',
    owner: { id: 'owner-1', name: 'Tính' },
    bankAccount: bankAccounts[0],
    match: { status: 'MATCHED_DEPOSIT' },
  },
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
    bankAccount: bankAccounts[0],
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
    bankAccount: bankAccounts[1],
    match: null,
  },
];

function buildResponse(rows: BankTransactionRow[]) {
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
      bankAccounts,
    },
  };
}

async function mockBankTransactions(page: any) {
  let lastQuery: {
    year?: string | null;
    month?: string | null;
    direction?: string | null;
    content?: string | null;
    search?: string | null;
    bankAccountId?: string | null;
  } | null = null;

  await page.route('**/api/v1/finance/banks/transactions*', async (route: any) => {
    const url = new URL(route.request().url());
    const year = url.searchParams.get('year');
    const month = url.searchParams.get('month');
    const direction = url.searchParams.get('direction') || '';
    const content = (url.searchParams.get('content') || '').toLowerCase();
    const search = (url.searchParams.get('search') || '').toLowerCase();
    const bankAccountId = url.searchParams.get('bankAccountId') || '';
    lastQuery = {
      year,
      month,
      direction: direction || null,
      content: content || null,
      search: search || null,
      bankAccountId: bankAccountId || null,
    };

    let rows = [...baseRows];
    rows = rows.filter((row) => {
      const rowDate = new Date(row.createdAt);
      const yearMatches = !year || String(rowDate.getUTCFullYear()) === year;
      const monthMatches = !month || String(rowDate.getUTCMonth() + 1) === month;
      return yearMatches && monthMatches;
    });

    if (direction) {
      rows = rows.filter((row) => row.direction === direction);
    }
    if (bankAccountId) {
      rows = rows.filter((row) => row.bankAccount?.id === bankAccountId);
    }
    if (content) {
      rows = rows.filter((row) => row.content.toLowerCase().includes(content));
    }
    if (search) {
      rows = rows.filter((row) =>
        [row.paymentCode, row.providerTransactionId, row.reference, row.bankAccount?.accountName, row.bankAccount?.bankName]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(search),
      );
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: buildResponse(rows),
      }),
    });
  });

  return {
    getLastQuery: () => lastQuery,
  };
}

test.describe('Finance Transactions Regression', () => {
  test.beforeEach(async ({ admin }, testInfo) => {
    test.skip(!/Desktop|Laptop/.test(testInfo.project.name), 'Desktop-only regression');
  });

  test('renders populated desktop bank transaction history', async ({ admin }) => {
    const mock = await mockBankTransactions(admin.page);

    await admin.page.goto('/finance/transactions', { waitUntil: 'domcontentloaded' });

    await expect
      .poll(() => mock.getLastQuery(), { timeout: 10000 })
      .toMatchObject({
        year: '2026',
        month: null,
        direction: null,
        content: null,
        search: null,
        bankAccountId: null,
      });

    await expect(admin.page.getByTestId('bank-transactions-kpis')).toBeVisible();
    await expect(admin.page.getByTestId('bank-transactions-table')).toBeVisible();
    await expect(admin.page.getByTestId('bank-transaction-row-txn-0')).toBeVisible();
    await expect(admin.page.getByTestId('bank-transaction-row-txn-1')).toBeVisible();
    await expect(admin.page.getByTestId('bank-transaction-row-txn-2')).toBeVisible();
    await expect(admin.page.getByTestId('bank-transactions-kpis')).toContainText('3');
    await expect(admin.page.getByTestId('bank-transactions-kpis')).toContainText('3.400.000');
    await expect(admin.page.getByTestId('bank-transactions-kpis')).toContainText('780.000');
    await expect(admin.page.getByTestId('bank-transactions-kpis')).toContainText('2.620.000');
  });

  test('filters rows by direction on desktop', async ({ admin }) => {
    const mock = await mockBankTransactions(admin.page);

    await admin.page.goto('/finance/transactions', { waitUntil: 'domcontentloaded' });

    await admin.page.getByTestId('bank-transactions-direction').selectOption('OUT');

    await expect
      .poll(() => mock.getLastQuery(), { timeout: 10000 })
      .toMatchObject({
        year: '2026',
        month: null,
        direction: 'OUT',
      });

    await expect(admin.page.getByTestId('bank-transaction-row-txn-2')).toBeVisible();
    await expect(admin.page.getByTestId('bank-transaction-row-txn-1')).toHaveCount(0);
    await expect(admin.page.getByTestId('bank-transactions-kpis')).toContainText('1');
    await expect(admin.page.getByTestId('bank-transactions-kpis')).toContainText('780.000');
  });

  test('shows empty state when no transactions match search', async ({ admin }) => {
    const mock = await mockBankTransactions(admin.page);

    await admin.page.goto('/finance/transactions', { waitUntil: 'domcontentloaded' });
    await admin.page.getByTestId('bank-transactions-search').fill('NO-MATCH-KEYWORD');

    await expect
      .poll(() => mock.getLastQuery(), { timeout: 10000 })
      .toMatchObject({
        year: '2026',
        month: null,
        search: 'no-match-keyword',
      });

    await expect(admin.page.getByTestId('bank-transactions-empty')).toBeVisible();
    await expect(admin.page.getByTestId('bank-transaction-row-txn-1')).toHaveCount(0);
    await expect(admin.page.getByTestId('bank-transaction-row-txn-2')).toHaveCount(0);
  });

  test('filters by bank account and content together on desktop', async ({ admin }) => {
    const mock = await mockBankTransactions(admin.page);

    await admin.page.goto('/finance/transactions', { waitUntil: 'domcontentloaded' });

    await admin.page.getByTestId('bank-transactions-account').selectOption('bank-1');
    await admin.page.getByTestId('bank-transactions-content-filter').fill('thu tien phong');

    await expect
      .poll(() => mock.getLastQuery(), { timeout: 10000 })
      .toMatchObject({
        year: '2026',
        month: null,
        bankAccountId: 'bank-1',
        content: 'thu tien phong',
      });

    await expect(admin.page.getByTestId('bank-transaction-row-txn-1')).toBeVisible();
    await expect(admin.page.getByTestId('bank-transaction-row-txn-2')).toHaveCount(0);
    await expect(admin.page.getByTestId('bank-transactions-kpis')).toContainText('1');
    await expect(admin.page.getByTestId('bank-transactions-kpis')).toContainText('2.500.000');
  });

  test('filters rows by month and search term together on desktop', async ({ admin }) => {
    const mock = await mockBankTransactions(admin.page);

    await admin.page.goto('/finance/transactions', { waitUntil: 'domcontentloaded' });

    await admin.page.getByTestId('bank-transactions-month').selectOption('7');
    await admin.page.getByTestId('bank-transactions-search').fill('mb bank');

    await expect
      .poll(() => mock.getLastQuery(), { timeout: 10000 })
      .toMatchObject({
        year: '2026',
        month: '7',
        search: 'mb bank',
      });

    await expect(admin.page.getByTestId('bank-transaction-row-txn-0')).toBeVisible();
    await expect(admin.page.getByTestId('bank-transaction-row-txn-1')).toHaveCount(0);
    await expect(admin.page.getByTestId('bank-transaction-row-txn-2')).toHaveCount(0);
    await expect(admin.page.getByTestId('bank-transactions-kpis')).toContainText('1');
    await expect(admin.page.getByTestId('bank-transactions-kpis')).toContainText('900.000');
  });
});
