import { test as base, Page, APIRequestContext, request as pwRequest } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Define the shape of our fixture
export type RoleFixture = {
  page: Page;
  api: APIRequestContext;
  token: string;
  user: any;
  permissions: string[];
  tenantId: string;
};

// State file paths
const getAuthFilePath = (role: string) => {
  const workerIndex = process.env.TEST_WORKER_INDEX || '0';
  return path.join(__dirname, `../../.auth/${role}-${workerIndex}.json`);
};

const createRoleFixture = (email: string, roleName: string) => {
  return async ({ browser, request, baseURL }: any, use: any) => {
    let page: Page;
    let context;
    let token = '';
    let user = null;
    const authFile = getAuthFilePath(roleName);
    const finalBaseURL = baseURL || 'http://127.0.0.1:3000';

    if (false) {
      context = await browser.newContext({ storageState: authFile, baseURL: finalBaseURL });
      page = await context.newPage();
      
      // Block SSE to prevent networkidle from hanging due to open EventSource
      await page.route('**/api/v1/notifications/stream*', async (route) => {
        await route.fulfill({ status: 503, headers: { 'x-intentional-error': 'true' } });
      });
      
      const state = JSON.parse(fs.readFileSync(authFile, 'utf-8'));
      const ls = state.origins?.[0]?.localStorage || [];
      const authStoreString = ls.find((item: any) => item.name === 'auth-storage')?.value;
      
      if (authStoreString) {
        const authStore = JSON.parse(authStoreString);
        token = authStore.state?.accessToken;
        user = authStore.state?.user;
      }
    } else {
      const response = await request.post(`${finalBaseURL}/api/v1/auth/login`, {
        data: {
          emailOrPhone: email,
          password: 'Homeland@123456'
        }
      });
      
      if (!response.ok()) {
        const errorText = await response.text();
        throw new Error(`Failed to login fixture for role: ${roleName}. Status: ${response.status()}, Body: ${errorText}`);
      }
      
      const responseData = await response.json();
      const authData = responseData.data || responseData;
      token = authData.accessToken;
      user = authData.user;
      
      context = await browser.newContext({ baseURL: finalBaseURL });
      page = await context.newPage();
      
      // Block SSE to prevent networkidle from hanging due to open EventSource
      await page.route('**/api/v1/notifications/stream*', async (route) => {
        await route.fulfill({ status: 503, headers: { 'x-intentional-error': 'true' } });
      });
      
      await page.goto('/');
      
      await page.evaluate((data: any) => {
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
        localStorage.setItem('token', data.accessToken);
        document.cookie = `token=${data.accessToken}; path=/;`;
      }, authData);
      
      if (!fs.existsSync(path.dirname(authFile))) {
        fs.mkdirSync(path.dirname(authFile), { recursive: true });
      }
      await context.storageState({ path: authFile });
    }

    const api = await pwRequest.newContext({
      extraHTTPHeaders: {
        'Authorization': `Bearer ${token}`
      }
    });

    const fixtureData: RoleFixture = {
      page,
      api,
      token,
      user,
      permissions: user?.permissions || [],
      tenantId: user?.tenantId || ''
    };

    await use(fixtureData);

    await page.close();
    await context.close();
    await api.dispose();
  };
};

export const test = base.extend<{
  admin: RoleFixture;
  ownerAdminA: RoleFixture;
  ownerAdminB: RoleFixture;
  manager: RoleFixture;
  sales: RoleFixture;
  finance: RoleFixture;
}>({
  admin: createRoleFixture('admin@homeland.local', 'admin'),
  ownerAdminA: createRoleFixture('adminA@homeland.local', 'owner-admin-a'),
  ownerAdminB: createRoleFixture('adminB@homeland.local', 'owner-admin-b'),
  manager: createRoleFixture('manager@homeland.local', 'manager'),
  sales: createRoleFixture('sales@homeland.local', 'sales'),
  finance: createRoleFixture('finance@homeland.local', 'finance'),
});
