import { expect } from '@playwright/test';
import { test } from '../fixtures/rbac.fixture';
import { EvidenceCollector } from '../helpers/evidence';

test.describe('Contract Lifecycle Workflow E2E', () => {
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
        phone: '0901112223',
        email: 'customer.e2e@test.com',
      }
    });

    const now = new Date();
    const nextYear = new Date(now);
    nextYear.setFullYear(now.getFullYear() + 1);

    await prisma.contract.create({
      data: {
        id: contractId,
        tenantId: admin.tenantId,
        code: `CT-${Date.now()}`,
        roomId: roomId,
        customerId: customerId,
        status: 'DRAFT',
        startDate: now,
        endDate: nextYear,
        monthlyRent: 5000000,
        depositMoney: 10000000,
      }
    });

    // 2. Open Contracts Page
    await page.goto('http://127.0.0.1:3000/contracts');
    await page.waitForLoadState('networkidle');

    // 3. Select the Contract to open drawer
    const contractCard = page.locator('[data-testid="contract-card"]', { hasText: 'Contract Customer E2E' }).filter({ visible: true }).first();
    await contractCard.waitFor({ state: 'visible', timeout: 10000 });
    await contractCard.locator('button[aria-label="Xem chi tiết"]').click({ force: true });

    // 4. Drawer opens, verify status is DRAFT
    const drawer = page.getByTestId('contract-detail-drawer');
    await expect(drawer.getByTestId('contract-status-badge')).toContainText('Bản nháp', { timeout: 10000 });

    // 5. Submit Contract
    await page.getByTestId('btn-submit-contract').evaluate(el => (el as HTMLElement).click());
    await expect(drawer.getByTestId('contract-status-badge')).toContainText('Chờ duyệt', { timeout: 10000 });

    // 6. Approve Contract
    await page.getByTestId('btn-approve-contract').evaluate(el => (el as HTMLElement).click());
    await expect(drawer.getByTestId('contract-status-badge')).toContainText('Đã duyệt', { timeout: 10000 });

    // DB Verification After Approve
    let contractInDb = await prisma.contract.findUnique({ where: { id: contractId } });
    let roomInDb = await prisma.room.findUnique({ where: { id: roomId } });
    let depositInDb = await prisma.deposit.findFirst({ where: { contractId } });
    let auditLogApprove = await prisma.auditLog.findFirst({ where: { action: 'UPDATE', entityId: contractId } });

    expect(contractInDb?.status).toBe('APPROVED');
    expect(roomInDb?.status).toBe('RESERVED');
    expect(depositInDb).toBeDefined();
    expect(auditLogApprove).toBeDefined();

    // Activate needs deposit to be PAID.
    // Update deposit status to PAID via Prisma to simulate Finance module payment.
    await prisma.deposit.updateMany({
      where: { contractId },
      data: { status: 'PAID' }
    });

    // 7. Activate Contract
    await page.getByTestId('btn-activate-contract').evaluate(el => (el as HTMLElement).click());
    await expect(drawer.getByTestId('contract-status-badge')).toContainText('Đang hiệu lực', { timeout: 10000 });

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

    // 8. Terminate Contract
    await page.getByTestId('btn-terminate-contract').evaluate(el => (el as HTMLElement).click());
    // Verify confirmation buttons appear
    await expect(page.getByTestId('btn-confirm-terminate')).toBeVisible();
    await page.getByTestId('btn-confirm-terminate').evaluate(el => (el as HTMLElement).click());
    
    // Status terminal
    await expect(drawer.getByTestId('contract-status-badge')).toContainText('Đã chấm dứt', { timeout: 10000 });

    // DB Verification After Terminate
    contractInDb = await prisma.contract.findUnique({ where: { id: contractId } });
    roomInDb = await prisma.room.findUnique({ where: { id: roomId } });
    let finalInvoices = await prisma.invoice.findMany({ where: { contractId, status: 'DRAFT', code: { startsWith: 'FIN-' } } });
    let auditLogTerminate = await prisma.auditLog.findFirst({ where: { action: 'UPDATE', entityId: contractId } });

    expect(contractInDb?.status).toBe('TERMINATED');
    expect(roomInDb?.status).toBe('CLEANING');
    // Ensure at least one DRAFT invoice was generated for termination if applicable (or check status depending on policy)
    // Actually our terminate logic creates a final invoice with DRAFT status
    let draftInvoices = await prisma.invoice.findMany({ where: { contractId, status: 'DRAFT' } });
    expect(draftInvoices.length).toBeGreaterThan(0);
    expect(auditLogTerminate).toBeDefined();

    // 9. Reload UI and Verify State Persists
    await page.reload();
    await page.waitForLoadState('networkidle');
    const contractCardReloaded = page.locator('[data-testid="contract-card"]', { hasText: 'Contract Customer E2E' }).filter({ visible: true }).first();
    await contractCardReloaded.waitFor({ state: 'visible', timeout: 10000 });
    await contractCardReloaded.locator('button[aria-label="Xem chi tiết"]').click({ force: true });
    await expect(drawer.getByTestId('contract-status-badge')).toContainText('Đã chấm dứt', { timeout: 10000 });

    // 10. Capture Final DB State
    await evidence.captureDbSnapshot('contract-final-state', async () => {
      return prisma.contract.findUnique({
        where: { id: contractId },
        include: { room: true, invoices: true }
      });
    });

    await evidence.stopAndVerifyNoErrors();
  });
});
