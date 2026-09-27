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
        fullName: `Contract Customer E2E ${Date.now()}`,
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
    const contractCard = page.locator('[data-testid="contract-card"]:visible').filter({ hasText: 'Contract Customer E2E' }).first();
    await contractCard.waitFor({ state: 'visible', timeout: 10000 });
    await contractCard.click();

    // 4. Drawer opens, verify status is DRAFT
    let drawer = page.getByTestId('contract-detail-drawer');
    await expect(drawer.getByTestId('contract-status-badge')).toContainText('Bản nháp', { timeout: 10000 });

    // 5. Submit Contract
    await drawer.getByTestId('btn-submit-contract').click();
    await expect(drawer).toBeHidden();
    await expect(contractCard.getByTestId('contract-status-badge')).toContainText('Chờ duyệt', { timeout: 10000 });
    await contractCard.click();
    drawer = page.getByTestId('contract-detail-drawer');
    await expect(drawer.getByTestId('contract-status-badge')).toContainText('Chờ duyệt');

    // 6. Approve Contract
    await drawer.getByTestId('btn-approve-contract').click();
    await expect(drawer).toBeHidden();
    await expect(contractCard.getByTestId('contract-status-badge')).toContainText('Đã duyệt', { timeout: 10000 });
    await contractCard.click();
    drawer = page.getByTestId('contract-detail-drawer');
    await expect(drawer.getByTestId('contract-status-badge')).toContainText('Đã duyệt');

    // DB Verification After Approve
    let contractInDb = await prisma.contract.findUnique({ where: { id: contractId } });
    let roomInDb = await prisma.room.findUnique({ where: { id: roomId } });
    let depositInDb = await prisma.deposit.findFirst({ where: { contractId } });
    let auditLogApprove = await prisma.auditLog.findFirst({ where: { action: 'UPDATE', entityId: contractId } });

    expect(contractInDb?.status).toBe('APPROVED');
    expect(roomInDb?.status).toBe('RESERVED');
    expect(depositInDb).toBeDefined();
    expect(auditLogApprove).toBeDefined();

    // Simulate only the external payment settlement. The lifecycle mutations
    // remain API-driven; activation requires a complete deposit ledger trail.
    if (!depositInDb?.id) throw new Error('Approval did not create a security deposit.');
    const collectionKey = `e2e-contract-collection-${contractId}`;
    const paidDeposit = await prisma.deposit.update({
      where: { id: depositInDb.id },
      data: { status: 'PAID' },
    });
    const depositOperation = await prisma.depositOperation.create({
      data: {
        tenantId: admin.tenantId,
        rentalCycleId,
        sourceDepositId: paidDeposit.id,
        contractId,
        type: 'COLLECT',
        status: 'COMPLETED',
        idempotencyKey: collectionKey,
        requestHash: `e2e:${contractId}:deposit-collection`,
        result: { amount: 10000000, source: 'isolated-e2e-fixture' },
        createdBy: admin.user.id,
        completedAt: new Date(),
      },
    });
    await prisma.depositLedgerEntry.create({
      data: {
        tenantId: admin.tenantId,
        rentalCycleId,
        depositId: paidDeposit.id,
        contractId,
        operationId: depositOperation.id,
        type: 'CASH_IN',
        amount: 10000000,
        balanceEffect: 10000000,
        idempotencyKey: `${collectionKey}:cash-in`,
        sourceType: 'E2E_PAYMENT_FIXTURE',
        sourceId: paidDeposit.id,
        metadata: { scenario: 'contract-lifecycle' },
        createdBy: admin.user.id,
      },
    });

    // 7. Activate Contract
    await drawer.getByTestId('btn-activate-contract').click();
    await expect(drawer).toBeHidden();
    await expect(contractCard.getByTestId('contract-status-badge')).toContainText('Đang hiệu lực', { timeout: 10000 });
    await contractCard.click();
    drawer = page.getByTestId('contract-detail-drawer');
    await expect(drawer.getByTestId('contract-status-badge')).toContainText('Đang hiệu lực');

    // DB Verification After Activate
    contractInDb = await prisma.contract.findUnique({ where: { id: contractId } });
    roomInDb = await prisma.room.findUnique({ where: { id: roomId } });
    depositInDb = await prisma.deposit.findFirst({ where: { contractId } });
    let invoices = await prisma.invoice.findMany({ where: { contractId } });
    let auditLogActivate = await prisma.auditLog.findFirst({ where: { action: 'UPDATE', entityId: contractId } });

    expect(contractInDb?.status).toBe('ACTIVE');
    expect(roomInDb?.status).toBe('OCCUPIED');
    expect(depositInDb?.status).toBe('CONVERTED_TO_CONTRACT');
    expect(invoices.length).toBeGreaterThan(0);
    expect(auditLogActivate).toBeDefined();
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
    await expect(drawer).toBeHidden();
    await expect(contractCard.getByTestId('contract-status-badge')).toContainText('Đã chấm dứt', { timeout: 10000 });

    // DB Verification After Terminate
    contractInDb = await prisma.contract.findUnique({ where: { id: contractId } });
    roomInDb = await prisma.room.findUnique({ where: { id: roomId } });
    let auditLogTerminate = await prisma.auditLog.findFirst({ where: { action: 'UPDATE', entityId: contractId } });
    const settlement = await prisma.contractSettlement.findUnique({ where: { contractId } });
    const pendingRefund = await prisma.receipt.findFirst({
      where: { tenantId: admin.tenantId, code: `RCT-SET-${contractId}`, status: 'PENDING' },
    });

    expect(contractInDb?.status).toBe('TERMINATED');
    expect(roomInDb?.status).toBe('AVAILABLE');
    expect(settlement).toBeDefined();
    expect(pendingRefund).toBeDefined();
    expect(auditLogTerminate).toBeDefined();
    expect(await prisma.occupancy.count({ where: { contractId, leftAt: null } })).toBe(0);
    expect(await prisma.rentalCycle.findUnique({ where: { id: rentalCycleId }, select: { status: true } }))
      .toEqual({ status: 'CLOSED' });

    // 9. Reload UI and Verify State Persists
    await page.reload();
    await page.waitForLoadState('networkidle');
    const contractCardReloaded = page.locator('[data-testid="contract-card"]:visible').filter({ hasText: 'Contract Customer E2E' }).first();
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
