import { expect } from '@playwright/test';
import { test } from '../../fixtures/admin.fixture';

async function mockReportsData(page: any) {
  await page.route('**/api/v1/invoices*', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          items: [
            {
              id: 'invoice-1',
              code: 'INV-REPORT-001',
              status: 'OVERDUE',
              total: 1_000_000,
              paidAmount: 300_000,
              creditAmount: 200_000,
              createdAt: '2026-08-10T08:00:00.000Z',
              dueDate: '2026-08-05T00:00:00.000Z',
              customer: { fullName: 'Khách dữ liệu thật' },
              contract: {
                room: {
                  code: '31-01',
                  building: { code: 'LK01-31', name: 'LK01-31' },
                },
              },
            },
          ],
          total: 1,
        },
      }),
    });
  });

  await page.route('**/api/v1/contracts*', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          items: [
            { id: 'contract-1', status: 'ACTIVE' },
            { id: 'contract-2', status: 'EXPIRED' },
          ],
          total: 2,
        },
      }),
    });
  });

  await page.route('**/api/v1/rooms*', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [
          { id: 'room-1', code: '31-01', name: 'Phòng 31-01', status: 'OCCUPIED' },
          { id: 'room-2', code: '31-02', name: 'Phòng 31-02', status: 'AVAILABLE' },
        ],
      }),
    });
  });
}

test.describe('Reports Real Data Desktop Regression', () => {
  test.beforeEach(async ({ admin }, testInfo) => {
    test.skip(!/Desktop|Laptop/.test(testInfo.project.name), 'Desktop-only regression');
    await mockReportsData(admin.page);
  });

  test('uses API data and invoice credits without showing demo fallbacks', async ({ admin }) => {
    await admin.page.goto('/reports', { waitUntil: 'domcontentloaded' });

    const root = admin.page.getByTestId('reports-root');
    await expect(root).toBeVisible();
    await expect(root).toContainText('1.000.000 đ');
    await expect(root).toContainText('300.000 đ');
    await expect(root).toContainText('500.000 đ');
    await expect(root).toContainText('50.0%');
    await expect(root).toContainText('Hợp đồng hiệu lực1');
    await expect(root).toContainText('Phòng lấp đầy50.0%');
    await expect(root).toContainText('LK01-31');
    await expect(root).not.toContainText('LK03');
    await expect(root).not.toContainText('Trần Thị Bích');
  });
});
