import { expect } from '@playwright/test';
import { test } from '../../fixtures/admin.fixture';

async function mockReportsData(page: any) {
  await page.route('**/api/v1/dashboard', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          kpis: { depositHeld: 250_000 },
          occupancy: { totalRooms: 2, occupiedRooms: 1, rate: 50 },
          operations: { activeContracts: 1, expiringContracts: 0 },
          buildingHealth: [
            { id: 'LK01-31', code: 'LK01-31', name: 'LK01-31', rooms: 2, occupied: 1 },
          ],
        },
      }),
    });
  });

  await page.route('**/api/v1/dashboard/revenue-history', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [{ month: 'T8', revenue: 1_000_000, profit: 750_000 }],
      }),
    });
  });

  await page.route('**/api/v1/reports/revenue-by-building', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [
          {
            buildingId: 'building-1',
            buildingCode: 'LK01-31',
            buildingName: 'LK01-31',
            invoiceCount: 2,
            totalAmount: 1_800_000,
            paidAmount: 300_000,
            creditAmount: 200_000,
            remainingAmount: 1_300_000,
            revenueBreakdown: { rent: 1_800_000, electricity: 0, waterAndService: 0, other: 0 },
          },
        ],
      }),
    });
  });

  await page.route('**/api/v1/reports/receivable-aging', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [
          {
            invoiceId: 'invoice-1',
            invoiceCode: 'INV-REPORT-001',
            customerId: 'customer-1',
            customer: 'Khách dữ liệu thật',
            phone: '0900000001',
            roomId: 'room-1',
            roomCode: '31-01',
            buildingId: 'building-1',
            buildingCode: 'LK01-31',
            buildingName: 'LK01-31',
            dueDate: '2026-08-05T00:00:00.000Z',
            totalAmount: 1_000_000,
            remainingAmount: 500_000,
            daysOverdue: 5,
            agingBucket: '1-30 Days',
          },
          {
            invoiceId: 'invoice-2',
            invoiceCode: 'INV-REPORT-002',
            customerId: 'customer-2',
            customer: 'Khách dữ liệu thật',
            phone: '0900000002',
            roomId: 'room-2',
            roomCode: '31-02',
            buildingId: 'building-1',
            buildingCode: 'LK01-31',
            buildingName: 'LK01-31',
            dueDate: '2026-08-10T00:00:00.000Z',
            totalAmount: 800_000,
            remainingAmount: 800_000,
            daysOverdue: 2,
            agingBucket: '1-30 Days',
          },
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

  test('uses server-side report aggregates without client list fallbacks', async ({ admin }) => {
    await admin.page.goto('/reports', { waitUntil: 'domcontentloaded' });

    const root = admin.page.getByTestId('reports-root');
    await expect(root).toBeVisible();
    await expect(root).toContainText('1.800.000 đ');
    await expect(root).toContainText('300.000 đ');
    await expect(root).toContainText('1.300.000 đ');
    await expect(root).toContainText('50.0%');
    await expect(root).toContainText('Hợp đồng hiệu lực1');
    await expect(root).toContainText('1/2 phòng');
    await expect(root).toContainText('P.31-01');
    await expect(root).toContainText('P.31-02');
    await expect(root).toContainText('LK01-31');
    await expect(root).not.toContainText('LK03');
    await expect(root).not.toContainText('Trần Thị Bích');
  });
});
