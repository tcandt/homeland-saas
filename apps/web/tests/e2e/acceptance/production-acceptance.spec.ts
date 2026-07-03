import { test, expect } from '@playwright/test';
import { test as rbacTest } from '../fixtures/rbac.fixture';
import { DataFactory } from '../utils/data-factory';
import { checkA11y } from '../utils/a11y-helper';

rbacTest.describe.configure({ mode: 'serial' });

const failOnError = (msg: string) => {
  console.log('--- STRICT FAIL TRIGGERED ---', msg);
  throw new Error(`STRICT FAIL: ${msg}`);
};

export const attachStrictListeners = (page: any) => {
  page.on('console', (msg: any) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (text.includes('SSE Error')) return;
      if (text.includes('429')) {
        const url = msg.location()?.url || '';
        if (url.includes('auth/login') || url.includes('auth/refresh')) return;
      }
      failOnError(`Console Error: ${text}`);
    }
    if (msg.text().includes('Hydration') || msg.text().includes('Minified React error')) failOnError(`Hydration Warning: ${msg.text()}`);
  });
  page.on('pageerror', (err: any) => {
    failOnError(`Page Error: ${err.message}`);
  });
  page.on('response', (response: any) => {
    if (response.status() === 500) {
      failOnError(`Unexpected 500 from ${response.url()}`);
    }
  });
};

