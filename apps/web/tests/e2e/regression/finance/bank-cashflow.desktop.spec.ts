import { expect } from '@playwright/test';
import { test } from '../../fixtures/admin.fixture';

test.describe('Finance report period contract', () => {
  test.beforeEach(async ({ admin }, testInfo) => test.skip(!/Desktop|Laptop/.test(testInfo.project.name), 'Desktop-only regression'));
  test('uses current GMT+7 month for the live settlement request', async ({ admin }) => {
    let query: URL | undefined;
    await admin.page.route('**/api/v1/finance/buildings/profit-summary*', route => { query = new URL(route.request().url()); return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) }); });
    await admin.page.route('**/api/v1/finance/expenses*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) }));
    await admin.page.goto('/finance', { waitUntil: 'domcontentloaded' });
    await expect.poll(() => query).toBeTruthy();
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: 'numeric' }).formatToParts(new Date());
    const year = parts.find(p => p.type === 'year')!.value;
    const month = parts.find(p => p.type === 'month')!.value;
    expect(query!.searchParams.get('startYear')).toBe(year);
    expect(query!.searchParams.get('startMonth')).toBe(month);
    expect(query!.searchParams.get('endYear')).toBe(year);
    expect(query!.searchParams.get('endMonth')).toBe(month);

    // The picker must update the request range rather than only changing its label.
    await admin.page.getByText('Kỳ báo cáo:', { exact: false }).first().click();
    await admin.page.getByRole('button', { name: '3 tháng gần nhất', exact: true }).click();
    await admin.page.getByRole('button', { name: 'Áp dụng', exact: true }).click();
    await expect.poll(() => query?.searchParams.get('startMonth')).not.toBe(month);
    expect(query?.searchParams.get('endYear')).toBe(year);
    expect(query?.searchParams.get('endMonth')).toBe(month);
  });
});
