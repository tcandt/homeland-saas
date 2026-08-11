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
  await page.route('**/api/v1/finance/banks/transactions*', async (route: any) => {
    const url = new URL(route.request().url());
    const direction = url.searchParams.get('direction') || '';
    const content = (url.searchParams.get('content') || '').toLowerCase();
    const search = (url.searchParams.get('search') || '').toLowerCase();
    const bankAccountId = url.searchParams.get('bankAccountId') || '';

    let rows = [...baseRows];

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
}

test.describe('Finance Transactions Regression', () => {
  test('renders populated desktop bank transaction history', async ({ admin }) => {
    await mockBankTransactions(admin.page);

    await admin.page.goto('/finance/transactions');

    await expect(admin.page.getByTestId('bank-transactions-root')).toBeVisible();
    await expect(admin.page.getByTestId('bank-transactions-kpis')).toBeVisible();
    await expect(admin.page.getByTestId('bank-transactions-table')).toBeVisible();
    await expect(admin.page.getByTestId('bank-transaction-row-txn-1')).toBeVisible();
    await expect(admin.page.getByTestId('bank-transaction-row-txn-2')).toBeVisible();
  });

  test('filters rows by direction on desktop', async ({ admin }) => {
    await mockBankTransactions(admin.page);

    await admin.page.goto('/finance/transactions');

    await admin.page.getByTestId('bank-transactions-direction').selectOption('OUT');

    await expect(admin.page.getByTestId('bank-transaction-row-txn-2')).toBeVisible();
    await expect(admin.page.getByTestId('bank-transaction-row-txn-1')).toHaveCount(0);
  });

  test('shows empty state when no transactions match search', async ({ admin }) => {
    await mockBankTransactions(admin.page);

    await admin.page.goto('/finance/transactions');
    await admin.page.getByTestId('bank-transactions-search').fill('NO-MATCH-KEYWORD');

    await expect(admin.page.getByTestId('bank-transactions-empty')).toBeVisible();
    await expect(admin.page.getByTestId('bank-transaction-row-txn-1')).toHaveCount(0);
    await expect(admin.page.getByTestId('bank-transaction-row-txn-2')).toHaveCount(0);
  });
});
