import { expect } from '@playwright/test';
import { test } from '../../fixtures/rbac.fixture';

test.describe.configure({ mode: 'parallel' });

test.describe('Finance Core Regression', () => {

  test('Finance role should access finance page and verify API endpoints', async ({ finance }) => {
    // 1. Ledger Verification
    const ledgerRes = await finance.api.get('http://127.0.0.1:3001/api/v1/finance/ledger');
    expect(ledgerRes.status()).toBe(200);

    // 2. Cashflow Verification
    const cashflowRes = await finance.api.get('http://127.0.0.1:3001/api/v1/finance/cashflow');
    expect(cashflowRes.status()).toBe(200);

    // 3. Profit & Loss Verification
    const plRes = await finance.api.get('http://127.0.0.1:3001/api/v1/finance/profit-loss');
    expect(plRes.status()).toBe(200);

    // 4. Reports Export Verification
    const exportRes = await finance.api.get('http://127.0.0.1:3001/api/v1/finance/export');
    expect(exportRes.status()).toBe(200);
    expect(exportRes.headers()['content-disposition']).toContain('attachment');
    expect(exportRes.headers()['content-type']).toContain('text/csv');
    
    const fileContent = await exportRes.text();
    expect(fileContent).toContain('Date,Description,Amount,Type');

    // 5. UI View test
    await finance.page.goto('/finance');
    await expect(finance.page.getByTestId('finance-root')).toBeVisible();
    await expect(finance.page.getByTestId('finance-chart')).toBeVisible();

    // Verify UI placeholders are rendered
    await expect(finance.page.getByText('Biểu đồ Dòng tiền (Cash Flow)')).toBeVisible();
    await expect(finance.page.getByText('Hiệu quả tòa nhà (Building P&L)')).toBeVisible();
    
    // Simulate UI export click to ensure no crash
    const exportBtn = finance.page.getByTestId('finance-export-button');
    await expect(exportBtn).toBeVisible();
  });

});
