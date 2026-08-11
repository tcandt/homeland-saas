import { expect } from '@playwright/test';
import { test } from '../../fixtures/admin.fixture';

type ExpenseRow = {
  id: string;
  code: string;
  status: string;
  category: string;
  amount: number;
  description: string;
  createdAt: string;
  date: string;
  settlementStatus?: string;
  paidByName?: string | null;
  vendor?: string | null;
  attachmentUrls?: string[];
  owner?: { id: string; name: string | null };
  building?: { id: string; code: string; name: string };
  room?: { id: string; code: string; name: string } | null;
  costCenter?: { id: string; code: string; name: string } | null;
  paidByOwner?: { id: string; name: string | null } | null;
};

const baseBuilding = {
  id: 'building-1',
  name: 'LK01-31',
  code: 'LK01-31',
  address: '31 Homeland Street',
  ownerId: 'owner-1',
  images: [],
  status: 'active',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
};

const ownerSummary = [
  {
    owner: { id: 'owner-1', name: 'Tính', code: 'OWNER_A' },
    buildings: [{ id: 'building-1', code: 'LK01-31', name: 'LK01-31' }],
  },
];

function createExpenseRow(overrides: Partial<ExpenseRow> = {}): ExpenseRow {
  return {
    id: overrides.id || 'expense-1',
    code: overrides.code || 'EXP-001',
    status: overrides.status || 'PENDING',
    category: overrides.category || 'SUPPLIES',
    amount: overrides.amount ?? 350000,
    description: overrides.description || 'Mua vật tư vệ sinh',
    createdAt: overrides.createdAt || '2026-08-10T08:00:00.000Z',
    date: overrides.date || '2026-08-10T08:00:00.000Z',
    settlementStatus: overrides.settlementStatus || 'NONE',
    paidByName: overrides.paidByName ?? 'Admin A',
    vendor: overrides.vendor ?? 'Cửa hàng vật tư',
    attachmentUrls: overrides.attachmentUrls || [],
    owner: overrides.owner || { id: 'owner-1', name: 'Tính' },
    building: overrides.building || { id: 'building-1', code: 'LK01-31', name: 'LK01-31' },
    room: overrides.room ?? null,
    costCenter: overrides.costCenter ?? null,
    paidByOwner: overrides.paidByOwner ?? null,
  };
}

async function mockExpensePage(
  page: any,
  initialExpenses: ExpenseRow[],
  onCreate?: (payload: any) => void,
  onApprove?: (expenseId: string, payload: any) => void,
) {
  let expenses = [...initialExpenses];
  let expenseIndex = expenses.length + 1;

  await page.route('**/api/v1/buildings*', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          items: [baseBuilding],
          total: 1,
        },
      }),
    });
  });

  await page.route('**/api/v1/finance/owners/profit-summary', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: ownerSummary }),
    });
  });

  await page.route('**/api/v1/finance/ledger*', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [] }),
    });
  });

  await page.route('**/api/v1/finance/expenses/*/approve', async (route: any) => {
    const request = route.request();
    const url = new URL(request.url());
    const expenseId = url.pathname.split('/').slice(-2)[0];
    const payload = request.postDataJSON?.() || {};
    onApprove?.(expenseId, payload);
    expenses = expenses.map((expense) =>
      expense.id === expenseId
        ? {
            ...expense,
            status: payload?.markPaid ? 'PAID' : 'APPROVED',
          }
        : expense,
    );

    const expense = expenses.find((item) => item.id === expenseId);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: expense }),
    });
  });

  await page.route('**/api/v1/finance/expenses', async (route: any) => {
    const request = route.request();
    if (request.method() === 'POST') {
      const payload = request.postDataJSON?.() || {};
      onCreate?.(payload);

      const createdExpense = createExpenseRow({
        id: `expense-${expenseIndex}`,
        code: `EXP-NEW-${expenseIndex}`,
        status: payload.status || 'PENDING',
        category: payload.category || 'SUPPLIES',
        amount: Number(payload.amount || 0),
        description: payload.description || 'Chi phí mới',
        paidByName: payload.paidByName || null,
        vendor: payload.vendor || null,
      });
      expenseIndex += 1;
      expenses = [createdExpense, ...expenses];

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: createdExpense }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: expenses }),
    });
  });
}

