import { defineConfig, devices } from '@playwright/test';

const webBaseUrl = process.env.E2E_WEB_BASE_URL || 'http://127.0.0.1:3000';
const apiBaseUrl = process.env.E2E_API_BASE_URL || 'http://127.0.0.1:3001';

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
              name: 'Tablet 1024',
              use: { ...devices['iPad (gen 7)'], viewport: { width: 1024, height: 768 } },
      },
      {
              name: 'iPad Mini',
              use: { ...devices['iPad Mini'], viewport: { width: 768, height: 1024 } },
      },
      {
              name: 'Mobile 430',
              use: { ...devices['iPhone 14 Pro Max'], viewport: { width: 430, height: 932 } },
      },
      {
              name: 'Mobile 390',
              use: { ...devices['iPhone 12'], viewport: { width: 390, height: 844 } },
      },
      {
              name: 'Mobile 375',
              use: { ...devices['iPhone 11'], viewport: { width: 375, height: 667 } },
      }
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
