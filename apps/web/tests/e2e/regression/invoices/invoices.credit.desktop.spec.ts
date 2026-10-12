import { expect } from '@playwright/test';
import { test } from '../../fixtures/admin.fixture';

async function mockCreditedInvoice(page: any) {
  await page.route('**/api/v1/invoices**', async (route: any) => {
    const url = new URL(route.request().url());
    const invoice = {
      id: 'invoice-credit-1',
      code: 'INV-CREDIT-001',
      status: 'ISSUED',
      total: 1_000_000,
      paidAmount: 300_000,
      creditAmount: 200_000,
      paymentRequests: [{ id: 'payment-request-credit-1', status: 'PENDING', amount: 500_000, code: 'PAY-CREDIT-001' }],
      createdAt: '2026-08-10T08:00:00.000Z',
      dueDate: '2026-08-20T00:00:00.000Z',
      customer: { id: 'customer-1', fullName: 'Khách Cấn Cọc' },
      contract: {
        roomId: 'room-1',
        room: {
          id: 'room-1',
          code: '31-01',
          building: { id: 'building-1', code: 'LK01-31', name: 'LK01-31' },
        },
      },
      items: [],
    };

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: url.pathname.endsWith('/invoice-credit-1') ? invoice : { items: [invoice], total: 1 },
      }),
    });
  });
}

test.describe('Invoice Credit Desktop Regression', () => {
  test.beforeEach(async ({ admin }, testInfo) => {
    test.skip(!/Desktop|Laptop/.test(testInfo.project.name), 'Desktop-only regression');
  });

  test('subtracts settlement credit from debt without inflating cash collected', async ({ admin }) => {
    await mockCreditedInvoice(admin.page);

    await admin.page.goto('/invoices', { waitUntil: 'domcontentloaded' });

    const invoiceRow = admin.page.locator('tr').filter({ hasText: 'Khách Cấn Cọc' }).first();
    await expect(invoiceRow).toBeVisible();
    await expect(invoiceRow).toContainText('1.000.000 đ');
    await expect(invoiceRow).toContainText('300.000 đ');
    await expect(invoiceRow).toContainText('500.000 đ');

    const kpis = admin.page.getByTestId('invoices-kpi-grid');
    const cashKpi = kpis.locator(':scope > div').filter({ hasText: /^Đã thu/ });
    await expect(cashKpi).toContainText('300.000 đ');
    await expect(cashKpi).toContainText('30%');
    await expect(cashKpi).not.toContainText('500.000 đ');
    const remainingKpi = kpis.locator(':scope > div').filter({ hasText: /^Còn phải thu/ });
    await expect(remainingKpi).toContainText('500.000 đ');
    await expect(remainingKpi).toContainText('50%');

    await invoiceRow.click();
    const drawer = admin.page.getByRole('dialog').filter({ has: admin.page.getByRole('heading', { name: 'Chi tiết hóa đơn', exact: true }) });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText('Số tiền cần thanh toán', { exact: true }).locator('..')).toContainText('500.000 đ');
  });
});
