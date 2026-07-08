import { expect } from '@playwright/test';
import { test } from '../fixtures/rbac.fixture';
import { EvidenceCollector } from '../helpers/evidence';

// Dataset: PRODUCTION_DATASET v1.0

test.describe('Customer E2E: Create -> Edit -> Delete Lifecycle', () => {
  test.setTimeout(60000);

  test('Full CRUD Flow', async ({ admin }) => {
    const page = admin.page;
    
    const evidence = new EvidenceCollector(page, 'customer-crud');
    await evidence.start();
    
    // Go to tenants/customers explorer
    await page.goto('http://127.0.0.1:3000/tenants');
    await page.waitForLoadState('networkidle');
    
    // ----- CREATE CUSTOMER -----
    const customerName = `Test Customer ${Date.now()}`;
    const customerPhone = `090${Date.now().toString().slice(-7)}`;

    await page.getByTestId('add-tenant-button').locator('visible=true').first().click();
    await page.waitForSelector('[data-testid="tenant-form"]', { state: 'visible' });

    await page.fill('input[data-testid="input-fullName"]', customerName);
    await page.fill('input[data-testid="input-phone"]', customerPhone);
    await page.fill('input[data-testid="input-email"]', 'test@example.com');
    await page.fill('input[data-testid="input-citizenId"]', '012345678901');
    await page.fill('textarea[data-testid="input-notes"]', 'Created by E2E test');

    await page.getByTestId('tenant-form-submit').click();
    
    // Verify toast & form closed
    await page.waitForSelector('[data-testid="tenant-form-drawer"]', { state: 'hidden' });
    await page.waitForLoadState('networkidle');

    // Find the created customer card
    const customerCard = page.getByTestId('tenant-card').filter({ hasText: customerName }).first();
    await customerCard.waitFor({ state: 'attached' });

    // ----- EDIT CUSTOMER -----
    await customerCard.click();
    
    // Drawer opens
    await page.waitForSelector('[data-testid="tenant-detail-drawer"]', { state: 'visible' });
    
    // Click edit
    await page.getByTestId('edit-tenant-button').locator('visible=true').first().click();
    await page.waitForSelector('[data-testid="tenant-form"]', { state: 'visible' });

    const editedName = `${customerName} Edited`;
    await page.fill('input[data-testid="input-fullName"]', editedName);
    await page.getByTestId('tenant-form-submit').click();

    await page.waitForSelector('[data-testid="tenant-form"]', { state: 'hidden' });
    await page.waitForLoadState('networkidle');

    // Close detail drawer
    await page.getByTestId('tenant-detail-close').locator('visible=true').first().click();
    await page.waitForSelector('[data-testid="tenant-detail-drawer"]', { state: 'hidden' });

    // Verify UI reflects the change
    const editedCard = page.getByTestId('tenant-card').filter({ hasText: editedName }).first();
    await editedCard.waitFor({ state: 'attached' });

    // ----- DELETE CUSTOMER -----
    await editedCard.click();
    await page.waitForSelector('[data-testid="tenant-detail-drawer"]', { state: 'visible' });

    // Click delete, handle confirmation
    page.once('dialog', dialog => {
      console.log(`Dialog message: ${dialog.message()}`);
      dialog.accept().catch(() => {});
    });
    
    await page.getByTestId('delete-tenant-button').locator('visible=true').first().click();

    // Verify drawer is closed and toast appeared
    await page.waitForSelector('[data-testid="tenant-detail-drawer"]', { state: 'hidden' });
    await page.waitForLoadState('networkidle');

    // Verify card is gone
    await expect(editedCard).toHaveCount(0);
    
    await evidence.stopAndVerifyNoErrors();
  });
});
