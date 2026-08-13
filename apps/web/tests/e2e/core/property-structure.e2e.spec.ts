import { expect } from '@playwright/test';
import { test } from '../fixtures/rbac.fixture';
import { Page } from '@playwright/test';
import { EvidenceCollector } from '../helpers/evidence';

test.describe('Property Structure E2E: Building -> Floor -> Room Lifecycle', () => {
  test.skip(process.env.RUN_DESTRUCTIVE_E2E !== 'true', 'Set RUN_DESTRUCTIVE_E2E=true only against an isolated disposable database.');
  test.setTimeout(60000);

  test('Full CRUD Flow: Create Building -> Create Floor -> Create Room -> Edit -> Delete -> Reload', async ({ admin }) => {
    const page = admin.page;
    
    // Skip on mobile/tablet viewports since building CRUD/Explorer is desktop-only
    const isMobile = page.viewportSize()?.width && page.viewportSize()!.width < 1024;
    if (isMobile) {
      test.skip();
    }
    
    const evidence = new EvidenceCollector(page, 'property-crud');
    await evidence.start();
    
    // Go to property explorer
    await page.goto('http://127.0.0.1:3000/buildings');
    await page.waitForLoadState('networkidle');
    
    console.log('Current URL:', page.url());
    if (page.url().includes('/login')) {
      console.log('AUTH FAILED - redirected to login');
      // taking a screenshot could help, but log is enough for now
    }
    
    // ----- CREATE BUILDING -----
    const buildingName = `Test Building Structure ${Date.now()}`;
    const buildingCode = `TB-${Date.now().toString().slice(-4)}`;

    await page.getByTestId('add-building-button').filter({ visible: true }).first().click({ force: true });
    await page.fill('input[data-testid="bname-input"]', buildingName);
    await page.fill('input[data-testid="bcode-input"]', buildingCode);
    await page.fill('input[data-testid="baddress-input"]', '123 E2E Street');
    await page.getByTestId('save-button').filter({ visible: true }).first().click({ force: true });

    // Verify UI reflects the change (wait for it to exist instead of strict visible)
    const buildingNode = page.locator('.scrollbar-hide').getByText(buildingName).first();
    await buildingNode.waitFor({ state: 'attached' });
    await page.waitForLoadState('networkidle');

    // Building is auto-selected after creation, wait for Quick Actions / Add Floor button
    await page.waitForSelector('text=Tài chính', { state: 'attached' });

    // ----- CREATE FLOOR -----
    await page.getByTestId('add-floor-button').filter({ visible: true }).first().click({ force: true });
    await page.fill('input[data-testid="floor-name-input"]', '1');
    await page.getByTestId('save-button').filter({ visible: true }).first().click({ force: true });

    // Wait for the FloorView to be loaded (auto-selected after creation)
    await page.waitForTimeout(2000); // give it time to render/refetch
    await page.screenshot({ path: 'floor-created.png' });
    await page.waitForSelector('[data-testid="add-room-button"]', { state: 'attached' });

    // ----- CREATE ROOM -----
    const roomIdStr = Date.now().toString().slice(-6);
    const roomName = `101-${roomIdStr}`;
    
    await page.getByTestId('add-room-button').filter({ visible: true }).first().click({ force: true });
    await page.fill('input[data-testid="room-name-input"]', roomName);
    await page.fill('input[data-testid="room-code-input"]', roomName);
    await page.fill('input[data-testid="room-price-input"]', '8000000');
    await page.fill('input[data-testid="room-capacity-input"]', '4');

    await page.screenshot({ path: 'test-results/before-room-save.png' });
    await page.getByTestId('save-button').filter({ visible: true }).first().click({ force: true });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/after-room-save.png' });
    
    await page.waitForTimeout(3000);
    const htmlContent = await page.content();
    require('fs').writeFileSync('test-results/page-content-before-timeout.html', htmlContent);
    await page.screenshot({ path: 'test-results/screenshot-before-timeout.png', fullPage: true });

    // Verify UI reflects the room
    await expect(page.getByText(`P.${roomName}`).first()).toBeVisible({ timeout: 12000 });

    // ----- DB SNAPSHOT (AFTER CREATE) -----
    await evidence.captureDbSnapshot('db-after-create', async () => {
      return evidence.getPrisma().room.findFirst({
        where: { name: roomName },
        include: { floor: true }
      });
    });

    // ----- VERIFY PERSISTENCE (RELOAD) -----
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Re-select building and floor to see the room
    const treeNode = page.locator(`[data-testid^="building-node-"]`, { hasText: buildingName }).first();
    await treeNode.click();
    
    await page.getByText('Tầng 1').first().click();

    const roomNode = page.getByText(`P.${roomName}`).first();
    await roomNode.waitFor({ state: 'attached' });

    // ----- EDIT ROOM -----
    await page.getByTestId('edit-room-button').first().click({ force: true });
    await page.waitForSelector('text=Thông tin cơ bản phòng', { state: 'visible' });
    
    // Change price
    await page.fill('input[type="number"]', '9000000');
    await page.getByText('Lưu thay đổi').first().click();
    // Wait for the modal to close and state to settle
    await page.waitForTimeout(1000); 

    // Delete Room
    page.once('dialog', dialog => dialog.accept());
    await page.getByTestId('delete-room-button').first().click({ force: true });
    await roomNode.waitFor({ state: 'detached', timeout: 5000 });

    // Delete Floor
    await buildingNode.click({ force: true });
    await page.waitForTimeout(500); // Wait for transition
    const floorNode = page.locator('text=Tầng 1').first();
    page.once('dialog', dialog => dialog.accept());
    await page.getByTestId('delete-floor-button').first().click({ force: true });
    await floorNode.waitFor({ state: 'detached', timeout: 5000 });

    // Delete Building
    await page.getByTestId('edit-building-button').first().click();
    await page.waitForTimeout(500); // Wait for modal
    page.once('dialog', dialog => dialog.accept());
    await page.getByTestId('delete-building-button').first().click({ force: true });
    await buildingNode.waitFor({ state: 'detached', timeout: 5000 });

    // ----- DB SNAPSHOT (AFTER DELETE) -----
    await evidence.captureDbSnapshot('db-after-delete', async () => {
      return evidence.getPrisma().room.findFirst({
        where: { name: roomName }
      });
    });

    await evidence.stopAndVerifyNoErrors();
  });
});
