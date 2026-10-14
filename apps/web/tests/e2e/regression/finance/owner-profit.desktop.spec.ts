import { expect } from '@playwright/test';
import { test } from '../../fixtures/admin.fixture';

test.describe('Finance owner settlement contract', () => {
  test.beforeEach(async ({ admin }, testInfo) => test.skip(!/Desktop|Laptop/.test(testInfo.project.name), 'Desktop-only regression'));
  test('renders both equal-profit owner cards and the 50/50 invariant', async ({ admin }) => {
    await admin.page.route('**/api/v1/finance/buildings/profit-summary*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [
      { building: { code: 'LK01.31' }, revenue: 4_000_000, expense: 1_000_000 },
      { building: { code: 'LK01.32' }, revenue: 3_000_000, expense: 0 },
      { building: { code: 'LK08.24' }, revenue: 2_000_000, expense: 400_000 },
      { building: { code: 'LK08.25' }, revenue: 1_000_000, expense: 0 },
    ] }) }));
    await admin.page.route('**/api/v1/finance/expenses*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [
      { id: 'direct-32', code: 'EXP-DIRECT-32', status: 'PAID', amount: 600_000, description: 'Vệ sinh LK01.32', building: { code: 'LK01.32' } },
      { id: 'cluster-01', code: 'EXP-CLUSTER-01', status: 'PAID', amount: 400_000, description: 'Bảo trì Cụm LK01' },
      { id: 'cluster-08', code: 'EXP-CLUSTER-08', status: 'APPROVED', amount: 200_000, description: 'Điện Cụm LK08' },
      { id: 'common', code: 'EXP-COMMON', status: 'PAID', amount: 100_000, description: 'Phí phần mềm' },
      { id: 'cancelled', code: 'EXP-CANCELLED', status: 'CANCELLED', amount: 9_000_000, description: 'Không được tính' },
    ] }) }));
    await admin.page.goto('/finance', { waitUntil: 'domcontentloaded' });
    await expect(admin.page.getByText('Nguyễn Đức Tính', { exact: false }).first()).toBeVisible();
    await expect(admin.page.getByText('Phan Văn Thể', { exact: false }).first()).toBeVisible();
    await expect(admin.page.getByText('Thỏa thuận chia đôi 50% - 50%', { exact: false })).toBeVisible();
    await expect(admin.page.getByText('Tổng lợi nhuận ròng / 2', { exact: false }).first()).toBeVisible();
    const totalRow = admin.page.getByRole('row').filter({ hasText: 'TỔNG CỘNG HỆ THỐNG' });
    await expect(totalRow.getByRole('cell').nth(4)).toHaveText('7.300.000 đ');
    const tinhCard = admin.page.getByRole('heading', { name: 'Nguyễn Đức Tính', exact: true })
      .locator('xpath=ancestor::div[contains(@class,"border-blue-500/30")]');
    const theCard = admin.page.getByRole('heading', { name: 'Phan Văn Thể', exact: true })
      .locator('xpath=ancestor::div[contains(@class,"border-purple-500/30")]');
    await expect(tinhCard.getByText('3.650.000 đ', { exact: true })).toHaveCount(1);
    await expect(theCard.getByText('3.650.000 đ', { exact: true })).toHaveCount(1);
    await expect(admin.page.getByText('EXP-CANCELLED', { exact: true })).toHaveCount(0);
  });
});
