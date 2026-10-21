const { chromium, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const base = process.env.PAYMENT_NOTICE_BASE_URL || 'http://localhost:3015';
  const output = path.resolve(process.env.PAYMENT_NOTICE_OUTPUT || 'test-results/payment-notice-323');
  fs.mkdirSync(output, { recursive: true });
  try {
    for (const width of [1440, 390]) {
      for (const paid of [0, 400000, 1000000]) {
        const context = await browser.newContext({ viewport: { width, height: 1000 } });
        const user = { id: 'fixture', fullName: 'Local Test', roles: ['ADMIN'], permissions: [], mustChangePassword: false };
        await context.addInitScript(user => localStorage.setItem('auth-storage', JSON.stringify({ state: {
          user, isAuthenticated: true, accessToken: 'fixture', refreshToken: 'fixture',
        }, version: 0 })), user);
        const deposit = {
          id: 'booking', code: 'DC-FIXTURE', type: 'BOOKING', amount: 1000000,
          status: paid === 1000000 ? 'PAID' : 'PENDING', availableBalance: paid,
          customer: { id: 'customer', fullName: 'Local Test', phone: '0900000000' },
          room: { id: 'room', code: 'PN 31-02', building: { id: 'building', name: 'LK01-31' } },
          contract: { id: 'contract', code: 'HD-COC-FIXTURE', status: 'DRAFT' },
          bookingInvoice: { id: 'invoice', paidAmount: paid, remainingAmount: 1000000 - paid },
          bookingHold: { status: 'ACTIVE', isActive: true, expiresAt: '2099-11-01T16:59:59Z', requiresRecovery: false, fundedInvalidAggregate: false },
          paymentRequest: { id: 'qr', status: paid === 1000000 ? 'CONFIRMED' : 'PENDING', metadata: {} },
          createdAt: '2026-10-21T02:00:00Z', updatedAt: '2026-10-21T02:00:00Z',
        };
        await context.route('**/api/v1/**', async route => {
          if (route.request().method() !== 'GET' && !route.request().url().endsWith('/auth/activity')) throw new Error('Unexpected mutation: ' + route.request().url());
          const pathname = new URL(route.request().url()).pathname;
          let data = {};
          if (pathname.endsWith('/auth/me')) data = user;
          else if (pathname.endsWith('/auth/security')) data = { idleTimeoutMinutes: 1440 };
          else if (pathname.endsWith('/deposits/booking')) data = deposit;
          else if (pathname.endsWith('/deposits')) data = { items: [deposit], total: 1 };
          else if (pathname.endsWith('/deposits/stats')) data = { kpi: {}, pipeline: [] };
          else if (pathname.endsWith('/buildings')) data = [];
          else if (pathname.includes('/notifications')) data = { items: [], total: 0, unreadCount: 0 };
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) });
        });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(`${base}/deposits`, { waitUntil: 'domcontentloaded', timeout: 120000 });
        try {
          await page.locator('[data-testid="deposit-card"]:visible').first().click({ timeout: 45000 });
        } catch (error) {
          console.error('Fixture state:', page.url(), await page.locator('body').innerText(), errors);
          await page.screenshot({ path: path.join(output, 'fixture-failure.png'), fullPage: true });
          throw error;
        }
        await expect(page.getByText('5. Kiểm tra thời hạn giữ phòng', { exact: true })).toBeVisible();
        await expect(page.getByText(paid === 1000000 ? 'Không cần gửi' : 'Đã tạo QR', { exact: true })).toBeVisible();
        if (paid < 1000000) {
          await expect(page.getByText('Còn hiệu lực', { exact: true })).toHaveCount(0);
          await expect(page.getByTestId('deposit-flow-open-booking-contract')).toHaveCount(0);
        } else {
          await expect(page.getByText('Còn hiệu lực', { exact: true })).toBeVisible();
          await expect(page.getByTestId('deposit-flow-open-booking-contract')).toBeEnabled();
        }
        await page.getByText('6. Chuyển sang hợp đồng thuê dài hạn', { exact: true }).scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(output, `booking-${width}-${paid}.png`), fullPage: true });
        expect(errors).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        console.log(`PASS booking ${width} paid=${paid}: truthful QR, funding and conversion, no page errors/overflow`);
        await context.close();
      }
    }
    const page = await browser.newPage();
    const warnings = [];
    page.on('console', message => { if (message.text().includes('willReadFrequently')) warnings.push(message.text()); });
    await page.goto(`${base}/qr/index.html?embed=true`, { waitUntil: 'load' });
    const attributes = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      for (let i = 0; i < 10; i++) context.getImageData(0, 0, 1, 1);
      return [context.getContextAttributes().willReadFrequently,
        new OffscreenCanvas(1, 1).getContext('2d').getContextAttributes().willReadFrequently];
    });
    expect(attributes).toEqual([true, true]);
    expect(warnings).toEqual([]);
    console.log('PASS actual browser scanner canvas/offscreen readback attributes, no readback warning');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
