const { chromium, expect } = require('@playwright/test');
const fs = require('node:fs');

async function main() {
  const browser = await chromium.launch({ headless: true });
  fs.mkdirSync('test-results/operational-reset', { recursive: true });
  try {
    for (const width of [1440, 390]) {
      for (const connected of [false, true]) {
        const context = await browser.newContext({ viewport: { width, height: 1000 } });
        const user = { id: 'fixture', fullName: 'Local Admin', roles: ['ADMIN'], permissions: [], mustChangePassword: false };
        await context.addInitScript(user => localStorage.setItem('auth-storage', JSON.stringify({
          state: { user, isAuthenticated: true, accessToken: 'fixture', refreshToken: 'fixture' }, version: 0,
        })), user);
        const calls = [];
        const unexpected = [];
        let backupFails = false;
        await context.route('**/api/v1/**', async route => {
          const request = route.request();
          const pathname = new URL(request.url()).pathname;
          let data = {};
          if (pathname.endsWith('/system-update/backups')) {
            data = { connected, restoreSupported: false, agentVersion: 'fixture', scheduleEnabled: false,
              scheduleCron: '', scheduleDescription: '', lastBackupAt: null, totalBackups: 0,
              storageUsedBytes: 0, backups: [] };
          } else if (pathname.endsWith('/system-update/backups/create')) {
            calls.push('backup');
            if (backupFails) {
              await route.fulfill({ status: 503, contentType: 'application/json',
                body: JSON.stringify({ success: false, message: 'Fixture backup unavailable' }) });
              return;
            }
          } else if (pathname.endsWith('/system-update/wipe-data')) {
            calls.push('wipe');
            expect(request.postDataJSON()).toEqual({ password: 'fixture-password',
              scope: 'ALL_BUSINESS_DATA', confirmPhrase: 'XAC NHAN XOA' });
            data = { success: true, message: 'Fixture reset completed', scope: 'ALL_BUSINESS_DATA',
              deletedCounts: { contracts: 0, customers: 0, invoices: 0, deposits: 0 } };
          } else {
            if (request.method() !== 'GET' && !pathname.endsWith('/auth/activity')) {
              unexpected.push(`${request.method()} ${pathname}`);
              await route.abort();
              return;
            }
            if (pathname.endsWith('/auth/me')) data = user;
            else if (pathname.endsWith('/auth/security')) data = { idleTimeoutMinutes: 1440 };
            else if (pathname.includes('notifications')) data = { items: [], total: 0, unreadCount: 0 };
            else if (pathname.includes('buildings')) data = [];
          }
          await route.fulfill({ status: 200, contentType: 'application/json',
            body: JSON.stringify({ success: true, data }) });
        });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto('http://localhost:3015/settings?section=backup', { waitUntil: 'domcontentloaded', timeout: 120000 });
        await expect(page.getByTestId('settings-backup-safe-state')).toBeVisible({ timeout: 60000 });
        const open = page.getByRole('button', { name: 'Đặt lại dữ liệu vận hành', exact: true });
        const submit = page.getByRole('button', { name: 'Xác nhận đặt lại', exact: true });
        const checkbox = page.getByRole('checkbox', { name: /Tự động tạo bản sao lưu snapshot/ });
        const fill = async () => {
          await page.locator('#wipe-password').fill('fixture-password');
          await page.locator('#wipe-confirm-phrase').fill(' xac nhan xoa ');
        };
        await open.click();
        await expect(submit).toBeDisabled();
        await expect(checkbox).toBeChecked({ checked: connected });
        if (!connected) await expect(checkbox).toBeDisabled();
        await page.locator('#wipe-password').fill('fixture-password');
        await page.locator('#wipe-confirm-phrase').fill('wrong phrase');
        await expect(submit).toBeDisabled();
        await fill();
        await expect(submit).toBeEnabled();
        await page.screenshot({ path: `test-results/operational-reset/${width}-${connected}.png`, fullPage: true });
        await submit.click();
        await expect(submit).toBeHidden();
        expect(calls).toEqual(connected ? ['backup', 'wipe'] : ['wipe']);
        await open.click();
        await expect(page.locator('#wipe-password')).toHaveValue('');
        await expect(page.locator('#wipe-confirm-phrase')).toHaveValue('');
        await fill();
        if (connected) {
          backupFails = true;
          await submit.click();
          await expect(page.getByText('Fixture backup unavailable', { exact: true })).toBeVisible();
          await expect(submit).toBeEnabled();
          expect(calls).toEqual(['backup', 'wipe', 'backup']);
          await checkbox.uncheck();
        }
        await submit.click();
        await expect(submit).toBeHidden();
        expect(calls.filter(call => call === 'wipe')).toHaveLength(2);
        await page.getByRole('button', { name: 'Làm mới dữ liệu', exact: true }).click();
        expect(errors).toEqual([]);
        expect(unexpected).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        console.log(`PASS ${width}, backup connected=${connected}: repeated reset, validation, backup handling, no overflow`);
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
