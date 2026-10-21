const { chromium, expect } = require('@playwright/test');
const fs = require('node:fs');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const base = process.env.PAYMENT_NOTICE_BASE_URL || 'http://localhost:3015';
  const output = process.env.PAYMENT_NOTICE_OUTPUT || 'test-results/payment-notice-323';
  fs.mkdirSync(output, { recursive: true });
  try {
    for (const width of [1440, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 1059 } });
      const user = { id: 'fixture', fullName: 'Local Test', roles: ['ADMIN'], permissions: [], mustChangePassword: false };
      await context.addInitScript(user => localStorage.setItem('auth-storage', JSON.stringify({ state: {
        user, isAuthenticated: true, accessToken: 'fixture', refreshToken: 'fixture',
      }, version: 0 })), user);
      const invoice = {
        id: 'invoice', code: 'INV-FIXTURE', status: 'PAID', total: 1000000, subtotal: 1000000,
        paidAmount: 1000000, remainingAmount: 0, createdAt: '2026-10-21T02:00:00Z',
        dueDate: '2026-10-21T02:00:00Z', paidAt: '2026-10-21T02:52:00Z',
        customer: { id: 'customer', fullName: 'Local Test', phone: '0900000000' },
        room: { id: 'room', code: 'PN 31-02', building: { id: 'building', name: 'LK01-31' } },
        items: [{ id: 'item', name: 'Rent', quantity: 1, unitPrice: 1000000, amount: 1000000 }],
        allocations: [{ id: 'allocation', invoiceId: 'invoice', amount: 1000000, payment: {
          id: 'payment', status: 'CONFIRMED', provider: 'MANUAL', providerRef: 'CASH:fixture', amount: 1000000, paidAt: '2026-10-21T02:52:00Z',
        } }],
      };
      await context.route('**/api/v1/**', async route => {
        const pathname = new URL(route.request().url()).pathname;
        if (route.request().method() !== 'GET' && !pathname.endsWith('/auth/activity')) throw new Error('Unexpected mutation: ' + pathname);
        let data = {};
        if (pathname.endsWith('/auth/me')) data = user;
        else if (pathname.endsWith('/auth/security')) data = { idleTimeoutMinutes: 1440 };
        else if (pathname.endsWith('/invoices/invoice')) data = invoice;
        else if (pathname.endsWith('/invoices')) data = { items: [invoice], data: [invoice], total: 1, meta: { hasNextPage: false, nextCursor: null } };
        else if (pathname.includes('payment-promises') || pathname.endsWith('/buildings')) data = [];
        else if (pathname.includes('/deposits')) data = { items: [], total: 0 };
        else if (pathname.includes('/notifications')) data = { items: [], total: 0, unreadCount: 0 };
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) });
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${base}/invoices`, { waitUntil: 'domcontentloaded', timeout: 120000 });
      await page.getByText('INV-FIXTURE', { exact: true }).first().click({ timeout: 45000 });
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      const receipt = dialog.getByText('Đã nhận 1.000.000 đ · Tiền mặt', { exact: true });
      await receipt.scrollIntoViewIfNeeded();
      await expect(receipt).toBeVisible();
      expect(await dialog.evaluate(element => {
        const button = Array.from(element.querySelectorAll('button')).find(item => item.textContent.includes('Tải PDF'));
        const rect = button.getBoundingClientRect();
        return element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
      })).toBe(true);
      expect(errors).toEqual([]);
      await page.screenshot({ path: `${output}/receipt-${width}.png`, fullPage: true });
      console.log(`PASS receipt ${width}: actual cash allocation visible, footer unobstructed`);
      await context.close();
    }
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
