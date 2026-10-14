import { expect } from '@playwright/test';
import { test } from '../../fixtures/admin.fixture';

async function mockFinance(page: any) {
  await page.route('**/api/v1/finance/buildings/profit-summary*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [
    { building: { code: 'LK01.31', roomCount: 1, occupiedRooms: 1 }, revenue: 4_000_000, expense: 1_000_000 },
    { building: { code: 'LK01.32', roomCount: 1, occupiedRooms: 1 }, revenue: 3_000_000, expense: 0 },
    { building: { code: 'LK08.24', roomCount: 1, occupiedRooms: 1 }, revenue: 2_000_000, expense: 400_000 },
    { building: { code: 'LK08.25', roomCount: 1, occupiedRooms: 1 }, revenue: 1_000_000, expense: 0 },
  ] }) }));
  await page.route('**/api/v1/finance/expenses*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [
    { id: 'direct-32', code: 'EXP-DIRECT-32', status: 'PAID', amount: 600_000, description: 'Vệ sinh LK01.32', building: { code: 'LK01.32' } },
    { id: 'cluster-01', code: 'EXP-CLUSTER-01', status: 'PAID', amount: 400_000, description: 'Bảo trì Cụm LK01' },
    { id: 'cluster-08', code: 'EXP-CLUSTER-08', status: 'APPROVED', amount: 200_000, description: 'Điện Cụm LK08' },
    { id: 'common', code: 'EXP-COMMON', status: 'PAID', amount: 100_000, description: 'Phí phần mềm' },
    { id: 'cancelled', code: 'EXP-CANCELLED', status: 'CANCELLED', amount: 9_000_000, description: 'Không được tính' },
  ] }) }));
}

test.describe('Finance current settlement contract', () => {
  test.beforeEach(async ({ admin }, testInfo) => test.skip(!/Desktop|Laptop/.test(testInfo.project.name), 'Desktop-only regression'));
  test('renders the current GMT+7 report period and settlement formula', async ({ admin }) => {
    await mockFinance(admin.page);
    await admin.page.goto('/finance', { waitUntil: 'domcontentloaded' });
    const now = new Date();
    const month = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Ho_Chi_Minh', month: '2-digit' }).format(now);
    const year = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric' }).format(now);
    await expect(admin.page.getByTestId('finance-root')).toBeVisible();
    await expect(admin.page.getByText(new RegExp(`Kỳ báo cáo:\\s*${month}/${year} → ${month}/${year}`))).toBeVisible();
    await expect(admin.page.getByText('Lợi Nhuận Ròng', { exact: false }).first()).toBeVisible();
    await expect(admin.page.getByText('Doanh thu − Chi phí − Phát sinh', { exact: false }).first()).toBeVisible();
    // Revenue (10m) - direct expense (2m) - incidental/common (700k) = 7.3m;
    // equal 50/50 settlement pays each owner 3.65m.
    const totalRow = admin.page.getByRole('row').filter({ hasText: 'TỔNG CỘNG HỆ THỐNG' });
    await expect(totalRow.getByRole('cell').nth(1)).toHaveText('10.000.000 đ');
    await expect(totalRow.getByRole('cell').nth(2)).toHaveText('2.000.000 đ');
    await expect(totalRow.getByRole('cell').nth(3)).toHaveText('700.000 đ');
    await expect(totalRow.getByRole('cell').nth(4)).toHaveText('7.300.000 đ');
    const tinhCard = admin.page.getByRole('heading', { name: 'Nguyễn Đức Tính', exact: true })
      .locator('xpath=ancestor::div[contains(@class,"border-blue-500/30")]');
    await expect(tinhCard.getByText('3.650.000 đ', { exact: true })).toHaveCount(1);
    await expect(admin.page.getByText('EXP-CANCELLED', { exact: true })).toHaveCount(0);
  });
});