rbacTest.describe('Level 3 - Production Acceptance: Full Business Workflow', () => {
  let factory: DataFactory;
  let testPrefix: string;
  let createdIds: any;

  rbacTest.beforeAll(async () => {
    testPrefix = 'E2E-ACC-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
    createdIds = {};
  });

  rbacTest.beforeEach(async ({ admin }) => {
    factory = new DataFactory(admin.api, admin.token);
    
    attachStrictListeners(admin.page);
    admin.page.context().pages().forEach(attachStrictListeners);
  });

  rbacTest.afterAll(async ({ admin }) => {
    // Cleanup must be reverse dependency
    if (!factory && admin) factory = new DataFactory(admin.api, admin.token);
    if (factory) {
      try {
        console.log('Cleaning up acceptance test data...', createdIds);
        await factory.cleanup(createdIds);
      } catch (err: any) {
        console.warn('Cleanup warning:', err.message);
      }
    }
  });

  rbacTest('1. Setup Core Entities (Building, Room, Customer)', async ({ admin }) => {
    console.log('TOKEN IS:', admin.token);
    // Fast setup via API, verify via UI
    const building = await factory.createBuilding(testPrefix);
    createdIds.buildingId = building.id;
    
    const floor = await factory.createFloor(testPrefix, building.id);
    createdIds.floorId = floor.id;
    
    const room = await factory.createRoom(testPrefix, building.id, floor.id);
    createdIds.roomId = room.id;
    
    const customer = await factory.createCustomer(testPrefix);
    createdIds.customerId = customer.id;

    await admin.page.goto('/buildings');
    await admin.page.waitForLoadState('domcontentloaded');
    await checkA11y(admin.page, 'Buildings Page');
    
    await admin.page.goto('/rooms');
    await admin.page.waitForLoadState('domcontentloaded');
    await expect(admin.page.locator('body')).toContainText(room.code);
  });

  rbacTest('2. Onboarding (Create Contract & Deposit)', async ({ admin }) => {
    // Create Contract via API to speed up, then verify
    const contract = await factory.createContract(testPrefix, createdIds.roomId, createdIds.customerId);
    createdIds.contractId = contract.id;

    // Create Deposit via API
    const deposit = await factory.createDeposit(testPrefix, createdIds.roomId, createdIds.customerId);
    createdIds.depositId = deposit.id;

    await admin.page.goto('/contracts');
    await admin.page.waitForLoadState('domcontentloaded');
    await checkA11y(admin.page, 'Contracts Page');
    await expect(admin.page.locator('body')).toContainText(contract.code);
  });

  rbacTest('3. Financials (Collect Deposit, Invoice, Pay)', async ({ finance }) => {
    // Switch to finance persona
    const finFactory = new DataFactory(finance.api, finance.token);
    
    attachStrictListeners(finance.page);
    finance.page.context().pages().forEach(attachStrictListeners);
    
    // Collect Deposit
    await finFactory.collectDeposit(testPrefix, createdIds.depositId);
    
    // Create Invoice
    const invoice = await finFactory.createInvoice(testPrefix, createdIds.contractId, createdIds.customerId, createdIds.roomId);
    createdIds.invoiceId = invoice.id;

    // Pay Invoice
    const payment = await finFactory.createPayment(testPrefix, invoice.id, 5000000);
    createdIds.paymentId = payment.id;

    await finance.page.goto('/finance');
    await finance.page.waitForLoadState('domcontentloaded');
    await checkA11y(finance.page, 'Finance Dashboard');
    
    // Assert responsiveness without horizontal scroll
    const isOverflowing = await finance.page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(isOverflowing).toBe(false);
  });

  rbacTest('4. Verification of Side-Effects (Ledger, Notifications, Automation)', async ({ admin }) => {
    // Check Ledger API
    const ledgerRes = await admin.api.get('/api/v1/finance/ledger?limit=10').then(r => r.json());
    const entries = ledgerRes.data || [];
    const hasPaymentEntry = entries.some((e: any) => e.referenceId === createdIds.paymentId || e.metadata?.invoiceId === createdIds.invoiceId);
    expect(hasPaymentEntry).toBeTruthy();

    // Verify Automation executed (API check) with polling
    let hasDepositExec = false;
    for (let i = 0; i < 10; i++) {
      const execRes = await admin.api.get('/api/v1/automation/executions?limit=10').then(r => r.json());
      const execs = execRes.data || [];
      hasDepositExec = execs.some((e: any) => e.workflowName === 'deposit.collected.workflow' && e.status === 'SUCCESS');
      if (hasDepositExec) break;
      await new Promise(r => setTimeout(r, 1000));
    }
    expect(hasDepositExec).toBeTruthy();

    // Check Ledger UI (Admin should see finance ledger because admin has all permissions)
    await admin.page.goto('/finance');
    await admin.page.waitForLoadState('domcontentloaded');
    await checkA11y(admin.page, 'Finance UI');

    // Check Notifications UI
    await admin.page.goto('/notifications');
    await admin.page.waitForLoadState('domcontentloaded');
    await checkA11y(admin.page, 'Notifications UI');

    // Check Automation UI
    await admin.page.goto('/automation');
    await admin.page.waitForLoadState('domcontentloaded');
    await checkA11y(admin.page, 'Automation UI');
  });

  rbacTest('5. Documents & AI Safety Verification', async ({ admin }) => {
    // Generate Document via API
    const doc = await factory.generateDocument(testPrefix, 'CONTRACT_TEMPLATE');
    createdIds.documentId = doc.id;
    
    await admin.page.goto('/documents');
    await admin.page.waitForLoadState('domcontentloaded');
    await checkA11y(admin.page, 'Documents Page');
    
    const downloadRes = await factory.downloadDocument(doc.id, admin.token!);
    expect(downloadRes.ok()).toBeTruthy();
    expect(downloadRes.headers()['content-type']).toContain('application/pdf');
    const buffer = await downloadRes.body();
    expect(buffer.length).toBeGreaterThan(100); // Verify buffer has content

    // AI Safety
    await admin.page.route('**/api/v1/ai/chat', route => {
      route.fulfill({
        status: 200,
        json: {
          conversationId: 'mock-conv-123',
          result: {
            message: { 
              role: 'assistant', 
              content: JSON.stringify({
                actionRequired: 'CONFIRM_DRAFT',
                data: { title: 'Xoa phong', content: 'Delete room confirmation', description: 'Safety draft' },
                toolOutput: 'Drafting deletion for room...'
              })
            }
          }
        }
      });
    });
    await admin.page.goto('/ai');
    await admin.page.waitForLoadState('domcontentloaded');
    await checkA11y(admin.page, 'AI Command Center');
    
    await admin.page.getByTestId('ai-message-input').fill('Xoa phong ' + testPrefix);
    await admin.page.getByTestId('ai-send-button').click();
    
    // It should hit draft safety, not perform deletion
    await expect(admin.page.getByTestId('ai-draft-confirmation')).toBeVisible({ timeout: 15000 });
  });
});
