const { chromium, expect } = require('@playwright/test');
const path = require('node:path');
const fs = require('node:fs');
const base = process.argv[2] || 'http://localhost:3017';
async function main() {
  const browser = await chromium.launch({ headless: true });
  const output = path.resolve(__dirname, 'audit');
  fs.mkdirSync(output, { recursive: true });
  try {
    const login = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    await login.goto(`${base}/login`, { waitUntil: 'networkidle', timeout: 120000 });
    await expect(login.getByText('v3.2.2', { exact: true })).toBeVisible();
    await login.screenshot({ path: path.join(output, 'login-321.png'), fullPage: true });
    console.log(JSON.stringify({ origin: base, hydratedLoginVersion: '3.2.2' }));
    await login.close();
    for (const width of [1440, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 960 } });
      const user = { id: 'mock-admin', fullName: 'Test Admin', roles: ['ADMIN'], permissions: [], mustChangePassword: false };
      await context.addInitScript(user => localStorage.setItem('auth-storage', JSON.stringify({
        state: { user, isAuthenticated: true, accessToken: 'test-only', refreshToken: 'test-only' }, version: 0,
      })), user);
      const room = { id: 'test-room', floorId: 'test-floor', buildingId: 'test-building', code: 'PN 31-01',
        name: 'PN 31-01', rentalType: 'WHOLE', status: 'AVAILABLE', monthlyPrice: 3000000, capacity: 2, contracts: [], occupancies: [] };
      const building = { id: 'test-building', code: 'LK01.31', name: 'LK01.31', images: [],
        floors: [{ id: 'test-floor', level: 1, name: 'Floor 1', rooms: [room] }], rooms: [room] };
      const customer = { id: 'test-customer', fullName: 'Legacy Test Customer', phone: '0901234567',
        roomId: null, contracts: [], occupancies: [], idImages: [], idImageProvenance: [] };
      const imports = [];
      await context.route('**/api/v1/**', async route => {
        const pathname = new URL(route.request().url()).pathname;
        let data = [];
        if (pathname.endsWith('/contracts/import-existing')) {
          const command = route.request().postDataJSON();
          imports.push(command);
          expect(route.request().headers()['idempotency-key']).toBe(command.idempotencyKey);
          data = { contract: { id: 'test-contract', code: command.contractCode, status: 'ACTIVE' },
            paidThrough: command.paidThrough, missingDocuments: ['CCCD_FRONT', 'CCCD_BACK', 'CONTRACT_FILE'] };
        }
        else if (pathname.endsWith('/auth/me')) data = user;
        else if (pathname.endsWith('/auth/security')) data = { idleTimeoutMinutes: 1440 };
        else if (pathname.endsWith('/buildings')) data = [building];
        else if (pathname.includes('/buildings/')) data = building;
        else if (pathname.endsWith('/rooms/test-room')) data = room;
        else if (pathname.endsWith('/rooms')) data = [room];
        else if (pathname.endsWith('/customers')) data = { data: [customer], total: 1 };
        else if (pathname.endsWith('/customers/test-customer')) data = customer;
        else if (pathname.includes('notifications')) data = { items: [], unreadCount: 0, total: 0 };
        else if (pathname.includes('finance-summary')) data = { totals: {}, cycles: [], items: [] };
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) });
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.stack));
      await page.goto(`${base}/buildings/LK01-31`, { waitUntil: 'networkidle', timeout: 120000 });
      await page.waitForTimeout(1000);
      if (width < 600) {
        await page.getByText('LK01-31', { exact: true }).last().click();
        await page.getByText('Tầng 1', { exact: true }).click();
        await page.getByText('P.31-01', { exact: true }).click();
      } else {
        await page.getByRole('button', { name: 'Mở Tầng trệt', exact: true }).click();
        await page.getByRole('row').filter({ hasText: '31-01' }).click();
        await page.getByRole('button', { name: 'Mở hồ sơ phòng', exact: true }).click();
      }
      await page.getByRole('button', { name: /Khách thuê/ }).last().click();
      await page.getByRole('button', { name: 'Thêm khách thuê', exact: true }).click();
      await expect(page.getByRole('button').filter({ hasText: 'Cập nhật khách hàng cũ' })).toBeVisible();
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(output, `buildings-${width}.png`), fullPage: true });
      await page.getByRole('button').filter({ hasText: 'Cập nhật khách hàng cũ' }).click();
      await page.getByTestId('tenant-source-existing').click();
      await page.getByTestId('existing-tenant-test-customer').click();
      await page.getByRole('button', { name: 'Tiếp tục đồng bộ', exact: true }).click();
      await expect(page.getByText('Ngày bắt đầu thực tế *', { exact: true })).toBeVisible();
      await expect(page.getByText('Đã thanh toán hết tháng *', { exact: true })).toBeVisible();
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(output, `legacy-form-${width}.png`), fullPage: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const field = label => page.getByText(label, { exact: true }).locator('..').locator('input');
      await field('Giá thuê (VNĐ/tháng) *').fill('3000000');
      await field('Tiền cọc đang giữ (VNĐ) *').fill('6000000');
      await field('Ngày bắt đầu thực tế *').fill('01/01/2026');
      await page.getByRole('button', { name: 'Đồng bộ khách cũ', exact: true }).click();
      await expect.poll(() => imports.length).toBe(1);
      expect(imports[0]).toMatchObject({ customerId: customer.id, roomId: room.id, rentAmount: 3000000,
        depositAmount: 6000000, startDate: '2026-01-01' });
      console.log(JSON.stringify({ width, errors, legacyCard: true, legacyForm: true, importCommand: true, overflow: false }));
      expect(errors).toEqual([]);
      await context.close();
    }
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
