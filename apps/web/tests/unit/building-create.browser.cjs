const { chromium, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

async function main() {
  console.log('Launching browser');
  const browser = await chromium.launch({ headless: true, timeout: 15000 });
  const output = path.resolve('test-results/building-create');
  fs.mkdirSync(output, { recursive: true });
  try {
    for (const width of [1440, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const user = { id: 'mock-admin', fullName: 'Test Admin', roles: ['ADMIN'], permissions: [], mustChangePassword: false };
      await context.addInitScript(({ user }) => localStorage.setItem('auth-storage', JSON.stringify({ state: { user, isAuthenticated: true, accessToken: 'mock-only-token', refreshToken: 'mock-only-refresh' }, version: 0 })), { user });
      let buildings = [];
      let created;
      await context.route('**/api/v1/**', async route => {
        const url = new URL(route.request().url());
        let data = {};
        if (url.pathname.endsWith('/auth/me')) data = user;
        else if (url.pathname.endsWith('/auth/security')) data = { idleTimeoutMinutes: 1440, twoFactorEnabled: false };
        else if (url.pathname.endsWith('/buildings')) {
          if (route.request().method() === 'POST') {
            created = route.request().postDataJSON();
            buildings = [{ ...created, id: 'mock-building', images: [], floors: [], rooms: [] }];
            data = buildings[0];
          } else data = buildings;
        } else if (url.pathname.includes('/notifications')) data = { items: [], unreadCount: 0, total: 0 };
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) });
      });
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      console.log(`Opening ${width}`);
      await page.goto('http://localhost:3015/buildings/LK01-31', { waitUntil: 'domcontentloaded', timeout: 120000 });
      console.log(`Loaded ${page.url()}`);
      page.on('pageerror', error => console.log('Page error:', error.message));
      await expect(page.getByText('Chưa có tòa nhà nào.', { exact: true })).toBeVisible({ timeout: 30000 });
      await page.screenshot({ path: path.join(output, `empty-${width}.png`), fullPage: true });
      await page.getByRole('button', { name: 'Thêm tòa nhà', exact: true }).click();
      await page.getByTestId('bname-input').fill('Tòa nhà mới');
      await page.getByTestId('bcode-input').fill('NEW-01');
      await page.getByTestId('baddress-input').fill('Địa chỉ thử nghiệm');
      await page.getByTestId('save-button').click();
      await expect(page).toHaveURL(/\/buildings\/NEW-01$/, { timeout: 30000 });
      await expect(page.getByText('Tòa nhà mới', { exact: true }).first()).toBeVisible();
      expect(created.code).toBe('NEW-01');
      expect(buildings).toHaveLength(1);
      await page.screenshot({ path: path.join(output, `created-${width}.png`), fullPage: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      console.log(`PASS ${width}: empty -> create POST -> new route -> actual building; no horizontal overflow`);
      if (width === 1440) {
        buildings = [
          { ...buildings[0], id: 'dot-code', code: 'A.1', name: 'Dot building' },
          { ...buildings[0], id: 'dash-code', code: 'A-1', name: 'Dash building' },
        ];
        await page.goto('http://localhost:3015/buildings');
        await page.getByRole('button', { name: 'Chỉnh sửa Dash building', exact: true }).click();
        await expect(page.getByTestId('bname-input')).toHaveValue('Dash building');
        await expect(page.getByTestId('bcode-input')).toHaveValue('A-1');
        console.log('PASS normalized-code collision: edit selects exact database ID');
      }
      await context.close();
    }
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
