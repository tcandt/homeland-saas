import { expect } from '@playwright/test';
import { test } from '../../fixtures/admin.fixture';

async function mockCreditedInvoice(page: any) {
  await page.route('**/api/v1/invoices*', async (route: any) => {
    const url = new URL(route.request().url());
    const invoice = {
      id: 'invoice-credit-1',
      code: 'INV-CREDIT-001',
      status: 'ISSUED',
      total: 1_000_000,
      paidAmount: 300_000,
      creditAmount: 200_000,
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

    await expect(admin.page.getByText('Tỷ lệ thu hồi').locator('..')).toContainText('50.0%');

    await invoiceRow.getByRole('button').first().click();
    const drawer = admin.page.getByTestId('invoice-detail-drawer');
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText('Còn nợ').locator('..')).toContainText('500,000đ');
  });
});
