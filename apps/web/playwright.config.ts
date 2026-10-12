import { defineConfig, devices } from '@playwright/test';

const requiredE2E = ['E2E_WEB_BASE_URL', 'E2E_API_BASE_URL'];
const missingE2E = requiredE2E.filter((name) => !process.env[name]);
if (missingE2E.length) {
  throw new Error(`E2E configuration missing: ${missingE2E.join(', ')}. Provide staging URLs before running Playwright.`);
}
const webBaseUrl = process.env.E2E_WEB_BASE_URL!;
const apiBaseUrl = process.env.E2E_API_BASE_URL!;
const { admissionStorageState } = require('../../scripts/staging-admission');

export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.VERIFY_PROD ? 1 : (process.env.CI ? 1 : undefined),
    reporter: [
          ['html'],
          ['list'],
        ],
    use: {
          baseURL: webBaseUrl,
          ...admissionStorageState(webBaseUrl),
          trace: 'on',
          video: 'on',
          screenshot: 'on',
          actionTimeout: 15000,
          navigationTimeout: 30000,
    },
    expect: {
      toHaveScreenshot: {
        maxDiffPixelRatio: 0.1,
      },
    },
    ignoreSnapshots: !!process.env.CI,
    // Homeland desktop-only validation baseline: large screens (1920, 1440, 1366).
    projects: [
      {
              name: 'Desktop 1920',
              use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } },
      },
      {
              name: 'Laptop 1440',
              use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
      },
      {
              name: 'Desktop 1366',
              use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 720 } },
      },
    ],
    webServer: process.env.VERIFY_PROD ? undefined : [
      {
              command: 'npm run start',
              url: webBaseUrl,
              reuseExistingServer: !process.env.CI,
              timeout: 120 * 1000,
              stdout: 'pipe',
              stderr: 'pipe',
      },
      {
              command: 'npm run start:prod --workspace=api --prefix ../..',
              url: `${apiBaseUrl}/api/v1/health`,
              reuseExistingServer: !process.env.CI,
              timeout: 120 * 1000,
              stdout: 'pipe',
              stderr: 'pipe',
              env: { THROTTLER_LIMIT: '9999' }
      }
        ],
});
