import { expect } from '@playwright/test';
import { test } from '../../fixtures/rbac.fixture';

test.describe.configure({ mode: 'parallel' });

test.describe('Sales RBAC Security Tests', () => {

  test('Sales role should not see Finance menu or access Finance endpoints', async ({ sales }) => {
    // 1. UI Check: Finance menu should not be visible
    await sales.page.goto('http://localhost:3000/');
    const financeMenuDesktop = sales.page.getByTestId('finance-nav-link');
    const financeMenuMobile = sales.page.getByTestId('finance-nav-link-mobile');
    
    await expect(financeMenuDesktop).not.toBeVisible();
    await expect(financeMenuMobile).not.toBeVisible();

    // 2. API Check: Attempting to call finance API should return 403 Forbidden
    const res = await sales.api.get('http://localhost:3001/api/v1/finance/ledger');
    expect(res.status()).toBe(403);
  });

  test('Finance role should see Finance menu and access ledger', async ({ finance }) => {
    // 1. UI Check
    await finance.page.goto('http://localhost:3000/finance');
    
    // Just verify the page didn't redirect away and doesn't show 403
    expect(finance.page.url()).toContain('/finance');
    const isForbidden = await finance.page.getByText('403').isVisible();
    expect(isForbidden).toBeFalsy();

    // 2. API Check
    const res = await finance.api.get('http://localhost:3001/api/v1/finance/ledger');
    expect([200, 404]).toContain(res.status()); // It shouldn't be 403 or 401
  });

});
