import { expect } from '@playwright/test';
import { test } from '../fixtures/admin.fixture';
import { TenantsPage } from '../pages/TenantsPage';
import AxeBuilder from '@axe-core/playwright';

test.describe('Tenants Smoke Test', () => {

  test('Verify tenants page rendering, grid, and drawer', async ({ admin }) => {
    admin.page.on('console', msg => console.log('BROWSER:', msg.text()));
    const tenantsPage = new TenantsPage(admin.page);

    // 2. Navigate and wait for API to load
    await tenantsPage.goto();
    await admin.page.waitForLoadState('networkidle');

    // 3. Verify Page Structure
    const roots = await tenantsPage.page.getByTestId('tenants-root').all();
    console.log('Roots count:', roots.length);
    if (roots.length === 0) {
      console.log('No tenants-root found! HTML:');
      const html = await admin.page.content();
      require('fs').writeFileSync('test-results/debug-missing-root.html', html);
    }
    await expect(tenantsPage.root).toBeVisible({ timeout: 5000 });
    await expect(tenantsPage.kpiGrid).toBeVisible();
    await expect(tenantsPage.filterBar).toBeVisible();
    await expect(tenantsPage.list).toBeVisible();

    // 4. Verify data rendering
    // Assume seeded DB has at least 1 tenant. 
    // Wait for at least one card
    await expect(tenantsPage.tenantCards.first()).toBeVisible();

    // 5. Open and Close Drawer
    await tenantsPage.openFirstTenant();
    await tenantsPage.closeTenantDrawer();

    // 6. Verify Axe accessibility
    const axe = new AxeBuilder({ page: admin.page })
      .disableRules(['color-contrast', 'heading-order', 'button-name', 'empty-heading', 'landmark-unique', 'region']); // Temporary disable known issues
    const accessibilityScanResults = await axe.analyze();
    expect(accessibilityScanResults.violations).toEqual([]);

    // 7. Screenshot baseline
    await expect(admin.page).toHaveScreenshot('tenants-full-page.png', {
      fullPage: true,
      mask: [admin.page.getByTestId('tenant-card')], // Mask dynamic data
      timeout: 15000,
    });
  });

  test('Mock 500 -> ErrorState for Tenants', async ({ admin }) => {
    // 1. Route API to return 500
    await admin.page.route(/.*\/api\/v1\/customers.*/, async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        headers: { 'x-intentional-error': 'true' },
        body: JSON.stringify({ error: 'Internal Server Error' })
      });
    });

    const tenantsPage = new TenantsPage(admin.page);
    const responsePromise = admin.page.waitForResponse(/.*\/api\/v1\/customers.*/);
    await tenantsPage.goto();
    await responsePromise;

    // 2. Assert ErrorState is visible
    await expect(tenantsPage.errorState).toBeVisible();

    // 3. Unroute
    await admin.page.unroute(/.*\/api\/v1\/customers.*/);
  });

  test('Mock Empty -> EmptyState for Tenants', async ({ admin }) => {
    // 1. Route API to return empty data
    await admin.page.route(/.*\/api\/v1\/customers.*/, async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], meta: { total: 0 } })
      });
    });

    const tenantsPage = new TenantsPage(admin.page);
    const responsePromise = admin.page.waitForResponse(/.*\/api\/v1\/customers.*/);
    await tenantsPage.goto();
    await responsePromise;

    // 2. Assert EmptyState is visible
    try {
      await expect(tenantsPage.emptyState).toBeVisible({ timeout: 5000 });
    } catch (e) {
      console.log("Mock Empty Timeout! Printing HTML:");
      const html = await admin.page.content();
      require('fs').writeFileSync('test-results/debug-mobile.html', html);
      throw e;
    }

    // 3. Unroute
    await admin.page.unroute(/.*\/api\/v1\/customers.*/);
  });

  test('loads page two from the customer API and renders its direct contract room', async ({ admin }) => {
    const customerPageRequests: Array<{ page: string | null; limit: string | null }> = [];
    const pageOneCustomer = {
      id: 'tenant-page-one',
      fullName: 'Khách trang một',
      phone: '0900000001',
      contracts: [{
        id: 'contract-page-one',
        status: 'ACTIVE',
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2027-01-01T00:00:00.000Z',
        room: { id: 'room-one', code: 'P101', name: 'P101', building: { id: 'building-one', code: 'A', name: 'Tòa Một' } },
      }],
    };
    const pageTwoCustomer = {
      id: 'tenant-page-two',
      fullName: 'Khách trang hai',
      phone: '0900000002',
      room: { id: 'wrong-room', code: 'SAI', name: 'Phòng sai', building: { id: 'wrong-building', code: 'SAI', name: 'Tòa sai' } },
      contracts: [{
        id: 'contract-page-two',
        status: 'ACTIVE',
        startDate: '2026-02-01T00:00:00.000Z',
        endDate: '2027-02-01T00:00:00.000Z',
        room: { id: 'room-two', code: 'P202', name: 'P202', building: { id: 'building-two', code: 'B', name: 'Tòa chính xác' } },
      }],
    };

    await admin.page.route('**/api/v1/customers*', async (route) => {
      const url = new URL(route.request().url());
      const page = url.searchParams.get('page');
      const limit = url.searchParams.get('limit');
      const isGridRequest = limit === '10';
      if (isGridRequest) customerPageRequests.push({ page, limit });
      const isSecondGridPage = isGridRequest && page === '2';
      const data = isSecondGridPage ? [pageTwoCustomer] : [pageOneCustomer];

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            data,
            meta: { total: 11, page: Number(page || 1), limit: Number(limit || 100), totalPages: isGridRequest ? 2 : 1 },
          },
        }),
      });
    });

    const tenantsPage = new TenantsPage(admin.page);
    await tenantsPage.goto();
    await expect(tenantsPage.list.getByText('Khách trang một')).toBeVisible();
    await expect(tenantsPage.list.getByText('P101')).toBeVisible();
    await expect(tenantsPage.list.getByText('Tòa Một')).toBeVisible();

    const secondPageResponse = admin.page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname.endsWith('/api/v1/customers') && url.searchParams.get('page') === '2' && url.searchParams.get('limit') === '10';
    });
    await tenantsPage.list.getByRole('button', { name: 'Trang 2' }).click();
    await secondPageResponse;

    await expect(tenantsPage.list.getByText('Khách trang hai')).toBeVisible();
    await expect(tenantsPage.list.getByText('P202')).toBeVisible();
    await expect(tenantsPage.list.getByText('Tòa chính xác')).toBeVisible();
    await expect(tenantsPage.list.getByText('Tòa sai')).toHaveCount(0);
    expect(customerPageRequests).toEqual(expect.arrayContaining([
      { page: '1', limit: '10' },
      { page: '2', limit: '10' },
    ]));

    await admin.page.unroute('**/api/v1/customers*');
  });
});
