import { expect } from '@playwright/test';
import { test } from '../../fixtures/rbac.fixture';

test.describe('Finance core contract', () => {
  test('finance role can load current settlement and export drawer', async ({ finance }) => {
    const ledger = await finance.api.get('/api/v1/finance/ledger');
    expect(ledger.status()).toBe(200);
    const exportRes = await finance.api.get('/api/v1/finance/export');
    expect(exportRes.status()).toBe(200);
    expect(exportRes.headers()['content-disposition']).toContain('attachment');
    expect(exportRes.headers()['content-type']).toContain('text/csv');
    const csv = await exportRes.text();
    expect(csv.split(/\r?\n/, 1)[0]).toBe('Date,JournalCode,Description,AccountCode,AccountName,Type,Amount,SourceType,Status');
    await finance.page.goto('/finance', { waitUntil: 'domcontentloaded' });
    await expect(finance.page.getByTestId('finance-root')).toBeVisible();
    await expect(finance.page.getByText('Dòng Tiền Quyết Toán Hợp Nhất 4 Tòa', { exact: false })).toBeVisible();
    await expect(finance.page.getByText('Kỳ báo cáo:', { exact: false })).toBeVisible();
    const exportBtn = finance.page.getByTestId('finance-export-button');
    await expect(exportBtn).toBeVisible();
    await exportBtn.click();
    await expect(finance.page.getByRole('dialog', { name: 'Xuất báo cáo tài chính' })).toBeVisible();
    await expect(finance.page.getByTestId('finance-export-excel-button')).toBeVisible();
    await expect(finance.page.getByTestId('finance-export-pdf-button')).toBeVisible();
  });
});
