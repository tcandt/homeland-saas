import { expect } from '@playwright/test';
import { test } from '../fixtures/admin.fixture';

const viewports = [
  { name: '1280x720', width: 1280, height: 720 },
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '2560x1440', width: 2560, height: 1440 },
] as const;

const routes = [
  { path: '/buildings', root: '[data-testid="floor-plan-canvas"]' },
  { path: '/contracts', root: '[data-testid="contracts-root"]' },
  { path: '/tenants', root: '[data-testid="tenants-root"]' },
  { path: '/finance/expenses', root: '[data-testid="finance-expenses-root"]' },
  { path: '/invoices', root: '[data-testid="invoices-root"]' },
  { path: '/reports', root: '[data-testid="reports-root"]' },
] as const;

const ignoredConsoleError = (message: string) => (
  message.includes('notifications/stream')
  || message.includes('SSE Error')
  || message.includes('status of 503')
);

test.describe('Production desktop responsive audit', () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'Desktop 1920', 'Production desktop audit');
  });

  for (const theme of ['light', 'dark'] as const) {
    test(`keeps primary desktop workspaces inside the viewport in ${theme} mode`, async ({ admin }, testInfo) => {
      const consoleErrors: string[] = [];
      const pageErrors: string[] = [];

      admin.page.on('console', (message) => {
        if (message.type() === 'error' && !ignoredConsoleError(message.text())) consoleErrors.push(message.text());
      });
      admin.page.on('pageerror', (error) => pageErrors.push(error.message));

      for (const viewport of viewports) {
        await admin.page.setViewportSize({ width: viewport.width, height: viewport.height });

        for (const route of routes) {
          await admin.page.evaluate((nextTheme) => localStorage.setItem('theme', nextTheme), theme);
          await admin.page.goto(route.path, { waitUntil: 'domcontentloaded' });
          await expect(admin.page.locator('html')).toHaveClass(new RegExp(`(^|\\s)${theme}(\\s|$)`));

          const root = admin.page.locator(route.root).first();
          await expect(root).toBeVisible();
          await admin.page.waitForTimeout(250);

          const layout = await admin.page.evaluate((selector) => {
            const element = document.querySelector(selector);
            const rect = element?.getBoundingClientRect();
            return {
              clientWidth: document.documentElement.clientWidth,
              scrollWidth: document.documentElement.scrollWidth,
              rootLeft: rect?.left ?? -1,
              rootRight: rect?.right ?? -1,
              rootWidth: rect?.width ?? 0,
            };
          }, route.root);

          expect(layout.scrollWidth, `${route.path} must not overflow at ${viewport.name}`).toBe(layout.clientWidth);
          expect(layout.rootWidth, `${route.path} root must have width at ${viewport.name}`).toBeGreaterThan(0);
          expect(layout.rootLeft, `${route.path} root must start inside viewport at ${viewport.name}`).toBeGreaterThanOrEqual(-1);
          expect(layout.rootRight, `${route.path} root must end inside viewport at ${viewport.name}`).toBeLessThanOrEqual(viewport.width + 1);

          await testInfo.attach(`${theme}-${viewport.name}-${route.path.slice(1).replaceAll('/', '-')}.png`, {
            body: await admin.page.screenshot({ fullPage: false }),
            contentType: 'image/png',
          });
        }
      }

      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    });
  }
});
