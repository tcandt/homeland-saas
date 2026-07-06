import { expect } from '@playwright/test';
import { test } from '../../fixtures/rbac.fixture';
import { DataFactory } from '../../utils/data-factory';

test.describe.configure({ mode: 'serial' });

test.describe('Automation Core Regression Flow', () => {
  let factory: DataFactory;
  let testPrefix: string;
  let createdIds: any;

  test.beforeEach(async ({ admin }) => {
    factory = new DataFactory(admin.api);
    testPrefix = `E2E-AUTO-${Date.now()}`;
    createdIds = {};

    admin.page.on('console', msg => console.log('[PAGE CONSOLE]', msg.text()));
    admin.page.on('pageerror', err => console.log('[PAGE ERROR]', err.message));
    admin.page.on('requestfailed', req => console.log('[REQ FAILED]', req.method(), req.url(), req.failure()?.errorText));
  });

  test.afterEach(async () => {
    try {
      await factory.cleanup(createdIds);
    } catch (err: any) {
      console.warn('Cleanup warning:', err.message);
    }
  });

  test('Page loads and registry renders correctly', async ({ admin }) => {
    const page = admin.page;
    await page.goto('/automation');
    await page.waitForLoadState('networkidle');

    // 1. Verify page root and title
    await expect(page.getByTestId('automation-root')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Automation Command Center' }).first()).toBeVisible();

    // 2. Verify tabs are present
    await expect(page.getByTestId('tab-workflows')).toBeVisible();
    await expect(page.getByTestId('tab-history')).toBeVisible();
    await expect(page.getByTestId('tab-rules')).toBeVisible();
    await expect(page.getByTestId('tab-jobs')).toBeVisible();

    // 3. Verify workflow list
    await expect(page.getByTestId('workflow-name').filter({ hasText: 'deposit.collected.workflow' })).toBeVisible();

    // 4. Switch to Rules Engine tab and verify rules
    await page.getByTestId('tab-rules').click();
    await expect(page.getByTestId('rule-name').filter({ hasText: 'contract.expiring.30_days' })).toBeVisible();
    await expect(page.getByTestId('rule-name').filter({ hasText: 'invoice.overdue.7_days' })).toBeVisible();
  });

  test('Run contract.expiring.30_days rule and verify rule execution and notification side-effect', async ({ admin }) => {
    const page = admin.page;
    await page.goto('/automation');
    await page.waitForLoadState('networkidle');

    // Go to rules tab
    await page.getByTestId('tab-rules').click();

    // Set mock payload for rule manual execution
    // Customer must be the current admin user to verify notification
    const ruleContext = {
      tenantId: admin.user.tenantId,
      customerId: admin.user.id,
      endDate: new Date(Date.now() + 15 * 24 * 3600 * 1000).toISOString() // 15 days in future (matches >0 and <=30)
    };

    const textarea = page.getByTestId('rule-payload-contract.expiring.30_days');
    await textarea.fill(JSON.stringify(ruleContext, null, 2));

    // Run manual
    await page.getByTestId('run-rule-contract.expiring.30_days').click();
    await expect(page.getByTestId('automation-status-message')).toContainText('triggered successfully', { timeout: 15000 });

    // Verify notification side-effect appears in the notifications UI
    await page.goto('/notifications');
    await page.waitForLoadState('networkidle');

    const notifItem = page.getByTestId('notification-item').filter({ hasText: 'Contract Expiring Soon' }).first();
    await expect(notifItem).toBeVisible({ timeout: 15000 });
  });

  test('Run deposit.collected.workflow with real payload and verify executions and side-effects', async ({ admin }) => {
    const page = admin.page;

    // 1. Data Setup via API
    const building = await factory.createBuilding(testPrefix);
    createdIds.buildingId = building.id;
    
    const floor = await factory.createFloor(testPrefix, building.id);
    createdIds.floorId = floor.id;
    
    const room = await factory.createRoom(testPrefix, building.id, floor.id);
    createdIds.roomId = room.id;
    
    const customer = await factory.createCustomer(testPrefix);
    createdIds.customerId = customer.id;

    // Trigger deposit.collected.workflow manual run from the page UI
    await page.goto('/automation');
    await page.waitForLoadState('networkidle');

    // Set correct workflow payload referencing real entities
    const workflowPayload = {
      tenantId: admin.user.tenantId,
      customerId: admin.user.id, // Notification sent to admin user so we can verify it in E2E
      roomId: room.id,
      buildingId: building.id,
      amount: 6000000,
      code: `DEP-${testPrefix}`,
      sourceType: 'DEPOSIT',
      id: `DEP-${testPrefix}`, // sourceId
      metadata: {
        code: testPrefix
      }
    };

    const textarea = page.getByTestId('workflow-payload-deposit.collected.workflow');
    await textarea.fill(JSON.stringify(workflowPayload, null, 2));

    // Run manual
    await page.getByTestId('run-workflow-deposit.collected.workflow').click();
    await expect(page.getByTestId('automation-status-message')).toContainText('triggered successfully', { timeout: 15000 });

    // Wait and verify WorkflowExecution status SUCCESS in history
    await page.getByTestId('tab-history').click();

    // Check history table row for this workflow
    const executionRow = page.getByTestId('execution-row').filter({ hasText: 'deposit.collected.workflow' }).first();
    await expect(executionRow).toBeVisible({ timeout: 15000 });
    const statusBadge = executionRow.getByTestId('execution-status-badge');
    await expect(statusBadge).toContainText('SUCCESS', { timeout: 15000 });

    // 2. Verify side-effect: In-app notification created
    await page.goto('/notifications');
    await page.waitForLoadState('networkidle');

    const notifItem = page.getByTestId('notification-item').filter({ hasText: `DEP-${testPrefix}` }).first();
    await expect(notifItem).toBeVisible({ timeout: 15000 });

    // 3. Verify side-effect: JournalEntry created in Ledger
    await page.goto('/finance');
    await expect(page.getByTestId('finance-root')).toBeVisible({ timeout: 10000 });
    
    await expect(async () => {
      const ledgerRes = await admin.api.get('/api/v1/finance/ledger');
      expect(ledgerRes.ok()).toBeTruthy();
      const json = await ledgerRes.json();
      const ledger = json.data || json;
      const found = ledger.some((item: any) => 
        item.journalEntry?.description && item.journalEntry.description.includes(testPrefix)
      );
      expect(found).toBeTruthy();
    }).toPass({ timeout: 15000 });
  });
});
