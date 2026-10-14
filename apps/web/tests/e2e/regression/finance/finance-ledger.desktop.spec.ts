import { expect } from '@playwright/test';
import { test } from '../../fixtures/admin.fixture';

test.describe('Finance ledger presentation contract', () => {
  test.beforeEach(async ({ admin }, testInfo) => test.skip(!/Desktop|Laptop/.test(testInfo.project.name), 'Desktop-only regression'));
  test('keeps the settlement formula visible when ledger data is empty', async ({ admin }) => {
    await admin.page.route('**/api/v1/finance/buildings/profit-summary*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [
      { building: { code: 'LK01.31' }, revenue: 4_000_000, expense: 1_000_000 },
      { building: { code: 'LK01.32' }, revenue: 3_000_000, expense: 0 },
      { building: { code: 'LK08.24' }, revenue: 2_000_000, expense: 400_000 },
      { building: { code: 'LK08.25' }, revenue: 1_000_000, expense: 0 },
    ] }) }));
    await admin.page.route('**/api/v1/finance/expenses*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [
      { id: 'direct-32', code: 'EXP-DIRECT-32', status: 'PAID', amount: 600_000, description: 'Vệ sinh LK01.32', building: { code: 'LK01.32' } },
      { id: 'cluster-01', code: 'EXP-CLUSTER-01', status: 'PAID', amount: 400_000, description: 'Bảo trì Cụm LK01' },
      { id: 'cancelled', code: 'EXP-CANCELLED', status: 'CANCELLED', amount: 9_000_000, description: 'Không được tính' },
    ] }) }));
    await admin.page.goto('/finance', { waitUntil: 'domcontentloaded' });
    await expect(admin.page.getByTestId('finance-root')).toBeVisible();
    await expect(admin.page.getByText('Bảng Quyết Toán Lợi Nhuận Thực Nhận', { exact: false })).toBeVisible();
    await expect(admin.page.getByText('Chia đôi 50% - 50%', { exact: false })).toBeVisible();
    await expect(admin.page.getByText('Bảng Bóc Tách Chi Tiết 4 Tòa', { exact: false })).toBeVisible();
    const totalRow = admin.page.getByRole('row').filter({ hasText: 'TỔNG CỘNG HỆ THỐNG' });
    await expect(totalRow.getByRole('cell').nth(1)).toHaveText('10.000.000 đ');
    await expect(totalRow.getByRole('cell').nth(2)).toHaveText('2.000.000 đ');
    await expect(totalRow.getByRole('cell').nth(3)).toHaveText('400.000 đ');
    await expect(totalRow.getByRole('cell').nth(4)).toHaveText('7.600.000 đ');
    await expect(admin.page.getByText('EXP-CANCELLED', { exact: true })).toHaveCount(0);
  });
});
