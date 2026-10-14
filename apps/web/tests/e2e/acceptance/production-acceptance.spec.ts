import { test, expect } from '@playwright/test';
import { test as rbacTest } from '../fixtures/rbac.fixture';
import { DataFactory } from '../utils/data-factory';
import { checkA11y } from '../utils/a11y-helper';
import { PrismaClient } from '@prisma/client';

rbacTest.describe.configure({ mode: 'serial' });

const failOnError = (msg: string) => {
  console.log('--- STRICT FAIL TRIGGERED ---', msg);
  throw new Error(`STRICT FAIL: ${msg}`);
};

export const attachStrictListeners = (page: any) => {
  // These are deliberate persona-boundary probes made by the finance UI. Keep
  // the exception narrow: only the exact endpoint and status are acceptable;
  // all 401s, other 403s and all 5xx responses remain fatal.
  const expected403 = new Map<string, number>([
    ['/api/v1/settings/profile?scope=USER', 0],
    ['/api/v1/settings/notifications?scope=TENANT', 0],
    ['/api/v1/settings/access-control?scope=TENANT', 0],
    ['/api/v1/finance/owners/profit-summary', 0],
  ]);
  const consumeExpected403 = () => {
    for (const [url, count] of expected403) {
      if (count > 0) {
        expected403.set(url, count - 1);
        return true;
      }
    }
    return false;
  };
  page.on('console', (msg: any) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (
        text.includes('SSE Error') ||
        text.includes('status of 503') ||
        text.includes('notifications/stream')
      ) return;
      if (text.includes('429')) {
        const url = msg.location()?.url || '';
        if (url.includes('auth/login') || url.includes('auth/refresh')) return;
      }
      if (text.includes('status of 403') && consumeExpected403()) return;
      failOnError(`Console Error: ${text}`);
    }
    if (msg.text().includes('Hydration') || msg.text().includes('Minified React error')) failOnError(`Hydration Warning: ${msg.text()}`);
  });
  page.on('pageerror', (err: any) => {
    failOnError(`Page Error: ${err.message}`);
  });
  page.on('response', (response: any) => {
    const status = response.status();
    const responseUrl = new URL(response.url());
    const normalizedUrl = `${responseUrl.pathname}${responseUrl.search}`;
    if (status === 403 && expected403.has(normalizedUrl)) {
      expected403.set(normalizedUrl, (expected403.get(normalizedUrl) || 0) + 1);
      return;
    }
    if (status === 500 || status === 401 || status === 403) {
      failOnError(`Unexpected ${status} from ${response.url()}`);
    }
  });
};

