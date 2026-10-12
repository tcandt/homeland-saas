import { expect } from '@playwright/test';
import { test } from '../fixtures/admin.fixture';
import AxeBuilder from '@axe-core/playwright';

const invoice = {
  id: 'inv-smoke-001', code: 'INV-SMOKE-001', status: 'ISSUED',
  totalAmount: 5_000_000, paidAmount: 0, period: '10/2026',
  createdAt: '2026-10-01T00:00:00.000Z', dueDate: '2026-10-05T00:00:00.000Z',
  customer: { name: 'Smoke Customer' },
  contract: { code: 'HD-SMOKE-001', room: { number: '101', building: { name: 'Smoke Building' } } },
};

async function mockInvoices(page: any, data: any[] = [invoice], status = 200) {
  await page.route('**/api/v1/invoices*', route => route.fulfill({ status, contentType: 'application/json', body: status === 200 ? JSON.stringify({ success: true, data, meta: { page: 1, limit: 100, total: data.length } }) : JSON.stringify({ message: 'Internal Server Error' }) }));
  await page.route('**/api/v1/deposits/billing-documents*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) }));
}

test.describe('Invoices Smoke Test', () => {
  test('renders current invoice table and detail dialog', async ({ admin }) => {
    await mockInvoices(admin.page);
    await admin.page.goto('/invoices');
    await expect(admin.page.getByTestId('invoices-root')).toBeVisible();
    await expect(admin.page.getByTestId('invoices-kpi-grid')).toBeVisible();
    const list = admin.page.getByTestId('invoices-list');
    await expect(list).toBeVisible();
    const row = list.getByText(invoice.code, { exact: true }).locator('xpath=ancestor::tr');
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('5.000.000');
    await expect(row).toContainText('0');
    await expect(row).toContainText('Chờ thanh toán');
    await row.click();
    const dialog = admin.page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Chi tiết hóa đơn');
    await expect(dialog).toContainText(invoice.code);
    await dialog.getByTitle('Đóng (ESC)').click();
    await expect(dialog).toBeHidden();
    const axe = await new AxeBuilder({ page: admin.page }).disableRules(['color-contrast', 'heading-order', 'button-name', 'landmark-unique', 'region', 'select-name']).analyze();
    expect(axe.violations).toEqual([]);
  });

  test('renders current empty text', async ({ admin }) => {
    await mockInvoices(admin.page, []);
    await admin.page.goto('/invoices');
    await expect(admin.page.getByTestId('invoices-list')).toContainText('Chưa có hóa đơn hoặc phiếu cọc phù hợp');
  });

  test('renders current error text', async ({ admin }) => {
    await mockInvoices(admin.page, [], 500);
    await admin.page.goto('/invoices');
    await expect(admin.page.getByTestId('invoices-list')).toContainText('Không thể tải danh sách hóa đơn. Vui lòng thử lại.');
  });
});
