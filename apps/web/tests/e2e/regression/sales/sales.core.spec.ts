import { expect } from '@playwright/test';
import { test } from '../../fixtures/rbac.fixture';
import { DataFactory } from '../../utils/data-factory';

test.describe.configure({ mode: 'parallel' });

test.describe('Sales Core Regression Workflow', () => {
  let factory: DataFactory;
  let testPrefix: string;
  let createdIds: any = {};

  test.beforeAll(async ({ browser }) => {
    // We need an admin context to seed data
    // Since beforeAll doesn't easily inject the 'admin' fixture directly in the same way,
    // we can either do it inside the test, or just create a temporary admin context.
    // For simplicity, we'll do the setup inside the test or beforeEach if needed.
  });

  test('E2E Full Workflow: Customer -> Contract -> Deposit -> Invoice -> Pay -> Ledger', async ({ admin, sales, finance }, testInfo) => {
    test.setTimeout(120000); // 2 minutes timeout for full E2E flow
    
    // 1. Data Setup via API
    factory = new DataFactory(admin.api);
    testPrefix = `E2E-${Date.now()}-W${testInfo.workerIndex}`;
    
    try {
      // 1. Setup Phase (Admin API)
      const building = await factory.createBuilding(testPrefix);
      createdIds.buildingId = building.id;
      
      const floor = await factory.createFloor(testPrefix, building.id);
      createdIds.floorId = floor.id;
      
      const room = await factory.createRoom(testPrefix, building.id, floor.id);
      createdIds.roomId = room.id;
      
      const customer = await factory.createCustomer(testPrefix);
      createdIds.customerId = customer.id;
      
      const contract = await factory.createContract(testPrefix, room.id, customer.id);
      createdIds.contractId = contract.id;
      
      const deposit = await factory.createDeposit(testPrefix, room.id, customer.id);
      createdIds.depositId = deposit.id;
      
      // Collect deposit to trigger workflow
      await factory.collectDeposit(testPrefix, deposit.id);
      
      const invoice = await factory.createInvoice(testPrefix, contract.id, customer.id, room.id);
      createdIds.invoiceId = invoice.id;

      // 2. Finance Pays Invoice (API or UI)
      // We will do it via API for speed, but let's verify via UI.
      await factory.createPayment(testPrefix, invoice.id, 5000000);

      // 3. Verify in Finance Ledger (Polling because journal entry is async)
      await expect(async () => {
        // Setup the response promise BEFORE navigation to avoid race condition
        const responsePromise = finance.page.waitForResponse(
          res => res.url().includes('/api/v1/finance/ledger') && res.status() === 200,
          { timeout: 10000 }
        ).catch(() => null);

        await finance.page.goto('/finance');
        await expect(finance.page.getByTestId('finance-root')).toBeVisible({ timeout: 5000 });
        
        const response = await responsePromise;
        expect(response).toBeTruthy();
        
        const json = await response!.json();
        const found = json.data.some((item: any) => 
          item.journalEntry?.description && item.journalEntry.description.includes(testPrefix)
        );
        
        if (!found) {
          console.log(`[DEBUG] Attempt failed. Ledger data:`, json.data.map((i: any) => i.journalEntry?.description));
        }
        
        expect(found).toBeTruthy();
      }).toPass({ timeout: 45000 });

      // 3. Verify Invoice Status in UI (Sales Role)
      await sales.page.goto('/invoices');
      await sales.page.waitForLoadState('networkidle');
      
      // Wait for the invoice to appear
      const invoiceCard = sales.page.locator('[data-testid="invoice-card"]', { hasText: invoice.code }).first();
      await expect(invoiceCard).toBeVisible({ timeout: 15000 });
      // Hover over the card to reveal the quick actions overlay
      await invoiceCard.hover();
      // Click the 'Xem chi tiết' button
      await invoiceCard.locator('button[aria-label="Xem chi tiết"]').click();
      
      const drawer = sales.page.getByTestId('invoice-detail-drawer');
      await expect(drawer).toBeVisible();
      
      // Should be PAID or updated status
      const badge = drawer.getByTestId('invoice-status-badge');
      await expect(badge).toContainText(/PAID|Hoàn thành|Thành công/i, { timeout: 5000 });

      // Verify Persistence: Refresh and check again
      await sales.page.reload();
      const invoiceCardAfter = sales.page.locator('[data-testid="invoice-card"]', { hasText: invoice.code }).first();
      await expect(invoiceCardAfter).toBeVisible({ timeout: 15000 });
      await invoiceCardAfter.hover();
      await invoiceCardAfter.locator('button[aria-label="Xem chi tiết"]').click();
      await expect(sales.page.getByTestId('invoice-detail-drawer').getByTestId('invoice-status-badge')).toContainText(/PAID|Hoàn thành|Thành công/i);

      finance.page.on('console', msg => console.log('FINANCE CONSOLE:', msg.text()));
      finance.page.on('pageerror', error => console.log('FINANCE PAGE ERROR:', error.message));
    } finally {
      // Teardown Phase
      await factory.cleanup(createdIds);
    }
  });
});
