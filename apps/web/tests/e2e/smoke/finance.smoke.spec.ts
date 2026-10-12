import { expect } from '@playwright/test';
import { test } from '../fixtures/admin.fixture';
import AxeBuilder from '@axe-core/playwright';

const buildings = [
  ['LK01.31', 25_000_000], ['LK01.32', 25_000_000],
  ['LK08.24', 25_000_000], ['LK08.25', 25_000_000],
].map(([code, revenue]) => ({ building: { code, occupiedRooms: 1, roomCount: 1 }, revenue, expense: 0 }));
const expenses = [
  { id: 'direct', amount: 10_000_000, building: { code: 'LK01.31' }, description: 'Chi phí trực tiếp' },
  { id: 'incidental', amount: 12_000_000, description: 'Phát sinh Cụm LK01' },
];

async function mockFinance(page: any, data = buildings, costs = expenses) {
  await page.route('**/api/v1/finance/buildings/profit-summary*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) }));
  await page.route('**/api/v1/finance/expenses*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: costs }) }));
}

test.describe('Finance Smoke Test', () => {
  test('renders current report month, settlement and accessibility', async ({ admin }) => {
    await mockFinance(admin.page);
    await admin.page.goto('/finance');
    await expect(admin.page.getByTestId('finance-root')).toBeVisible();
    await expect(admin.page.getByText('Kỳ báo cáo:', { exact: true })).toBeVisible();
    await expect(admin.page.getByText('100.000.000 đ').first()).toBeVisible();
    await expect(admin.page.getByText('10.000.000 đ').first()).toBeVisible();
    await expect(admin.page.getByText('12.000.000 đ').first()).toBeVisible();
    await expect(admin.page.getByText('78.000.000 đ').first()).toBeVisible();
    await expect(admin.page.getByText('39.000.000 đ').first()).toBeVisible();
    const axe = await new AxeBuilder({ page: admin.page }).disableRules([
      'color-contrast', 'heading-order', 'button-name', 'empty-heading', 'landmark-unique', 'region',
    ]).analyze();
    expect(axe.violations).toEqual([]);
  });

  test('shows a safe error state for either report query', async ({ admin }) => {
    await admin.page.route('**/api/v1/finance/buildings/profit-summary*', route => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Internal Server Error' }) }));
    await admin.page.route('**/api/v1/finance/expenses*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) }));
    await admin.page.goto('/finance');
    await expect(admin.page.locator('[role="alert"]:visible').filter({ hasText: 'Không tải được số liệu kỳ báo cáo' }).first()).toBeVisible();
  });

  test('renders zero settlement for an empty period', async ({ admin }) => {
    await mockFinance(admin.page, [], []);
    await admin.page.goto('/finance');
    await expect(admin.page.getByText('0 đ').first()).toBeVisible();
    await expect(admin.page.getByText('Mỗi chủ nhận đúng:')).toBeVisible();
  });
});
