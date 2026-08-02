import { expect } from '@playwright/test';
import { test } from '../fixtures/rbac.fixture';

test.describe('Property Structure RBAC', () => {
  const testBuildingName = `RBAC Building ${Date.now()}`;
  const testBuildingCode = `RBAC-${Date.now()}`;

  test.describe.configure({ mode: 'serial' });

  test('Manager can create building', async ({ manager }) => {
    const page = manager.page;
    
    // Skip on mobile/tablet viewports since building CRUD/Explorer is desktop-only
    const isMobile = page.viewportSize()?.width && page.viewportSize()!.width < 1024;
    if (isMobile) {
      test.skip();
    }
    
    await page.goto('/buildings');
    await page.waitForLoadState('networkidle');

    // Manager should see the add button
    const addBtn = page.getByTestId('add-building-button').filter({ visible: true }).first();
    await expect(addBtn).toBeVisible();
    await addBtn.click({ force: true });
    
    // Create building
    await expect(page.getByTestId('bname-input')).toBeVisible();
    await page.getByTestId('bname-input').fill(testBuildingName);
    await page.getByTestId('bcode-input').fill(testBuildingCode);
    await page.getByTestId('baddress-input').fill('123 RBAC St');
    await page.getByTestId('save-button').click({ force: true });

    // Verify created
    await expect(page.locator(`text=${testBuildingName}`).filter({ visible: true }).first()).toBeVisible({ timeout: 10000 });
  });

  test('Sales can view but cannot edit or delete building', async ({ sales }) => {
    const page = sales.page;
    
    // Skip on mobile/tablet viewports since building CRUD/Explorer is desktop-only
    const isMobile = page.viewportSize()?.width && page.viewportSize()!.width < 1024;
    if (isMobile) {
      test.skip();
    }
    
    await page.goto('/buildings');
    await page.waitForLoadState('networkidle');

    // Verify building is visible in tree
    const buildingNode = page.locator(`[data-testid^="building-node-"]`, { hasText: testBuildingName }).first();
    await expect(buildingNode).toBeVisible({ timeout: 10000 });

    const authState = await page.evaluate(() => localStorage.getItem('auth-storage'));
    console.log("AUTH STATE IN PAGE:", authState);

    // Sales should NOT see add button
    await expect(page.getByTestId('add-building-button').first()).not.toBeVisible();

    // Click building to view details in right panel
    await buildingNode.click();
    await expect(page.locator(`h1:has-text("${testBuildingName}")`).first()).toBeVisible({ timeout: 10000 });

    // Sales should NOT see Edit Building or Add Floor buttons in detail view
    const btnCount = await page.getByTestId('edit-building-button').count();
    console.log("BUTTON COUNT:", btnCount);
    if (btnCount > 0) {
      console.log("BUTTON OUTERHTML:", await page.getByTestId('edit-building-button').first().evaluate(node => node.outerHTML));
    }
    await expect(page.getByTestId('edit-building-button').first()).not.toBeVisible();
    await expect(page.getByTestId('add-floor-button').first()).not.toBeVisible();
  });

  test('Manager cannot delete building', async ({ manager }) => {
    const page = manager.page;
    
    // Skip on mobile/tablet viewports since building CRUD/Explorer is desktop-only
    const isMobile = page.viewportSize()?.width && page.viewportSize()!.width < 1024;
    if (isMobile) {
      test.skip();
    }
    
    await page.goto('/buildings');
    await page.waitForLoadState('networkidle');

    // Manager should see the building in tree
    const buildingNode = page.locator(`[data-testid^="building-node-"]`, { hasText: testBuildingName }).first();
    await expect(buildingNode).toBeVisible();

    // Click to view details
    await buildingNode.click();

    // Open edit modal
    await page.getByTestId('edit-building-button').first().click();

    // Manager should NOT see delete button in edit modal
    await expect(page.getByTestId('delete-building-button')).not.toBeVisible();
  });

  test('Admin can delete building', async ({ admin }) => {
    const page = admin.page;
    
    // Skip on mobile/tablet viewports since building CRUD/Explorer is desktop-only
    const isMobile = page.viewportSize()?.width && page.viewportSize()!.width < 1024;
    if (isMobile) {
      test.skip();
    }
    
    await page.goto('/buildings');
    await page.waitForLoadState('networkidle');

    // Admin should see and click building in tree
    const buildingNode = page.locator(`[data-testid^="building-node-"]`, { hasText: testBuildingName }).first();
    await buildingNode.click();
    
    // Open edit modal
    await page.getByTestId('edit-building-button').first().click();
    await expect(page.getByTestId('delete-building-button')).toBeVisible();

    // Accept alert if any
    page.once('dialog', dialog => dialog.accept());

    // Click delete
    await page.getByTestId('delete-building-button').click();

    // Wait for tree to update (building should be gone)
    await expect(buildingNode).not.toBeVisible({ timeout: 10000 });
  });
});