test.describe('Finance Expenses Regression', () => {
  test('renders expense page with populated table', async ({ admin }) => {
    await mockExpensePage(admin.page, [
      createExpenseRow({ id: 'expense-1', code: 'EXP-001', status: 'PENDING' }),
      createExpenseRow({ id: 'expense-2', code: 'EXP-002', status: 'APPROVED', amount: 520000 }),
    ]);

    await admin.page.goto('/finance/expenses');

    await expect(admin.page.getByTestId('finance-expenses-root')).toBeVisible();
    await expect(admin.page.getByTestId('expense-open-create-modal')).toBeVisible();
    await expect(admin.page.getByTestId('expense-table-root')).toBeVisible();
    await expect(admin.page.getByTestId('expense-table-desktop')).toBeVisible();
    await expect(admin.page.getByTestId('expense-row-expense-1')).toBeVisible();
    await expect(admin.page.getByTestId('expense-row-expense-2')).toBeVisible();
  });

  test('creates a new expense from modal', async ({ admin }) => {
    let createdPayload: any = null;
    await mockExpensePage(
      admin.page,
      [createExpenseRow({ id: 'expense-1', code: 'EXP-001', status: 'APPROVED' })],
      (payload) => {
        createdPayload = payload;
      },
    );

    await admin.page.goto('/finance/expenses');
    await admin.page.getByTestId('expense-open-create-modal').click();

    await expect(admin.page.getByTestId('expense-create-modal')).toBeVisible();
    await admin.page.getByTestId('expense-create-building').selectOption('building-1');
    await admin.page.getByTestId('expense-create-category').selectOption('REPAIR');
    await admin.page.getByTestId('expense-create-status').selectOption('PENDING');
    await admin.page.getByTestId('expense-create-amount').fill('450000');
    await admin.page.locator('#expense-create-form input').nth(2).fill('Admin B');
    await admin.page.locator('#expense-create-form input').nth(3).fill('Nhà cung cấp A');
    await admin.page.locator('#expense-create-form textarea').fill('Sửa khóa cửa phòng 32-01');
    await admin.page.getByRole('button', { name: /lưu chi phí/i }).click();

    await expect
      .poll(() => createdPayload, { timeout: 10000 })
      .toMatchObject({
        buildingId: 'building-1',
        category: 'REPAIR',
        status: 'PENDING',
        amount: 450000,
        paidByName: 'Admin B',
        vendor: 'Nhà cung cấp A',
        description: 'Sửa khóa cửa phòng 32-01',
      });

    await expect(admin.page.getByTestId('expense-row-expense-2')).toBeVisible();
  });

  test('approves a pending expense through confirmation modal', async ({ admin }) => {
    let approvedPayload: any = null;
    let approvedExpenseId = '';

    await mockExpensePage(
      admin.page,
      [createExpenseRow({ id: 'expense-approve-1', code: 'EXP-APPROVE-1', status: 'PENDING' })],
      undefined,
      (expenseId, payload) => {
        approvedExpenseId = expenseId;
        approvedPayload = payload;
      },
    );

    await admin.page.goto('/finance/expenses');
    await admin.page.getByTestId('expense-approve-expense-approve-1').click();

    await expect(admin.page.getByTestId('expense-confirm-modal')).toBeVisible();
    await admin.page.getByTestId('expense-confirm-submit').click();

    await expect
      .poll(() => ({ approvedExpenseId, approvedPayload }), { timeout: 10000 })
      .toMatchObject({
        approvedExpenseId: 'expense-approve-1',
        approvedPayload: { markPaid: false },
      });

    await expect(admin.page.getByTestId('expense-confirm-modal')).not.toBeVisible();
    await expect(admin.page.getByTestId('expense-row-expense-approve-1')).toBeVisible();
  });
});
