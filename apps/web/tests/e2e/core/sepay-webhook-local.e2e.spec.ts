import { createHmac } from 'node:crypto';
import { expect } from '@playwright/test';
import { test } from '../fixtures/rbac.fixture';
import { EvidenceCollector } from '../helpers/evidence';

function unwrapApiResponse(payload: any) {
  return payload?.data?.data ?? payload?.data ?? payload;
}

test.describe('SePay Webhook Runtime E2E (local signed transport)', () => {
  test.skip(process.env.RUN_DESTRUCTIVE_E2E !== 'true', 'Set RUN_DESTRUCTIVE_E2E=true only against an isolated disposable database.');
  test.setTimeout(120000);

  test('rejects an invalid signature and settles exactly once when the signed webhook is replayed', async ({ admin }) => {
    const { api, page, tenantId } = admin;
    const apiV1 = '/api/v1';
    const evidence = new EvidenceCollector(page, 'sepay-webhook-local-e2e');
    await evidence.start();

    const prisma = evidence.getPrisma();
    const runId = Date.now();
    const customerId = `cus-sepay-e2e-${runId}`;
    const invoiceId = `inv-sepay-e2e-${runId}`;
    const customerPhone = `090${runId.toString().slice(-7)}`;
    const invoiceCode = `INV-SEPAY-E2E-${runId}`;
    const invoiceAmount = 123000;

    const sepaySetting = await prisma.appSetting.findFirst({
      where: { tenantId, key: 'sepay' },
      select: { value: true },
    });
    const hmacSecret = String((sepaySetting?.value as any)?.hmacSecret || '').trim();
    expect(hmacSecret, 'The isolated E2E tenant must have an HMAC SePay setting.').not.toBe('');

    await prisma.customer.create({
      data: {
        id: customerId,
        tenantId,
        fullName: `SePay Customer E2E ${runId}`,
        phone: customerPhone,
        phoneNormalized: customerPhone,
      },
    });
    await prisma.invoice.create({
      data: {
        id: invoiceId,
        tenantId,
        customerId,
        code: invoiceCode,
        status: 'DRAFT',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        subtotal: invoiceAmount,
        discount: 0,
        total: invoiceAmount,
        paidAmount: 0,
        creditAmount: 0,
        items: {
          create: {
            tenantId,
            type: 'RENT',
            description: 'Isolated SePay webhook E2E rent item',
            quantity: 1,
            unitPrice: invoiceAmount,
            amount: invoiceAmount,
          },
        },
      },
    });

    const issueResponse = await api.post(`${apiV1}/invoices/${invoiceId}/issue`);
    expect(issueResponse.ok(), await issueResponse.text()).toBe(true);

    const requestResponse = await api.post(`${apiV1}/payments/invoices/${invoiceId}/request`);
    expect(requestResponse.ok(), await requestResponse.text()).toBe(true);
    const paymentRequest = unwrapApiResponse(await requestResponse.json());
    expect(paymentRequest).toMatchObject({ sourceId: invoiceId, amount: invoiceAmount, status: 'PENDING' });
    expect(paymentRequest.paymentCode).toEqual(expect.any(String));
    expect(paymentRequest.bankAccountNumber).toEqual(expect.any(String));

    const transactionId = `E2E-SEPAY-${runId}`;
    const payload = {
      id: transactionId,
      gateway: paymentRequest.bankName,
      transactionDate: new Date().toISOString(),
      accountNumber: paymentRequest.bankAccountNumber,
      transferType: 'in',
      transferAmount: invoiceAmount,
      code: paymentRequest.paymentCode,
      content: `Thanh toan ${paymentRequest.paymentCode}`,
    };
    const rawBody = JSON.stringify(payload);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const validSignature = createHmac('sha256', hmacSecret)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');
    const headers = {
      'content-type': 'application/json',
      'x-sepay-timestamp': timestamp,
      'x-sepay-signature': validSignature,
    };

    const rejectedResponse = await api.post(`${apiV1}/payments/sepay/webhook`, {
      data: rawBody,
      headers: { ...headers, 'x-sepay-signature': '0'.repeat(64) },
    });
    expect(rejectedResponse.status()).toBe(401);
    expect(await prisma.paymentWebhookLog.count({ where: { providerTransactionId: transactionId } })).toBe(0);

    const acceptedResponse = await api.post(`${apiV1}/payments/sepay/webhook`, { data: rawBody, headers });
    expect(acceptedResponse.ok(), await acceptedResponse.text()).toBe(true);

    let invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    let paymentRequestInDb = await prisma.paymentRequest.findUnique({ where: { id: paymentRequest.id } });
    let payments = await prisma.payment.findMany({ where: { tenantId, invoiceId } });
    let allocations = await prisma.paymentAllocation.findMany({ where: { tenantId, invoiceId } });
    let webhookLogs = await prisma.paymentWebhookLog.findMany({ where: { providerTransactionId: transactionId } });

    expect(invoice).toMatchObject({ status: 'PAID' });
    expect(Number(invoice?.paidAmount)).toBe(invoiceAmount);
    expect(Number(invoice?.creditAmount)).toBe(0);
    expect(paymentRequestInDb).toMatchObject({ status: 'CONFIRMED', providerTransactionId: transactionId });
    expect(payments).toHaveLength(1);
    expect(payments[0]).toMatchObject({ provider: 'SEPAY', providerRef: transactionId, status: 'CONFIRMED' });
    expect(Number(payments[0].amount)).toBe(invoiceAmount);
    expect(allocations).toHaveLength(1);
    expect(Number(allocations[0].amount)).toBe(invoiceAmount);
    expect(allocations[0].paymentId).toBe(payments[0].id);
    expect(webhookLogs).toHaveLength(1);
    expect(webhookLogs[0].status).toBe('PROCESSED');

    const replayResponse = await api.post(`${apiV1}/payments/sepay/webhook`, { data: rawBody, headers });
    expect(replayResponse.ok(), await replayResponse.text()).toBe(true);

    invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    paymentRequestInDb = await prisma.paymentRequest.findUnique({ where: { id: paymentRequest.id } });
    payments = await prisma.payment.findMany({ where: { tenantId, invoiceId } });
    allocations = await prisma.paymentAllocation.findMany({ where: { tenantId, invoiceId } });
    webhookLogs = await prisma.paymentWebhookLog.findMany({ where: { providerTransactionId: transactionId } });

    expect(invoice).toMatchObject({ status: 'PAID' });
    expect(Number(invoice?.paidAmount)).toBe(invoiceAmount);
    expect(paymentRequestInDb).toMatchObject({ status: 'CONFIRMED', providerTransactionId: transactionId });
    expect(payments).toHaveLength(1);
    expect(allocations).toHaveLength(1);
    expect(webhookLogs).toHaveLength(1);
    expect(webhookLogs[0].status).toBe('PROCESSED');

    // A different provider transaction with the same payment code is not a
    // replay. It must be held for finance review instead of being allocated
    // again or causing a second payment confirmation.
    const duplicateTransactionId = `${transactionId}-DUPLICATE`;
    const duplicateRawBody = JSON.stringify({ ...payload, id: duplicateTransactionId });
    const duplicateTimestamp = String(Math.floor(Date.now() / 1000));
    const duplicateSignature = createHmac('sha256', hmacSecret)
      .update(`${duplicateTimestamp}.${duplicateRawBody}`)
      .digest('hex');
    const duplicateResponse = await api.post(`${apiV1}/payments/sepay/webhook`, {
      data: duplicateRawBody,
      headers: {
        'content-type': 'application/json',
        'x-sepay-timestamp': duplicateTimestamp,
        'x-sepay-signature': duplicateSignature,
      },
    });
    expect(duplicateResponse.ok(), await duplicateResponse.text()).toBe(true);

    payments = await prisma.payment.findMany({ where: { tenantId, invoiceId } });
    allocations = await prisma.paymentAllocation.findMany({ where: { tenantId, invoiceId } });
    const duplicateWebhook = await prisma.paymentWebhookLog.findUnique({
      where: { provider_providerTransactionId: { provider: 'SEPAY', providerTransactionId: duplicateTransactionId } },
    });
    expect(payments).toHaveLength(1);
    expect(allocations).toHaveLength(1);
    expect(duplicateWebhook?.status).toBe('NEEDS_REVIEW');

    await page.goto('/invoices');
    const invoiceCard = page.locator('[data-testid="invoice-card"]:visible').filter({ hasText: invoiceCode }).first();
    await expect(invoiceCard).toBeVisible({ timeout: 10000 });
    await invoiceCard.click();
    const drawer = page.getByTestId('invoice-detail-drawer');
    await expect(drawer.getByTestId('invoice-status-badge')).toHaveText('Đã thu đủ', { timeout: 10000 });

    await evidence.captureDbSnapshot('sepay-webhook-final-state', async () => ({
      invoice: await prisma.invoice.findUnique({
        where: { id: invoiceId },
        select: { id: true, status: true, paidAmount: true, creditAmount: true },
      }),
      paymentRequest: await prisma.paymentRequest.findUnique({
        where: { id: paymentRequest.id },
        select: { id: true, status: true, providerTransactionId: true, amount: true },
      }),
      payments: await prisma.payment.findMany({
        where: { tenantId, invoiceId },
        select: { id: true, amount: true, provider: true, providerRef: true, status: true },
      }),
      allocations: await prisma.paymentAllocation.findMany({
        where: { tenantId, invoiceId },
        select: { paymentId: true, invoiceId: true, amount: true },
      }),
      webhookLogs: await prisma.paymentWebhookLog.findMany({
        where: { providerTransactionId: { in: [transactionId, duplicateTransactionId] } },
        select: { providerTransactionId: true, status: true, processedAt: true },
      }),
    }));
    await page.screenshot({ path: test.info().outputPath('sepay-webhook-paid.png'), fullPage: true });
    await evidence.stopAndVerifyNoErrors();
  });
});
