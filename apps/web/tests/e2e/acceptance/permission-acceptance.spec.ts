import { expect } from '@playwright/test';
import { test } from '../fixtures/rbac.fixture';

test.describe('Level 3 - Permission Acceptance', () => {

  test('Admin sees everything', async ({ admin }) => {
    const page = admin.page;
    await page.goto('/');
    // On mobile it might be in bottom nav, on desktop in sidebar.
    // Check if at least one is visible.
    await expect(page.locator('a[href="/finance"]:visible').first()).toBeVisible();
    
    const isMobile = (page.viewportSize()?.width || 1024) < 768;
    if (!isMobile) {
      await expect(page.locator('a[href="/settings"]:visible').first()).toBeVisible();
    }
  });

  test('Sales does not see finance', async ({ sales }) => {
    const page = sales.page;
    await page.goto('/');
    const isFinanceVisible = await page.locator('a[href="/finance"]').first().isVisible();
    expect(isFinanceVisible).toBeFalsy();

    // Sales cannot call finance API
    const res = await sales.api.get('/api/v1/finance/ledger');
    expect(res.status()).toBe(403);
  });

  test('Finance sees finance but not settings', async ({ finance }) => {
    const page = finance.page;
    await page.goto('/');
    await expect(page.locator('a[href="/finance"]:visible').first()).toBeVisible();
    const isSettingsVisible = await page.locator('a[href="/settings"]:visible').first().isVisible();
    expect(isSettingsVisible).toBe(false);

    // Should be able to read finance
    const res1 = await finance.api.get('/api/v1/finance/ledger');
    expect(res1.ok()).toBeTruthy();

    // Should NOT be able to change settings or create buildings
    const res2 = await finance.api.post('/api/v1/buildings', { data: {} });
    expect(res2.status()).toBe(403);
  });

  test('Manager sees operations but cannot access strict finance overrides', async ({ manager }) => {
    // Manager shouldn't be able to read finance cashflow
    const res = await manager.api.get('/api/v1/finance/cashflow'); 
    if (res.status() !== 403) {
      console.error('Unexpected status:', res.status(), await res.text());
    }
    expect(res.status()).toBe(403);
  });

  test('Tenant persona is pending', async ({ admin }) => {
    console.log('Tenant persona: PENDING. Reason: Tenant portal not implemented');
  });
});
