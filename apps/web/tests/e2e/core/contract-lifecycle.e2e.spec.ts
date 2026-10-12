import { expect } from '@playwright/test';
import { test } from '../fixtures/rbac.fixture';
import { EvidenceCollector } from '../helpers/evidence';

test.describe('Contract Lifecycle Workflow E2E', () => {
  test.skip(process.env.RUN_DESTRUCTIVE_E2E !== 'true', 'Set RUN_DESTRUCTIVE_E2E=true only against an isolated disposable database.');
  test.setTimeout(120000);

  test('Full Contract Flow: DRAFT -> SUBMIT -> APPROVE -> ACTIVATE -> TERMINATE', async ({ admin }) => {
    const page = admin.page;
    
    // Skip on mobile/tablet viewports since contract workflow is desktop-only
    const isMobile = page.viewportSize()?.width && page.viewportSize()!.width < 1024;
    if (isMobile) {
      test.skip();
    }
    
    const evidence = new EvidenceCollector(page, 'contract-lifecycle-e2e');
    await evidence.start();

    // 1. Setup Data via Prisma
    const prisma = evidence.getPrisma();
    const customerId = `cus-${Date.now()}`;
    const roomId = `room-${Date.now()}`;
    const buildingId = `build-${Date.now()}`;
    const contractId = `contract-${Date.now()}`;
    const rentalCycleId = `cycle-${Date.now()}`;
    const customerPhone = `090${Date.now().toString().slice(-7)}`;
    const customerName = `Contract Customer E2E ${Date.now()}`;
    const verifyLifecycleAudit = async (status: string) => {
      const logs = await prisma.auditLog.findMany({
        where: { tenantId: admin.tenantId, entity: 'Contract', entityId: contractId, action: 'UPDATE' },
      });
      expect(logs.filter((log) => (log.after as { status?: string } | null)?.status === status)).toHaveLength(1);
    };
    
    // Create dependencies
    await prisma.building.create({
      data: {
        id: buildingId,
        tenantId: admin.tenantId,
        name: 'Contract Test Building',
        code: `CTB-${Date.now().toString().slice(-4)}`,
        address: 'Test Addr',
      }
    });

    const floorId = `floor-${Date.now()}`;
    await prisma.floor.create({
      data: {
        id: floorId,
        tenantId: admin.tenantId,
        buildingId: buildingId,
        name: 'Floor 1',
        level: 1,
      }
    });

    await prisma.room.create({
      data: {
        id: roomId,
        tenantId: admin.tenantId,
        buildingId: buildingId,
        floorId: floorId,
        name: 'Room Contract E2E',
        code: `R-C-${Date.now().toString().slice(-6)}`,
        status: 'AVAILABLE',
        monthlyPrice: 5000000,
        capacity: 2,
      }
    });

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

    const now = new Date();
    const startDate = new Date(now);
    startDate.setUTCDate(startDate.getUTCDate() - 1);
    const nextYear = new Date(startDate);
    nextYear.setFullYear(now.getFullYear() + 1);

    await prisma.rentalCycle.create({
      data: {
        id: rentalCycleId,
        tenantId: admin.tenantId,
        customerId,
        roomId,
        status: 'PLANNED',
        expectedMoveInAt: startDate,
      },
    });

    await prisma.contract.create({
      data: {
        id: contractId,
        tenantId: admin.tenantId,
        code: `CT-${Date.now()}`,
        roomId: roomId,
        customerId: customerId,
        rentalCycleId,
        status: 'DRAFT',
        startDate,
        endDate: nextYear,
        signedAt: startDate,
        firstPaymentDate: startDate,
        monthlyRent: 5000000,
        depositMoney: 10000000,
      }
    });

    // 2. Open Contracts Page
    await page.goto('/contracts');
    await page.waitForLoadState('networkidle');

    // 3. Select the Contract to open drawer
    const contractCard = page.locator('[data-testid="contract-card"]:visible').filter({ hasText: customerName });
    await expect(contractCard).toHaveCount(1);
    await contractCard.waitFor({ state: 'visible', timeout: 10000 });
    await contractCard.click();

    // 4. Drawer opens, verify status is DRAFT
    let drawer = page.getByTestId('contract-detail-drawer');
    await expect(drawer.getByTestId('contract-status-badge')).toContainText('Bản nháp', { timeout: 10000 });

    // 5. Submit Contract
    await drawer.getByTestId('btn-submit-contract').click();
    await expect(drawer).not.toBeInViewport();
    await expect(contractCard.getByTestId('contract-status-badge')).toContainText('Chờ duyệt', { timeout: 10000 });
    await verifyLifecycleAudit('PENDING_APPROVAL');
    await contractCard.click();
    await expect(drawer).toBeVisible();
    await expect(drawer).toBeInViewport();
    await expect(drawer.getByTestId('contract-status-badge')).toContainText('Chờ duyệt');

    // 6. Approve Contract
    await drawer.getByTestId('btn-approve-contract').click();
    await expect(drawer).not.toBeInViewport();
    await expect(contractCard.getByTestId('contract-status-badge')).toContainText('Đã duyệt', { timeout: 10000 });

    // DB Verification After Approve
    let contractInDb = await prisma.contract.findUnique({ where: { id: contractId } });
    let roomInDb = await prisma.room.findUnique({ where: { id: roomId } });

    expect(contractInDb?.status).toBe('APPROVED');
    expect(roomInDb?.status).toBe('RESERVED');
    await verifyLifecycleAudit('APPROVED');

    // Prepare and fund the canonical server-owned ENTRY obligation. No deposit,
    // operation, or ledger state is written directly by this browser test.
    const prepareEntryResponse = await admin.api.post(`/api/v1/contracts/${contractId}/prepare-entry-billing`, {
      data: {},
    });
    expect(prepareEntryResponse.ok(), await prepareEntryResponse.text()).toBe(true);
    const entryInvoice = await prisma.invoice.findFirst({
      where: { tenantId: admin.tenantId, contractId, billingKind: 'ENTRY' },
    });
    expect(entryInvoice).toBeTruthy();
    expect(entryInvoice?.status).toBe('ISSUED');
    expect(Number(entryInvoice?.total)).toBeGreaterThan(0);
    if (!entryInvoice) throw new Error('Entry billing did not create the canonical invoice.');

    const entryProviderRef = `CASH:contract-entry-${contractId}`;
    const entryPaymentResponse = await admin.api.post(`/api/v1/invoices/${entryInvoice.id}/pay`, {
      data: {
        amount: Number(entryInvoice.total),
        provider: 'MANUAL',
        providerRef: entryProviderRef,
      },
    });
    expect(entryPaymentResponse.ok(), await entryPaymentResponse.text()).toBe(true);

    let depositInDb = await prisma.deposit.findFirst({ where: { tenantId: admin.tenantId, contractId } });
    expect(depositInDb).toBeTruthy();
    if (!depositInDb) throw new Error('Entry billing did not create a security deposit.');
    const entryInvoicePaid = await prisma.invoice.findUnique({ where: { id: entryInvoice.id } });
    const entryPayments = await prisma.payment.findMany({
      where: { tenantId: admin.tenantId, invoiceId: entryInvoice.id },
    });
    const entryAllocations = await prisma.paymentAllocation.findMany({
      where: { tenantId: admin.tenantId, invoiceId: entryInvoice.id },
    });
    const fundedDeposit = await prisma.depositLedgerEntry.aggregate({
      where: { tenantId: admin.tenantId, depositId: depositInDb.id },
      _sum: { balanceEffect: true },
    });
    const entryCollection = await prisma.depositOperation.findFirst({
      where: {
        tenantId: admin.tenantId,
        sourceDepositId: depositInDb.id,
        contractId,
        type: 'COLLECT',
        status: 'COMPLETED',
        idempotencyKey: `entry-invoice:${entryInvoice.id}:security-funding`,
      },
    });
    expect(entryCollection).toBeTruthy();
    if (!entryCollection) throw new Error('Entry payment did not create the security funding operation.');
    const entryCashIn = await prisma.depositLedgerEntry.findFirst({
      where: {
        tenantId: admin.tenantId,
        depositId: depositInDb.id,
        operationId: entryCollection.id,
        type: 'CASH_IN',
      },
    });

    expect(entryInvoicePaid?.status).toBe('PAID');
    expect(Number(entryInvoicePaid?.paidAmount)).toBe(Number(entryInvoice.total));
    expect(Number(entryInvoicePaid?.creditAmount)).toBe(0);
    expect(depositInDb.status).toBe('PAID');
    expect(entryPayments).toHaveLength(1);
    expect(entryPayments[0]).toMatchObject({ provider: 'MANUAL', providerRef: entryProviderRef, status: 'CONFIRMED' });
    expect(Number(entryPayments[0].amount)).toBe(Number(entryInvoice.total));
    expect(entryAllocations).toHaveLength(1);
    expect(entryAllocations[0].paymentId).toBe(entryPayments[0].id);
    expect(Number(entryAllocations[0].amount)).toBe(Number(entryInvoice.total));
    expect(entryCashIn).toBeTruthy();
    expect(Number(fundedDeposit._sum.balanceEffect)).toBe(Number(depositInDb.amount));
    expect(Number(entryCashIn?.balanceEffect)).toBe(Number(depositInDb.amount));
    const fundedDepositBalance = Number(fundedDeposit._sum.balanceEffect);

    // 7. Activate Contract
    await contractCard.click();
    await expect(drawer).toBeVisible();
    await expect(drawer).toBeInViewport();
    await expect(drawer.getByTestId('contract-status-badge')).toContainText('Đã duyệt');
    await drawer.getByTestId('btn-activate-contract').click();
    const moveInConfirmation = page.getByTestId('contract-move-in-confirm');
    await expect(moveInConfirmation).toBeVisible();
    await moveInConfirmation.getByRole('button', { name: 'Xác nhận đã bàn giao và nhận phòng', exact: true }).click();
    await expect(moveInConfirmation).toBeHidden();
    await expect(drawer).not.toBeInViewport();
    await expect(contractCard.getByTestId('contract-status-badge')).toContainText('Đang hiệu lực', { timeout: 10000 });
    await contractCard.click();
    await expect(drawer).toBeVisible();
    await expect(drawer).toBeInViewport();
    await expect(drawer.getByTestId('contract-status-badge')).toContainText('Đang hiệu lực');

    // DB Verification After Activate
    contractInDb = await prisma.contract.findUnique({ where: { id: contractId } });
    roomInDb = await prisma.room.findUnique({ where: { id: roomId } });
    depositInDb = await prisma.deposit.findFirst({ where: { tenantId: admin.tenantId, contractId } });
    const entryInvoicesAfterActivation = await prisma.invoice.findMany({
      where: { tenantId: admin.tenantId, contractId, billingKind: 'ENTRY' },
    });

    expect(contractInDb?.status).toBe('ACTIVE');
    expect(roomInDb?.status).toBe('OCCUPIED');
    expect(depositInDb?.status).toBe('CONVERTED_TO_CONTRACT');
    expect(entryInvoicesAfterActivation).toHaveLength(1);
    expect(entryInvoicesAfterActivation[0]).toMatchObject({ id: entryInvoice.id, status: 'PAID' });
    expect(Number(entryInvoicesAfterActivation[0].paidAmount)).toBe(Number(entryInvoice.total));
    expect(Number(entryInvoicesAfterActivation[0].creditAmount)).toBe(0);
    await verifyLifecycleAudit('ACTIVE');
    expect(await prisma.occupancy.count({ where: { contractId, leftAt: null } })).toBe(1);
    expect(await prisma.rentalCycle.findUnique({ where: { id: rentalCycleId }, select: { status: true } }))
      .toEqual({ status: 'ACTIVE' });

    // 8. Settle and terminate. A pending refund is deliberate: completing it
    // is a separate server-backed proof workflow.
    await page.getByTestId('btn-open-settlement').click();
    const settlementModal = page.getByTestId('contract-settlement-modal');
    await expect(settlementModal).toBeVisible();
    await settlementModal.getByTestId('contract-settlement-deposit-refund').fill('10000000');
    await settlementModal.getByTestId('contract-settlement-refund-status').selectOption('PENDING');
    const confirmTermination = settlementModal.getByTestId('btn-confirm-terminate-settlement');
    await expect(confirmTermination).toBeEnabled({ timeout: 15000 });
    await confirmTermination.click();
    await expect(settlementModal).toBeHidden();
    await expect(drawer).not.toBeInViewport();
    await expect(contractCard.getByTestId('contract-status-badge')).toContainText('Đã chấm dứt', { timeout: 10000 });

    // DB Verification After Terminate
    contractInDb = await prisma.contract.findUnique({ where: { id: contractId } });
    roomInDb = await prisma.room.findUnique({ where: { id: roomId } });
    const settlement = await prisma.contractSettlement.findUnique({ where: { contractId } });
    const pendingRefund = await prisma.receipt.findFirst({
      where: { tenantId: admin.tenantId, code: `RCT-SET-${contractId}`, status: 'PENDING' },
    });
    depositInDb = await prisma.deposit.findFirst({ where: { tenantId: admin.tenantId, contractId } });
    expect(depositInDb).toBeTruthy();
    if (!depositInDb) throw new Error('Settlement lost the contract security deposit.');
    const balanceAfterPendingRefund = await prisma.depositLedgerEntry.aggregate({
      where: { tenantId: admin.tenantId, depositId: depositInDb.id },
      _sum: { balanceEffect: true },
    });
    const pendingRefundOperation = await prisma.depositOperation.findFirst({
      where: {
        tenantId: admin.tenantId,
        sourceDepositId: depositInDb.id,
        contractId,
        type: 'CANCEL',
        status: 'PENDING',
      },
    });
    const refundLedgerEntries = await prisma.depositLedgerEntry.count({
      where: { tenantId: admin.tenantId, depositId: depositInDb.id, type: 'REFUND' },
    });

    expect(contractInDb?.status).toBe('TERMINATED');
    expect(roomInDb?.status).toBe('AVAILABLE');
    expect(settlement).toBeTruthy();
    expect(pendingRefund).toBeTruthy();
    expect(depositInDb?.status).toBe('CONVERTED_TO_CONTRACT');
    expect(Number(balanceAfterPendingRefund._sum.balanceEffect)).toBe(fundedDepositBalance);
    expect(pendingRefundOperation).toBeTruthy();
    expect(refundLedgerEntries).toBe(0);
    // Canonical termination records its atomic evidence against the settlement,
    // not a duplicate Contract UPDATE event.
    if (!settlement || !pendingRefund || !pendingRefundOperation) throw new Error('Missing pending settlement evidence.');
    const settlementAudit = await prisma.auditLog.findMany({
      where: { tenantId: admin.tenantId, entity: 'ContractSettlement', entityId: settlement.id, action: 'CREATE' },
    });
    expect(settlementAudit).toHaveLength(1);
    expect(settlementAudit[0].after).toMatchObject({
      refundReceiptId: pendingRefund.id,
      depositOperations: expect.arrayContaining([expect.objectContaining({
        id: pendingRefundOperation.id, depositId: depositInDb.id, status: 'PENDING', refundAmount: fundedDepositBalance,
      })]),
    });
    expect(await prisma.occupancy.count({ where: { contractId, leftAt: null } })).toBe(0);
    expect(await prisma.rentalCycle.findUnique({ where: { id: rentalCycleId }, select: { status: true } }))
      .toEqual({ status: 'CLOSED' });

    // 9. Reload UI and Verify State Persists
    await page.reload();
    await page.waitForLoadState('networkidle');
    const contractCardReloaded = page.locator('[data-testid="contract-card"]:visible').filter({ hasText: customerName });
    await expect(contractCardReloaded).toHaveCount(1);
    await contractCardReloaded.waitFor({ state: 'visible', timeout: 10000 });
    await contractCardReloaded.click();
    await expect(drawer.getByTestId('contract-status-badge')).toContainText('Đã chấm dứt', { timeout: 10000 });

    // 10. Capture Final DB State
    await evidence.captureDbSnapshot('contract-final-state', async () => {
      return prisma.contract.findUnique({
        where: { id: contractId },
        include: { room: true, invoices: true, settlement: true, rentalCycle: true }
      });
    });

    await evidence.stopAndVerifyNoErrors();
  });
});
