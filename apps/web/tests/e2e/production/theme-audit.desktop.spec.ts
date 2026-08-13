import { expect } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';
import { test } from '../fixtures/admin.fixture';

const authenticatedRoutes = [
  '/',
  '/ai',
  '/automation',
  '/buildings',
  '/buildings/LK01-31',
  '/contracts',
  '/deposits',
  '/documents',
  '/finance',
  '/finance/expenses',
  '/finance/transactions',
  '/invoices',
  '/maintenance',
  '/menu',
  '/notifications',
  '/notifications/queue',
  '/reports',
  '/rooms',
  '/sales',
  '/settings',
  '/settings/profile',
  '/tasks',
  '/tenants',
] as const;

const publicRoutes = [
  '/forgot-password',
  '/login',
  '/register',
  '/reset-password',
] as const;

const ignoredConsoleError = (message: string) => (
  message.includes('notifications/stream')
  || message.includes('SSE Error')
  || message.includes('status of 503')
);

const ignoredResponseError = (status: number, url: URL) => (
  status === 503 && url.pathname.endsWith('/api/v1/notifications/stream')
);

const auditRoutes = async (
  page: Page,
  routes: readonly string[],
  theme: 'light' | 'dark',
  testInfo: TestInfo,
) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const responseErrors: string[] = [];
  let activeRoute = routes[0] || '/';

  page.on('console', (message: any) => {
    if (message.type() === 'error' && !ignoredConsoleError(message.text())) {
      consoleErrors.push(`${activeRoute}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error: Error) => pageErrors.push(`${activeRoute}: ${error.message}`));
  page.on('response', (response: any) => {
    const url = new URL(response.url());
    if (response.status() >= 500 && !ignoredResponseError(response.status(), url)) {
      responseErrors.push(`${activeRoute}: ${response.status()} ${url.origin}${url.pathname}`);
    }
  });

  for (const route of routes) {
    activeRoute = route;
    await page.evaluate((nextTheme: string) => localStorage.setItem('theme', nextTheme), theme);
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(new RegExp(`${route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:[?#]|$)`));
    await expect(page.locator('html')).toHaveClass(new RegExp(`(^|\\s)${theme}(\\s|$)`));
    await expect(page.locator('body')).toBeVisible();
    await page.waitForTimeout(250);

    const state = await page.evaluate(() => {
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
      body: await page.screenshot({ fullPage: false }),
      contentType: 'image/png',
    });
  }

  expect(consoleErrors, `Unexpected console errors in ${theme} mode`).toEqual([]);
  expect(pageErrors, `Unexpected page errors in ${theme} mode`).toEqual([]);
  expect(responseErrors, `Unexpected HTTP 5xx responses in ${theme} mode`).toEqual([]);
};

test.describe('Production theme audit', () => {
  test.beforeEach(async ({}, testInfo) => {
    const auditedProjects = ['Desktop 1920', 'Release Mobile 430', 'Release Mobile 390', 'Release Mobile 375'];
    test.skip(!auditedProjects.includes(testInfo.project.name), 'Production route audit');
  });

  for (const theme of ['light', 'dark'] as const) {
    test(`renders all authenticated routes in ${theme} mode`, async ({ admin }, testInfo) => {
      await auditRoutes(admin.page, authenticatedRoutes, theme, testInfo);
    });

    test(`renders all public routes in ${theme} mode`, async ({ page }, testInfo) => {
      await page.goto('/login', { waitUntil: 'domcontentloaded' });
      await auditRoutes(page, publicRoutes, theme, testInfo);
    });

    test(`renders the mandatory password-change route in ${theme} mode`, async ({ admin }, testInfo) => {
      await admin.page.route('**/api/v1/auth/me', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { ...admin.user, mustChangePassword: true } }),
        });
      });
      await admin.page.evaluate(() => {
        const stored = localStorage.getItem('auth-storage');
        if (!stored) throw new Error('Missing authenticated state for password-change audit');
        const parsed = JSON.parse(stored);
        parsed.state.user = { ...parsed.state.user, mustChangePassword: true };
        localStorage.setItem('auth-storage', JSON.stringify(parsed));
      });

      await auditRoutes(admin.page, ['/change-password'], theme, testInfo);
    });
  }
});
