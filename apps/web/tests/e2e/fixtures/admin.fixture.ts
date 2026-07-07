import { test as base, Page, APIRequestContext, request as pwRequest } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Define the shape of our fixture
type AdminFixture = {
  page: Page;
  api: APIRequestContext;
  token: string;
  user: any;
  permissions: string[];
  tenantId: string;
};

// State file path base
const authFileBase = path.join(__dirname, '../../.auth/admin');

export const test = base.extend<{ admin: AdminFixture }>({
  admin: async ({ browser, request, baseURL }, use) => {
    let page: Page;
    let context;
    let token = '';
    let user = null;

    // State file path for caching login per worker to avoid race conditions
    const workerIndex = process.env.TEST_WORKER_INDEX || '0';
    const authFile = `${authFileBase}-${workerIndex}.json`;
    const finalBaseURL = baseURL || 'http://127.0.0.1:3000';

    // Check if we already have a cached state
    if (fs.existsSync(authFile)) {
      context = await browser.newContext({ storageState: authFile, baseURL: finalBaseURL });
      page = await context.newPage();
      
      // Block SSE to prevent networkidle from hanging due to open EventSource
      await page.route('**/api/v1/notifications/stream*', async (route) => {
        await route.fulfill({ status: 503, headers: { 'x-intentional-error': 'true' } });
      });
      
      // Read token and user from localStorage inside the saved state
      const state = JSON.parse(fs.readFileSync(authFile, 'utf-8'));
      const ls = state.origins?.[0]?.localStorage || [];
      const authStoreString = ls.find((item: any) => item.name === 'auth-storage')?.value;
      
      if (authStoreString) {
        const authStore = JSON.parse(authStoreString);
        token = authStore.state?.accessToken;
        user = authStore.state?.user;
      }
    } else {
      // Not cached, we need to log in via API or UI. 
      // For fixture, API login is faster, but let's just log in via API and save state
      const response = await request.post(`${finalBaseURL}/api/v1/auth/login`, {
        data: {
          emailOrPhone: 'admin@homeland.local',
          password: 'Homeland@123456'
        }
      });
      
      if (!response.ok()) {
        throw new Error('Failed to login Admin fixture');
      }
      
      const responseData = await response.json();
      const authData = responseData.data || responseData;
      token = authData.accessToken;
      user = authData.user;
      
      // Create context with token injected to localStorage
      context = await browser.newContext({ baseURL: finalBaseURL });
      page = await context.newPage();
      
      // Block SSE to prevent networkidle from hanging due to open EventSource
      await page.route('**/api/v1/notifications/stream*', async (route) => {
        await route.fulfill({ status: 503, headers: { 'x-intentional-error': 'true' } });
      });
      
      // Go to base URL so we can set localStorage
      await page.goto('/');
      
      await page.evaluate((data) => {
        const state = {
          state: {
            user: data.user,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken || null,
            isAuthenticated: true,
          },
          version: 0
        };
        localStorage.setItem('auth-storage', JSON.stringify(state));
      }, authData);
      
      // Save state for future tests
      if (!fs.existsSync(path.dirname(authFile))) {
        fs.mkdirSync(path.dirname(authFile), { recursive: true });
      }
      await context.storageState({ path: authFile });
    }

    // Set up API context with token
    const api = await pwRequest.newContext({
      extraHTTPHeaders: {
        'Authorization': `Bearer ${token}`
      }
    });

    const adminFixture: AdminFixture = {
      page,
      api,
      token,
      user,
      permissions: user?.permissions || [],
      tenantId: user?.tenantId || ''
    };

    // Provide the fixture
    await use(adminFixture);

    // Teardown
    await page.close();
    await context.close();
    await api.dispose();
  }
});
