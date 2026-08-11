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
    owner: { id: 'owner-1', name: 'TÃ­nh', code: 'OWNER_A' },
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
    description: overrides.description || 'Mua váº­t tÆ° vá»‡ sinh',
    createdAt: overrides.createdAt || '2026-08-10T08:00:00.000Z',
    date: overrides.date || '2026-08-10T08:00:00.000Z',
    settlementStatus: overrides.settlementStatus || 'NONE',
    paidByName: overrides.paidByName ?? 'Admin A',
    vendor: overrides.vendor ?? 'Cá»­a hÃ ng váº­t tÆ°',
    attachmentUrls: overrides.attachmentUrls || [],
    owner: overrides.owner || { id: 'owner-1', name: 'TÃ­nh' },
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
  onPay?: (expenseId: string) => void,
  onSettlement?: (expenseId: string, payload: any) => void,
  onCancel?: (expenseId: string, payload: any) => void,
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

  await page.route('**/api/v1/finance/expenses/*/pay', async (route: any) => {
    const request = route.request();
    const url = new URL(request.url());
    const expenseId = url.pathname.split('/').slice(-2)[0];
    onPay?.(expenseId);
    expenses = expenses.map((expense) =>
      expense.id === expenseId
        ? {
            ...expense,
            status: 'PAID',
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

  await page.route('**/api/v1/finance/expenses/*/settlement', async (route: any) => {
    const request = route.request();
    const url = new URL(request.url());
    const expenseId = url.pathname.split('/').slice(-2)[0];
    const payload = request.postDataJSON?.() || {};
    onSettlement?.(expenseId, payload);
    expenses = expenses.map((expense) =>
      expense.id === expenseId
        ? {
            ...expense,
            settlementStatus: payload?.settlementStatus || expense.settlementStatus,
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

  await page.route('**/api/v1/finance/expenses/*/cancel', async (route: any) => {
    const request = route.request();
    const url = new URL(request.url());
    const expenseId = url.pathname.split('/').slice(-2)[0];
    const payload = request.postDataJSON?.() || {};
    onCancel?.(expenseId, payload);
    expenses = expenses.map((expense) =>
      expense.id === expenseId
        ? {
            ...expense,
            status: 'CANCELLED',
            settlementStatus: 'NONE',
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

  await page.route('**/api/v1/finance/expenses*', async (route: any) => {
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
        description: payload.description || 'Chi phÃ­ má»›i',
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
    await expect(admin.page.getByTestId('expense-table-create-button')).toBeVisible();
    await expect(admin.page.getByTestId('expense-table-root')).toBeVisible();
    await expect(admin.page.getByTestId('expense-table-desktop')).toBeVisible();
    await expect(admin.page.locator('tr', { hasText: 'EXP-001' }).first()).toBeVisible();
    await expect(admin.page.locator('tr', { hasText: 'EXP-002' }).first()).toBeVisible();
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
    await admin.page.getByTestId('expense-table-create-button').click();

    await expect(admin.page.getByTestId('expense-create-modal')).toBeVisible();
    const createForm = admin.page.getByTestId('expense-create-form');
    await admin.page.getByTestId('expense-create-building').getByText('LK01-31').click();
    await createForm.locator('select').nth(0).selectOption('REPAIR');
    await createForm.locator('select').nth(1).selectOption('PENDING');
    await admin.page.getByTestId('expense-create-amount').fill('450000');
    await createForm.getByPlaceholder(/admin/i).fill('Admin B');
    await createForm.getByPlaceholder(/Cửa hàng vật tư/i).fill('Nhà cung cấp A');
    await createForm.locator('textarea').fill('Sửa khóa cửa phòng 32-01');
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

    await expect(admin.page.locator('tr', { hasText: 'EXP-NEW-2' }).first()).toBeVisible();
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
    const pendingRow = admin.page.locator('tr', { hasText: 'EXP-APPROVE-1' }).first();
    await expect(pendingRow).toBeVisible();
    await pendingRow.getByRole('button', { name: /mở thao tác/i }).click();
    await pendingRow.getByTestId('expense-approve-expense-approve-1').click();

    await expect(admin.page.getByTestId('expense-confirm-modal')).toBeVisible();
    await admin.page.getByTestId('expense-confirm-submit').click();

    await expect
      .poll(() => ({ approvedExpenseId, approvedPayload }), { timeout: 10000 })
      .toMatchObject({
        approvedExpenseId: 'expense-approve-1',
        approvedPayload: { markPaid: false },
      });

    await expect(admin.page.getByTestId('expense-confirm-modal')).not.toBeVisible();
    await expect(admin.page.locator('tr', { hasText: 'EXP-APPROVE-1' }).first()).toBeVisible();
  });

  test('marks an approved expense as paid through confirmation modal', async ({ admin }) => {
    let paidExpenseId = '';

    await mockExpensePage(
      admin.page,
      [createExpenseRow({ id: 'expense-pay-1', code: 'EXP-PAY-1', status: 'APPROVED' })],
      undefined,
      undefined,
      (expenseId) => {
        paidExpenseId = expenseId;
      },
    );

    await admin.page.goto('/finance/expenses');
    const approvedRow = admin.page.locator('tr', { hasText: 'EXP-PAY-1' }).first();
    await expect(approvedRow).toBeVisible();
    await approvedRow.getByRole('button', { name: /mở thao tác/i }).click();
    await approvedRow.getByTestId('expense-pay-expense-pay-1').click();

    await expect(admin.page.getByTestId('expense-confirm-modal')).toBeVisible();
    await admin.page.getByTestId('expense-confirm-submit').click();

    await expect.poll(() => paidExpenseId, { timeout: 10000 }).toBe('expense-pay-1');
    await expect(admin.page.getByTestId('expense-confirm-modal')).not.toBeVisible();
    await expect(admin.page.locator('tr', { hasText: 'EXP-PAY-1' }).first()).toBeVisible();
  });

  test('marks reimbursement as completed from expense table', async ({ admin }) => {
    let settlementChange: any = null;

    await mockExpensePage(
      admin.page,
      [
        createExpenseRow({
          id: 'expense-reimburse-1',
          code: 'EXP-REIMBURSE-1',
          status: 'PAID',
          settlementStatus: 'PENDING_REIMBURSEMENT',
          paidByName: 'Admin B',
        }),
      ],
      undefined,
      undefined,
      undefined,
      (expenseId, payload) => {
        settlementChange = { expenseId, payload };
      },
    );

    await admin.page.goto('/finance/expenses');
    const paidRow = admin.page.locator('tr', { hasText: 'EXP-REIMBURSE-1' }).first();
    await expect(paidRow).toBeVisible();
    await paidRow.getByRole('button', { name: /mở thao tác/i }).click();
    await paidRow.getByTestId('expense-reimburse-expense-reimburse-1').click();

    await expect(admin.page.getByTestId('expense-confirm-modal')).toBeVisible();
    await admin.page.getByTestId('expense-confirm-submit').click();

    await expect
      .poll(() => settlementChange, { timeout: 10000 })
      .toMatchObject({
        expenseId: 'expense-reimburse-1',
        payload: { settlementStatus: 'REIMBURSED' },
      });
  });

  test('marks expense for owner-profit deduction from expense table', async ({ admin }) => {
    let settlementChange: any = null;

    await mockExpensePage(
      admin.page,
      [
        createExpenseRow({
          id: 'expense-deduct-1',
          code: 'EXP-DEDUCT-1',
          status: 'PAID',
          settlementStatus: 'PENDING_REIMBURSEMENT',
          paidByName: 'Admin B',
        }),
      ],
      undefined,
      undefined,
      undefined,
      (expenseId, payload) => {
        settlementChange = { expenseId, payload };
      },
    );

    await admin.page.goto('/finance/expenses');
    const paidRow = admin.page.locator('tr', { hasText: 'EXP-DEDUCT-1' }).first();
    await expect(paidRow).toBeVisible();
    await paidRow.getByRole('button', { name: /mở thao tác/i }).click();
    await paidRow.getByTestId('expense-deduct-expense-deduct-1').click();

    await expect(admin.page.getByTestId('expense-confirm-modal')).toBeVisible();
    await admin.page.getByTestId('expense-confirm-submit').click();

    await expect
      .poll(() => settlementChange, { timeout: 10000 })
      .toMatchObject({
        expenseId: 'expense-deduct-1',
        payload: { settlementStatus: 'DEDUCTED_FROM_PROFIT' },
      });
  });

  test('cancels an expense from expense table', async ({ admin }) => {
    let cancelChange: any = null;

    await mockExpensePage(
      admin.page,
      [createExpenseRow({ id: 'expense-cancel-1', code: 'EXP-CANCEL-1', status: 'APPROVED' })],
      undefined,
      undefined,
      undefined,
      undefined,
      (expenseId, payload) => {
        cancelChange = { expenseId, payload };
      },
    );

    await admin.page.goto('/finance/expenses');
    const approvedRow = admin.page.locator('tr', { hasText: 'EXP-CANCEL-1' }).first();
    await expect(approvedRow).toBeVisible();
    await approvedRow.getByRole('button', { name: /mở thao tác/i }).click();
    await approvedRow.getByTestId('expense-cancel-expense-cancel-1').click();

    await expect(admin.page.getByTestId('expense-confirm-modal')).toBeVisible();
    await admin.page.getByTestId('expense-confirm-submit').click();

    await expect
      .poll(() => cancelChange, { timeout: 10000 })
      .toMatchObject({
        expenseId: 'expense-cancel-1',
        payload: { reason: 'Hủy từ bảng chi phí' },
      });
  });
});
