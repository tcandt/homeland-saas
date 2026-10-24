const { chromium, expect } = require('@playwright/test');
const fs = require('node:fs');
async function main() {
  const browser = await chromium.launch({ headless: true });
  fs.mkdirSync('test-results/booking-cancellation-324', { recursive: true });
  try {
    for (const width of [1440, 390]) {
      for (const mode of ['NONE', 'PARTIAL', 'FULL']) {
        const context = await browser.newContext({ viewport: { width, height: 1000 } });
        const user = { id: 'fixture', fullName: 'Local Admin', roles: ['ADMIN'], permissions: [], mustChangePassword: false };
        await context.addInitScript(user => localStorage.setItem('auth-storage', JSON.stringify({ state: {
          user, isAuthenticated: true, accessToken: 'fixture', refreshToken: 'fixture',
        }, version: 0 })), user);
        const deposit = { id: 'deposit', type: 'BOOKING', status: 'PAID', amount: 1000000, availableBalance: 800000, rentalCycleId: 'cycle', contractId: 'contract' };
        const contract = {
          id: 'contract', code: 'HD-COC-FIXTURE', status: 'PENDING_APPROVAL', isBookingHold: true,
          customer: { id: 'customer', fullName: 'Local Customer', phone: '0900000000', idImages: [] },
          room: { id: 'room', code: 'PN 31-02', building: { id: 'building', name: 'LK01-31' } },
          startDate: '2026-11-01', endDate: '2026-12-01', monthlyRent: 7000000, depositMoney: 1000000,
          bookingDeposit: deposit, bookingInvoice: { id: 'invoice', paidAmount: 1000000, remainingAmount: 0 },
          rentalCycleId: 'cycle', termsSnapshot: { bookingCommand: { depositId: 'deposit', invoiceId: 'invoice' } },
        };
        const commands = [];
        await context.route('**/api/v1/**', async route => {
          const pathname = new URL(route.request().url()).pathname;
          let data = {};
          if (pathname.endsWith('/commands/cancel')) {
            const payload = route.request().postDataJSON();
            commands.push({ payload, key: route.request().headers()['idempotency-key'] });
            if (mode === 'FULL' && commands.length === 1) {
              await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Simulated retryable failure' }) });
              return;
            }
            contract.status = 'CANCELLED'; deposit.status = 'CANCELLED';
            data = { operationId: 'operation', ...payload, pending: payload.refundAmount > 0 };
          } else {
            if (route.request().method() !== 'GET' && !pathname.endsWith('/auth/activity')) throw new Error('Unexpected mutation ' + pathname);
            if (pathname.endsWith('/auth/me')) data = user;
            else if (pathname.endsWith('/auth/security')) data = { idleTimeoutMinutes: 1440 };
            else if (pathname.endsWith('/contracts/contract')) data = contract;
            else if (pathname.endsWith('/contracts')) data = { items: [contract], total: 1 };
            else if (pathname.endsWith('/deposits/deposit')) data = deposit;
            else if (pathname.includes('notifications')) data = { items: [], total: 0, unreadCount: 0 };
            else if (pathname.includes('buildings') || pathname.includes('history') || pathname.includes('documents')) data = [];
          }
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) });
        });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto('http://localhost:3015/contracts', { waitUntil: 'domcontentloaded', timeout: 120000 });
        await page.getByText('HD-COC-FIXTURE', { exact: true }).filter({ visible: true }).first().click({ timeout: 45000 });
        await page.getByTestId('btn-open-booking-cancel').click();
        const modal = page.getByTestId('booking-hold-cancel-modal');
        await expect(modal).toBeVisible();
        await expect(modal.getByTestId('booking-hold-cancel-submit')).toBeDisabled();
        await modal.getByTestId('booking-cancel-reason').selectOption(mode === 'NONE' ? 'EXPIRED' : 'REFUND_REQUEST');
        await modal.locator('select').nth(1).selectOption(mode);
        if (mode === 'PARTIAL') {
          await modal.getByRole('textbox', { name: 'Số tiền hoàn', exact: true }).fill('800000');
          await modal.getByTestId('booking-hold-cancel-submit').click();
          await page.waitForTimeout(250);
          expect(commands).toHaveLength(0);
          await modal.getByRole('textbox', { name: 'Số tiền hoàn', exact: true }).fill('300000');
        }
        if (mode === 'FULL') {
          await modal.locator('select').nth(2).selectOption('COMPLETED');
          await modal.getByTestId('booking-hold-cancel-submit').click();
          await page.waitForTimeout(250);
          expect(commands).toHaveLength(0);
          await modal.locator('select').nth(2).selectOption('PENDING');
        }
        await page.screenshot({ path: `test-results/booking-cancellation-324/${width}-${mode}.png`, fullPage: true });
        await modal.getByTestId('booking-hold-cancel-submit').click();
        await expect.poll(() => commands.length).toBe(1);
        if (mode === 'FULL') {
          await expect(modal).toBeVisible();
          await modal.getByTestId('booking-hold-cancel-submit').click();
          await expect.poll(() => commands.length).toBe(2);
          expect(commands[1].key).toBe(commands[0].key);
          expect(commands[1].payload).toEqual(commands[0].payload);
        }
        const expected = mode === 'NONE' ? 0 : mode === 'PARTIAL' ? 300000 : 800000;
        const completed = commands.at(-1);
        expect(completed.payload).toMatchObject({ refundAmount: expected, keepAmount: 800000 - expected, deductAmount: 0, refundStatus: 'PENDING' });
        expect(completed.key).toBe(completed.payload.idempotencyKey);
        await expect(modal).toBeHidden();
        const drawer = page.getByTestId('contract-detail-drawer');
        await expect(drawer.getByTestId('contract-status-badge')).toHaveText('Đã hủy');
        await expect(page.getByTestId('contract-group').getByTestId('contract-status-badge')).toHaveText('Đã hủy');
        await expect(drawer.getByTestId('btn-open-booking-cancel')).toHaveCount(0);
        await expect(drawer.getByRole('button', { name: 'Tạo hóa đơn', exact: true })).toHaveCount(0);
        await expect(drawer.getByText(/Còn \d+ ngày/)).toHaveCount(0);
        await expect(drawer.getByText('Chuyển cọc thành công', { exact: true })).toHaveCount(0);
        expect(errors).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        console.log(`PASS ${width} ${mode}: canonical balance, allocation, reason, idempotent command`);
        await context.close();
      }
    }
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
