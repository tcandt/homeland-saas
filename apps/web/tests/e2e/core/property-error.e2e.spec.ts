import { expect } from '@playwright/test';
import { test } from '../fixtures/rbac.fixture';

test.describe('Property Structure Error & Edge Cases', () => {
  test.skip(process.env.RUN_DESTRUCTIVE_E2E !== 'true', 'Set RUN_DESTRUCTIVE_E2E=true only against an isolated disposable database.');
  const testBuildingName = `Error Building ${Date.now()}`;
  const testBuildingCode = `ERR-${Date.now()}`;
  
  test.describe.configure({ mode: 'serial' });

  test('Form validation handles invalid inputs', async ({ admin }) => {
    const page = admin.page;
    
    // Skip on mobile/tablet viewports since building CRUD/Explorer is desktop-only
    const isMobile = page.viewportSize()?.width && page.viewportSize()!.width < 1024;
    if (isMobile) {
      test.skip();
    }
    
    await page.goto('/buildings');
    await page.waitForLoadState('networkidle');

    const addBtn = page.getByTestId('add-building-button').filter({ visible: true }).first();
    await addBtn.click({ force: true });
    await expect(page.getByTestId('bname-input')).toBeVisible();

    // Try to save empty form
    await page.getByTestId('save-button').click({ force: true });

    // Check validation messages
    // Since we use zod resolver, it will show some "Tên tòa nhà không được để trống" or similar
    // We just check if standard browser validation or zod validation shows up
    // Assuming we have toast or inline errors.
    // The easiest is to ensure the modal is still open, meaning save didn't go through
    await expect(page.getByTestId('bname-input')).toBeVisible();
    
    // Fill the form to close it cleanly
    await page.getByTestId('bname-input').fill(testBuildingName);
    await page.getByTestId('bcode-input').fill(testBuildingCode);
    await page.getByTestId('baddress-input').fill('123 Error St');
    await page.getByTestId('save-button').click({ force: true });
    
    await expect(page.locator(`text=${testBuildingName}`).filter({ visible: true }).first()).toBeVisible({ timeout: 10000 });
  });

  test('Delete building with existing floors is rejected', async ({ admin }) => {
    const page = admin.page;
    
    // Skip on mobile/tablet viewports since building CRUD/Explorer is desktop-only
    const isMobile = page.viewportSize()?.width && page.viewportSize()!.width < 1024;
    if (isMobile) {
      test.skip();
    }
    
    const api = admin.api;

    // First get the building ID
    const bReq = await api.get('/api/v1/buildings');
    const bRes = await bReq.json();
    const building = (bRes.data || bRes).find((b: any) => b.name === testBuildingName);
    
    expect(building).toBeDefined();

    // Add a floor to this building via API
    const floorRes = await api.post(`/api/v1/floors`, {
      data: {
        buildingId: building.id,
        level: 1,
        name: 'Tầng 1'
      }
    });
    expect(floorRes.ok()).toBeTruthy();

    // Reload page
    await page.goto('/buildings');
    await page.waitForLoadState('networkidle');

    // Try to delete the building
    await page.locator(`text=${testBuildingName}`).filter({ visible: true }).first().click({ force: true });
    await page.waitForTimeout(500);
    await page.getByTestId('edit-building-button').filter({ visible: true }).first().click({ force: true });
    
    // Setup dialog handler for window.confirm
    page.once('dialog', dialog => dialog.accept());
    
    // Wait for response after delete
    const deleteResPromise = page.waitForResponse(response => 
      response.url().includes(`/api/v1/buildings/${building.id}`) && response.request().method() === 'DELETE'
    );
    
    await page.getByTestId('delete-building-button').filter({ visible: true }).first().click({ force: true });
    
    const response = await deleteResPromise;
    expect(response.status()).toBe(409); // Conflict

    // Building should STILL be visible because delete failed
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    await expect(page.locator(`text=${testBuildingName}`).filter({ visible: true }).first()).toBeVisible({ timeout: 5000 });
  });
});
