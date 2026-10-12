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

    const invoiceRow = page.getByTestId('invoices-list').getByText(invoiceCode, { exact: true }).locator('xpath=ancestor::tr');
    await expect(invoiceRow).toHaveCount(1);
    await expect(invoiceRow).toBeVisible();
    await invoiceRow.click();

    // 3. The current detail view is an accessible dialog with Vietnamese status labels.
    const drawer = page.getByRole('dialog').filter({
      has: page.getByRole('heading', { name: 'Chi tiết hóa đơn', exact: true }),
    });
    // The header and history may repeat a status; scope the assertion to the header.
    const header = drawer.getByRole('heading', { name: 'Chi tiết hóa đơn', exact: true }).locator('..');
    await expect(drawer).toBeVisible();
    await expect(header.getByText('Bản nháp', { exact: true })).toBeVisible();

    // 4. The drawer currently has no issue action, so issue through the authenticated
    // admin API, then reload and reopen to verify the operator-facing issued state.
    const issueResponse = await admin.api.post(`/api/v1/invoices/${invoiceId}/issue`);
    expect(issueResponse.ok(), await issueResponse.text()).toBe(true);
    await drawer.getByRole('button', { name: 'Đóng (ESC)', exact: true }).click();
    await expect(drawer).toBeHidden();
    await page.reload();
    await expect(invoiceRow).toHaveCount(1);
    await expect(invoiceRow).toBeVisible({ timeout: 10000 });
    await invoiceRow.click();
    await expect(header.getByText('Chờ thanh toán', { exact: true })).toBeVisible({ timeout: 10000 });

    // DB verification after issue.
    let invoiceInDb = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    const issueAuditLogs = await prisma.auditLog.findMany({
      where: { tenantId: admin.tenantId, entity: 'Invoice', action: 'UPDATE', entityId: invoiceId },
    });

    expect(invoiceInDb?.status).toBe('ISSUED');
    expect(issueAuditLogs.some((log) => (log.after as { status?: string } | null)?.status === 'ISSUED')).toBe(true);

    // 5. Record a partial cash payment through the operator-facing cash modal.
    await drawer.getByRole('button', { name: /Thu tiền mặt/ }).click();
    const paymentModal = drawer
      .getByRole('heading', { name: 'Ghi nhận thu tiền mặt', exact: true })
      .locator('xpath=ancestor::div[.//input][1]');
    await expect(paymentModal).toBeVisible();
    const paidAmountInput = paymentModal.getByPlaceholder('0');
    await paidAmountInput.fill('2000000');
    await paymentModal.getByRole('button', { name: 'Xác nhận thu', exact: true }).click();
    await expect(paymentModal).toBeHidden();
    await expect(header.getByText('Đã thu một phần', { exact: true })).toBeVisible({ timeout: 10000 });

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
    await drawer.getByRole('button', { name: /Thu tiền mặt/ }).click();
    await expect(paymentModal).toBeVisible();
    await paidAmountInput.fill('3000000');
    await paymentModal.getByRole('button', { name: 'Xác nhận thu', exact: true }).click();
    await expect(paymentModal).toBeHidden();
    await expect(header.getByText('Đã thu đủ', { exact: true })).toBeVisible({ timeout: 10000 });

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
    await expect(invoiceRow).toHaveCount(1);
    await expect(invoiceRow).toBeVisible({ timeout: 10000 });

    await evidence.stopAndVerifyNoErrors();
  });
});
