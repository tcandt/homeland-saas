import { expect } from '@playwright/test';
import { test } from '../fixtures/admin.fixture';

const routes = [
  '/',
  '/buildings',
  '/tenants',
  '/contracts',
  '/deposits',
  '/invoices',
  '/finance',
  '/finance/expenses',
  '/finance/transactions',
  '/settings',
] as const;

const ignoredConsoleError = (message: string) => (
  message.includes('notifications/stream')
  || message.includes('SSE Error')
  || message.includes('status of 503')
);

test.describe('Production desktop theme audit', () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'Desktop 1920', 'Desktop production audit');
  });

  for (const theme of ['light', 'dark'] as const) {
    test(`renders ten operational routes in ${theme} mode`, async ({ admin }, testInfo) => {
      const consoleErrors: string[] = [];
      const pageErrors: string[] = [];
      admin.page.on('console', (message) => {
        if (message.type() === 'error' && !ignoredConsoleError(message.text())) {
          consoleErrors.push(message.text());
        }
      });
      admin.page.on('pageerror', (error) => pageErrors.push(error.message));

      for (const route of routes) {
        await admin.page.evaluate((nextTheme) => localStorage.setItem('theme', nextTheme), theme);
        await admin.page.goto(route, { waitUntil: 'domcontentloaded' });
        await expect(admin.page.locator('html')).toHaveClass(new RegExp(`(^|\\s)${theme}(\\s|$)`));
        await expect(admin.page.locator('body')).toBeVisible();

        const state = await admin.page.evaluate(() => {
          const bodyStyle = getComputedStyle(document.body);
          return {
            clientWidth: document.documentElement.clientWidth,
            scrollWidth: document.documentElement.scrollWidth,
            backgroundColor: bodyStyle.backgroundColor,
            color: bodyStyle.color,
          };
        });
        expect(state.scrollWidth, `${route} must not overflow the desktop viewport`).toBe(state.clientWidth);
        expect(state.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
        expect(state.color).not.toBe(state.backgroundColor);

        const screenshotName = `${theme}-${route === '/' ? 'dashboard' : route.slice(1).replaceAll('/', '-')}.png`;
        await testInfo.attach(screenshotName, {
          body: await admin.page.screenshot({ fullPage: false }),
          contentType: 'image/png',
        });
      }

      expect(consoleErrors, `Unexpected console errors in ${theme} mode`).toEqual([]);
      expect(pageErrors, `Unexpected page errors in ${theme} mode`).toEqual([]);
    });
  }
});