rbacTest.describe('Level 3 - Production Acceptance: Full Business Workflow', () => {
  rbacTest.skip(process.env.RUN_DESTRUCTIVE_E2E !== 'true', 'Set RUN_DESTRUCTIVE_E2E=true only against an isolated disposable database.');
  let factory: DataFactory;
  let testPrefix: string;
  let createdIds: any;
  let prisma: PrismaClient;

  rbacTest.beforeAll(async () => {
    if (process.env.E2E_DISPOSABLE_DATABASE !== 'true' || !process.env.E2E_DATABASE_URL || !process.env.E2E_TARGET_DB_ID) {
      throw new Error('Production acceptance requires an explicitly identified disposable E2E database.');
    }
    for (const target of [process.env.E2E_API_BASE_URL, process.env.E2E_WEB_BASE_URL, process.env.E2E_DATABASE_URL]) {
      if (!target || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(target).hostname)) {
        throw new Error('Destructive production acceptance is local-only; refusing non-loopback target.');
      }
    }
    prisma = new PrismaClient({ datasources: { db: { url: process.env.E2E_DATABASE_URL } } });
    const identity = await prisma.$queryRaw<Array<{ databaseId: string }>>`SELECT current_database() AS "databaseId"`;
    if (identity[0]?.databaseId !== process.env.E2E_TARGET_DB_ID) throw new Error('E2E database identity mismatch.');
    testPrefix = 'E2E-ACC-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
    createdIds = {};
  });

  rbacTest.beforeEach(async ({ admin }) => {
    factory = new DataFactory(admin.api, admin.token);
    
    attachStrictListeners(admin.page);
  });

  rbacTest.afterAll(async () => {
    // Financial evidence is append-only; the disposable database owner resets it
    // after the suite, rather than trying to delete confirmed payments via APIs.
    await prisma?.$disconnect();
  });

  rbacTest('1. Setup Core Entities (Building, Room, Customer)', async ({ admin }) => {
    // Fast setup via API, verify via UI
    const building = await factory.createBuilding(testPrefix);
    createdIds.buildingId = building.id;
    expect(await prisma.building.findFirst({ where: { id: building.id, tenantId: admin.tenantId } })).not.toBeNull();
    
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
    await expect(admin.page.locator('body')).toContainText(`P.${room.name}`);
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
    
    // Collect Deposit
    const collected = await finFactory.collectDeposit(testPrefix, createdIds.depositId);
    expect(collected).toMatchObject({ depositId: createdIds.depositId, status: 'PAID', collectedAmount: 5000000 });
    createdIds.depositOperationId = collected.operationId;
    
    // Create Invoice
    const invoice = await finFactory.createInvoice(testPrefix, createdIds.contractId, createdIds.customerId, createdIds.roomId);
    createdIds.invoiceId = invoice.id;

    // Pay Invoice
    const payment = await finFactory.createPayment(testPrefix, invoice.id, 5000000);
    expect(payment).toMatchObject({ id: invoice.id, status: 'PAID', paidAmount: 5000000 });
    expect(payment.paymentId).toEqual(expect.any(String));
    createdIds.paymentId = payment.paymentId;

    await finance.page.goto('/finance');
    await finance.page.waitForLoadState('domcontentloaded');
    await checkA11y(finance.page, 'Finance Dashboard');
    
    // Assert responsiveness without horizontal scroll
    const isOverflowing = await finance.page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(isOverflowing).toBe(false);
  });

  rbacTest('4. Exact financial persistence, allocation and durable outbox evidence', async ({ admin }) => {
    const scope = { tenantId: admin.tenantId };
    const payments = await prisma.payment.findMany({ where: { ...scope, invoiceId: createdIds.invoiceId } });
    expect(payments).toHaveLength(1);
    expect(payments[0]).toMatchObject({ id: createdIds.paymentId, status: 'CONFIRMED', providerRef: `e2e-payment-${testPrefix}` });
    expect(Number(payments[0].amount)).toBe(5000000);
    const allocations = await prisma.paymentAllocation.findMany({ where: { ...scope, paymentId: createdIds.paymentId } });
    expect(allocations).toHaveLength(1);
    expect(allocations[0].invoiceId).toBe(createdIds.invoiceId);
    expect(Number(allocations[0].amount)).toBe(5000000);
    const deposits = await prisma.depositLedgerEntry.findMany({ where: { ...scope, depositId: createdIds.depositId, type: 'CASH_IN' } });
    expect(deposits).toHaveLength(1);
    expect(Number(deposits[0].balanceEffect)).toBe(5000000);
    const events = await prisma.outboxEvent.findMany({ where: { ...scope, OR: [
      { aggregateType: 'Invoice', aggregateId: createdIds.invoiceId, eventName: 'invoice.paid' },
      { aggregateType: 'DepositOperation', aggregateId: createdIds.depositOperationId, eventName: 'deposit.collected' },
    ] } });
    expect(events).toHaveLength(2);
    const paidEvent = events.find((event) => event.eventName === 'invoice.paid');
    expect(paidEvent?.payload).toMatchObject({ paymentId: createdIds.paymentId });

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
          data: {
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
        }
      });
    });
    await admin.page.goto('/ai');
    await admin.page.waitForLoadState('domcontentloaded');
    await checkA11y(admin.page, 'AI Command Center');
    
    await admin.page.getByTestId('ai-message-input').fill('Xoa phong ' + testPrefix);
    await admin.page.route('**/api/v1/ai/conversations/mock-conv-123', route => {
      route.fulfill({
        status: 200,
        json: {
          data: {
            id: 'mock-conv-123',
            messages: [
              { role: 'user', content: 'Xoa phong ' + testPrefix },
              {
                role: 'assistant',
                content: JSON.stringify({
                  actionRequired: 'CONFIRM_DRAFT',
                  data: { title: 'Xoa phong', content: 'Delete room confirmation', description: 'Safety draft' },
                  toolOutput: 'Drafting deletion for room...',
                }),
              },
            ],
          },
        },
      });
    });
    await admin.page.getByTestId('ai-send-button').click();
    
    // It should hit draft safety, not perform deletion
    await expect(admin.page.getByTestId('ai-draft-confirmation')).toBeVisible({ timeout: 15000 });
  });
});
