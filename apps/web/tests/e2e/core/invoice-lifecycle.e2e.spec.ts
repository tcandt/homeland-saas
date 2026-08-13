import { expect } from '@playwright/test';
import { test } from '../fixtures/rbac.fixture';
import { EvidenceCollector } from '../helpers/evidence';

test.describe('Invoice Lifecycle Workflow E2E', () => {
  test.skip(process.env.RUN_DESTRUCTIVE_E2E !== 'true', 'Set RUN_DESTRUCTIVE_E2E=true only against an isolated disposable database.');
  test.setTimeout(120000);

  test('Full Invoice Flow: DRAFT -> ISSUED -> PARTIALLY_PAID -> PAID', async ({ admin }) => {
    const page = admin.page;
    
    // Skip on mobile/tablet viewports since billing workflow is desktop-only
    const isMobile = page.viewportSize()?.width && page.viewportSize()!.width < 1024;
    if (isMobile) {
      test.skip();
    }
    
    page.on('console', msg => console.log('PAGE CONSOLE:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
    const evidence = new EvidenceCollector(page, 'invoice-lifecycle-e2e');
    await evidence.start();

    // 1. Setup Data via Prisma
    const prisma = evidence.getPrisma();
    const customerId = `cus-${Date.now()}`;
    const invoiceId = `inv-${Date.now()}`;
    
    await prisma.customer.create({
      data: {
        id: customerId,
        tenantId: admin.tenantId,
        fullName: `Invoice Customer E2E ${Date.now()}`,
        phone: '0901112223',
        email: 'customer.e2e@test.com',
      }
    });

    await prisma.invoice.create({
      data: {
        id: invoiceId,
        tenantId: admin.tenantId,
        code: `INV-E2E-${Date.now()}`,
        customerId: customerId,
        status: 'DRAFT',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        subtotal: 5000000,
        discount: 0,
        total: 5000000,
        paidAmount: 0,
        creditAmount: 0,
        items: {
          create: [
            {
              tenantId: admin.tenantId,
              type: 'RENT',
              description: 'Rent for testing',
              quantity: 1,
              unitPrice: 5000000,
              amount: 5000000,
            }
          ]
        }
      }
    });

    // 2. Open Invoices Page
    await page.goto('http://127.0.0.1:3000/invoices');
    await page.waitForLoadState('networkidle');

    // 3. Select the Invoice to open drawer
    const invoiceCard = page.locator('[data-testid="invoice-card"]', { hasText: 'Invoice Customer E2E' }).first();
    await invoiceCard.waitFor({ state: 'visible', timeout: 10000 });
    await invoiceCard.hover();
    await invoiceCard.locator('button[aria-label="Xem chi tiết"]').click();

    // 4. Drawer opens, verify status is DRAFT
    const drawer = page.getByTestId('invoice-detail-drawer');
    await expect(drawer.getByTestId('invoice-status-badge')).toHaveText('DRAFT', { timeout: 10000 });

    // 5. Issue Invoice
    await page.getByTestId('btn-issue-invoice').evaluate(el => (el as HTMLElement).click());
    await expect(drawer.getByTestId('invoice-status-badge')).toHaveText('ISSUED', { timeout: 10000 });

    // DB Verification After Issue
    let invoiceInDb = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    let auditLogIssue = await prisma.auditLog.findFirst({ where: { action: 'UPDATE', entityId: invoiceId } });

    expect(invoiceInDb?.status).toBe('ISSUED');
    expect(auditLogIssue).toBeDefined();

    // 6. Pay Invoice Partially
    // Need to handle prompt for Pay
    page.once('dialog', async dialog => {
      await dialog.accept('2000000');
    });
    await page.getByTestId('btn-pay-invoice').evaluate(el => (el as HTMLElement).click());
    
    await expect(drawer.getByTestId('invoice-status-badge')).toHaveText('PARTIALLY_PAID', { timeout: 10000 });

    // DB Verification After Partial Pay
    invoiceInDb = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    let paymentAllocations = await prisma.paymentAllocation.findMany({ where: { invoiceId } });

    expect(invoiceInDb?.status).toBe('PARTIALLY_PAID');
    expect(Number(invoiceInDb?.paidAmount)).toBe(2000000);
    expect(paymentAllocations.length).toBe(1);

    // 7. Pay Invoice Fully
    page.once('dialog', async dialog => {
      await dialog.accept('3000000');
    });
    await page.getByTestId('btn-pay-invoice').evaluate(el => (el as HTMLElement).click());
    
    await expect(drawer.getByTestId('invoice-status-badge')).toHaveText('PAID', { timeout: 10000 });

    // DB Verification After Full Pay
    invoiceInDb = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    let allAllocations = await prisma.paymentAllocation.findMany({ where: { invoiceId } });
    expect(invoiceInDb?.status).toBe('PAID');
    expect(Number(invoiceInDb?.paidAmount)).toBe(5000000);
    expect(allAllocations.length).toBe(2);

    // 8. Capture Final DB State
    await evidence.captureDbSnapshot('invoice-final-state', async () => {
      return prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: { items: true, allocations: true }
      });
    });

    await evidence.stopAndVerifyNoErrors();
  });
});
