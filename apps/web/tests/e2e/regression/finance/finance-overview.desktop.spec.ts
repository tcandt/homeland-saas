import { expect } from '@playwright/test';
import { test } from '../../fixtures/admin.fixture';

test.describe('Finance desktop overview contract', () => {
  test.beforeEach(async ({ admin }, testInfo) => test.skip(!/Desktop|Laptop/.test(testInfo.project.name), 'Desktop-only regression'));
  test('shows report period, settlement cards and expense ledger together', async ({ admin }) => {
    await admin.page.route('**/api/v1/finance/buildings/profit-summary*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [
      { building: { code: 'LK01.31', roomCount: 1, occupiedRooms: 1 }, revenue: 4_000_000, expense: 1_000_000 },
      { building: { code: 'LK01.32', roomCount: 1, occupiedRooms: 1 }, revenue: 3_000_000, expense: 0 },
      { building: { code: 'LK08.24', roomCount: 1, occupiedRooms: 1 }, revenue: 2_000_000, expense: 400_000 },
      { building: { code: 'LK08.25', roomCount: 1, occupiedRooms: 1 }, revenue: 1_000_000, expense: 0 },
    ] }) }));
    await admin.page.route('**/api/v1/finance/expenses*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [
      { id: 'direct-32', code: 'EXP-DIRECT-32', status: 'PAID', amount: 600_000, description: 'Vệ sinh LK01.32', building: { code: 'LK01.32' } },
      { id: 'cluster-01', code: 'EXP-CLUSTER-01', status: 'PAID', amount: 400_000, description: 'Bảo trì Cụm LK01' },
      { id: 'cluster-08', code: 'EXP-CLUSTER-08', status: 'APPROVED', amount: 200_000, description: 'Điện Cụm LK08' },
      { id: 'common', code: 'EXP-COMMON', status: 'PAID', amount: 100_000, description: 'Phí phần mềm' },
      { id: 'cancelled', code: 'EXP-CANCELLED', status: 'CANCELLED', amount: 9_000_000, description: 'Không được tính' },
    ] }) }));
    await admin.page.goto('/finance', { waitUntil: 'domcontentloaded' });
    await expect(admin.page.getByTestId('finance-root')).toBeVisible();
    await expect(admin.page.getByText('Kỳ báo cáo:', { exact: false })).toBeVisible();
    await expect(admin.page.getByText('Dòng Tiền Quyết Toán Hợp Nhất 4 Tòa', { exact: false })).toBeVisible();
    await expect(admin.page.getByText('Bảng Bóc Tách Chi Tiết 4 Tòa & Chi Phí Phát Sinh Cụm', { exact: false })).toBeVisible();
    await expect(admin.page.getByText('LK01.31', { exact: true }).first()).toBeVisible();
    await expect(admin.page.getByText('LK01.32', { exact: true }).first()).toBeVisible();
    await expect(admin.page.getByText('LK08.24', { exact: true }).first()).toBeVisible();
    await expect(admin.page.getByText('LK08.25', { exact: true }).first()).toBeVisible();
    await expect(admin.page.getByText('EXP-DIRECT-32', { exact: true })).toBeVisible();
    await expect(admin.page.getByText('EXP-CLUSTER-01', { exact: true })).toBeVisible();
    await expect(admin.page.getByText('EXP-CANCELLED', { exact: true })).toHaveCount(0);
  });
});
