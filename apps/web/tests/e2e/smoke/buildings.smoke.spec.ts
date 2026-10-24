import { expect } from '@playwright/test';
import { test } from '../fixtures/admin.fixture';
import { BuildingsPage } from '../pages/BuildingsPage';
import AxeBuilder from '@axe-core/playwright';

const building = {
  id: 'building-smoke-001', name: 'Tòa Smoke', code: 'LK01-31', address: 'Địa chỉ smoke',
  floors: [{ id: 'floor-smoke-001', level: 1, rooms: [{ id: 'room-smoke-001', code: '101', name: 'Phòng 101', area: 25, capacity: 2 }] }],
};

async function mockBuildings(page: any, data: any[], status = 200) {
  await page.route('**/api/v1/buildings*', route => route.fulfill({ status, contentType: 'application/json', headers: status === 200 ? undefined : { 'x-intentional-error': 'true' }, body: status === 200 ? JSON.stringify({ success: true, data }) : JSON.stringify({ message: 'Internal Server Error' }) }));
}

test.describe('Buildings Smoke Test', () => {
  test('renders current building model and floor workspace', async ({ admin }) => {
    await mockBuildings(admin.page, [building]);
    const buildingsPage = new BuildingsPage(admin.page);
    await buildingsPage.goto();
    await expect(admin.page.getByTestId('building-directory')).toBeVisible();
    await admin.page.getByRole('button', { name: /^Tòa Smoke/ }).click();
    await expect(admin.page).toHaveURL(/\/buildings\/LK01-31$/);
    await expect(admin.page.getByTestId('building-model-viewer')).toBeVisible();
    await expect(admin.page.getByTestId('floor-workspace-panel')).toBeVisible();
    await expect(admin.page.getByText('LK01-31').first()).toBeVisible();
    const axe = await new AxeBuilder({ page: admin.page }).disableRules(['color-contrast', 'heading-order', 'button-name']).analyze();
    expect(axe.violations).toEqual([]);
  });

  test('renders empty state when there are no buildings', async ({ admin }) => {
    await mockBuildings(admin.page, []);
    const buildingsPage = new BuildingsPage(admin.page);
    await buildingsPage.goto();
    await expect(buildingsPage.emptyBuildingsState).toBeVisible();
  });

  test('renders API error and recovers when retried', async ({ admin }) => {
    await mockBuildings(admin.page, [], 500);
    const buildingsPage = new BuildingsPage(admin.page);
    await buildingsPage.goto();
    await expect(admin.page.getByText('Không tải được danh sách tòa nhà.')).toBeVisible({ timeout: 15000 });
    await expect(buildingsPage.emptyBuildingsState).not.toBeVisible();
    await mockBuildings(admin.page, [building]);
    await admin.page.getByRole('button', { name: 'Thử lại', exact: true }).click();
    await expect(admin.page.getByTestId('building-directory')).toBeVisible();
    await expect(admin.page.getByText('Không tải được danh sách tòa nhà.')).not.toBeVisible();
  });
});
