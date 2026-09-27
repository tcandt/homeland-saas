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
    
    const evidence = new EvidenceCollector(page, 'invoice-lifecycle-e2e');
    await evidence.start();

    // 1. Set up a unique draft invoice only on the isolated E2E database.
    const prisma = evidence.getPrisma();
    const runId = Date.now();
    const customerId = `cus-invoice-e2e-${runId}`;
    const invoiceId = `inv-invoice-e2e-${runId}`;
    const customerName = `Invoice Customer E2E ${runId}`;
    const customerPhone = `090${runId.toString().slice(-7)}`;
    const invoiceCode = `INV-E2E-${runId}`;
    
    await prisma.customer.create({
      data: {
        id: customerId,
        tenantId: admin.tenantId,
        fullName: customerName,
        phone: customerPhone,
        phoneNormalized: customerPhone,
        email: 'customer.e2e@test.com',
      }
    });

    await prisma.invoice.create({
      data: {
        id: invoiceId,
        tenantId: admin.tenantId,
        code: invoiceCode,
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

    // 2. Find the server-created draft on the actual invoice screen.
    await page.goto('/invoices');
    await page.waitForLoadState('networkidle');

    const invoiceCard = page
      .locator('[data-testid="invoice-card"]:visible')
      .filter({ hasText: invoiceCode })
      .first();
    await invoiceCard.waitFor({ state: 'visible', timeout: 10000 });
    await invoiceCard.click();

    // 3. Status labels are user-facing Vietnamese text, not internal enums.
    const drawer = page.getByTestId('invoice-detail-drawer');
    await expect(drawer).toBeVisible();
    await expect(drawer.getByTestId('invoice-status-badge')).toHaveText('Bản nháp', { timeout: 10000 });

    // 4. Issue through the visible operator action.
    await drawer.getByTestId('btn-issue-invoice').click();
    await expect(drawer.getByTestId('invoice-status-badge')).toHaveText('Chờ thanh toán', { timeout: 10000 });

    // DB verification after issue.
    let invoiceInDb = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    let auditLogIssue = await prisma.auditLog.findFirst({ where: { action: 'UPDATE', entityId: invoiceId } });

    expect(invoiceInDb?.status).toBe('ISSUED');
    expect(auditLogIssue).toBeDefined();

    // 5. Record a partial cash payment through the custom payment modal.
    await drawer.getByTestId('btn-pay-invoice').click();
    const paymentModal = page
      .getByRole('heading', { name: 'Xác nhận ghi nhận thu tiền' })
      .locator('xpath=../..');
    await expect(paymentModal).toBeVisible();
    await page.getByRole('button', { name: 'Tiền mặt trực tiếp' }).click();
    const paidAmountInput = page.getByPlaceholder('Nhập số tiền...');
    await paidAmountInput.fill('2000000');
    await page.getByRole('button', { name: 'Xác nhận đã thu tiền mặt' }).click();
    await expect(paymentModal).toBeHidden();
    await expect(drawer.getByTestId('invoice-status-badge')).toHaveText('Đã thu 1 phần', { timeout: 10000 });

    // DB verification after the partial collection.
    invoiceInDb = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    let payments = await prisma.payment.findMany({ where: { tenantId: admin.tenantId, invoiceId }, orderBy: { createdAt: 'asc' } });
    let paymentAllocations = await prisma.paymentAllocation.findMany({ where: { tenantId: admin.tenantId, invoiceId } });

    expect(invoiceInDb?.status).toBe('PARTIALLY_PAID');
    expect(Number(invoiceInDb?.paidAmount)).toBe(2000000);
    expect(Number(invoiceInDb?.creditAmount)).toBe(0);
    expect(payments).toHaveLength(1);
    expect(payments[0]).toMatchObject({ provider: 'MANUAL', status: 'CONFIRMED' });
    expect(payments[0].providerRef).toMatch(/^CASH:/);
    expect(Number(payments[0].amount)).toBe(2000000);
    expect(paymentAllocations.length).toBe(1);
    expect(Number(paymentAllocations[0].amount)).toBe(2000000);

    // 6. Collect the exact remaining cash balance through the same UI.
    await drawer.getByTestId('btn-pay-invoice').click();
    await expect(paymentModal).toBeVisible();
    await page.getByRole('button', { name: 'Tiền mặt trực tiếp' }).click();
    await paidAmountInput.fill('3000000');
    await page.getByRole('button', { name: 'Xác nhận đã thu tiền mặt' }).click();
    await expect(paymentModal).toBeHidden();
    await expect(drawer.getByTestId('invoice-status-badge')).toHaveText('Đã thu đủ', { timeout: 10000 });

    // DB verification after final collection: exactly two confirmed payments,
    // exactly two allocations, no credit balance and no accidental overpayment.
    invoiceInDb = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    payments = await prisma.payment.findMany({ where: { tenantId: admin.tenantId, invoiceId }, orderBy: { createdAt: 'asc' } });
    const allAllocations = await prisma.paymentAllocation.findMany({ where: { tenantId: admin.tenantId, invoiceId }, orderBy: { createdAt: 'asc' } });
    expect(invoiceInDb?.status).toBe('PAID');
    expect(Number(invoiceInDb?.paidAmount)).toBe(5000000);
    expect(Number(invoiceInDb?.creditAmount)).toBe(0);
    expect(payments).toHaveLength(2);
    expect(payments.every((payment) => payment.provider === 'MANUAL' && payment.status === 'CONFIRMED')).toBe(true);
    expect(payments.every((payment) => payment.providerRef?.startsWith('CASH:'))).toBe(true);
    expect(payments.map((payment) => Number(payment.amount))).toEqual([2000000, 3000000]);
    expect(allAllocations).toHaveLength(2);
    expect(allAllocations.map((allocation) => Number(allocation.amount))).toEqual([2000000, 3000000]);
    expect(allAllocations.map((allocation) => allocation.paymentId).sort()).toEqual(payments.map((payment) => payment.id).sort());

    // 7. Persist a masked structural evidence snapshot and verify the UI survives reload.
    await evidence.captureDbSnapshot('invoice-final-state', async () => {
      return prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: { items: true, allocations: { include: { payment: true } } }
      });
    });

    await page.screenshot({ path: test.info().outputPath('invoice-paid.png'), fullPage: true });
    await page.reload();
    await expect(
      page.locator('[data-testid="invoice-card"]:visible').filter({ hasText: invoiceCode }).first(),
    ).toBeVisible({ timeout: 10000 });

    await evidence.stopAndVerifyNoErrors();
  });
});
