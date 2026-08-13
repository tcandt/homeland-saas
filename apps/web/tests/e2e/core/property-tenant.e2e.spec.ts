import { test, expect, request } from '@playwright/test';

test.describe('Property Structure Tenant Isolation', () => {
  test.skip(process.env.RUN_DESTRUCTIVE_E2E !== 'true', 'Set RUN_DESTRUCTIVE_E2E=true only against an isolated disposable database.');
  const timestamp = Date.now();
  const tenantAEmail = `admin_a_${timestamp}@tenant.com`;
  const tenantBEmail = `admin_b_${timestamp}@tenant.com`;
  const password = 'Homeland@123456';

  let tenantAToken = '';
  let tenantBToken = '';
  let buildingCodeA = `TB-A-${timestamp}`;
  let buildingNameA = `Building Tenant A ${timestamp}`;
  
  test.describe.configure({ mode: 'serial' });

  test('Tenant A creates a building', async ({ browser }) => {
    // 1. Register Tenant A
    const apiContext = await request.newContext({
      baseURL: 'http://127.0.0.1:3001',
    });
    
    const regResA = await apiContext.post('/api/v1/auth/register', {
      data: {
        email: tenantAEmail,
        phone: `09${Math.floor(10000000 + Math.random() * 90000000)}`,
        password,
        fullName: 'Tenant A Admin',
        orgName: `Org A ${timestamp}`
      }
    });
    expect(regResA.ok()).toBeTruthy();
    const dataA = await regResA.json();
    tenantAToken = dataA.data.accessToken;

    // 2. Login as Tenant A in Browser
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    
    // Skip on mobile/tablet viewports since building CRUD/Explorer is desktop-only
    const isMobile = pageA.viewportSize()?.width && pageA.viewportSize()!.width < 1024;
    if (isMobile) {
      await contextA.close();
      test.skip();
    }
    
    pageA.on('console', msg => console.log('TENANT A CONSOLE:', msg.text()));
    pageA.on('pageerror', error => console.log('TENANT A ERROR:', error.message));
    
    // Block SSE
    await pageA.route('**/api/v1/notifications/stream*', async (route) => {
      await route.fulfill({ status: 503, headers: { 'x-intentional-error': 'true' } });
    });

    await pageA.goto('/login');
    await pageA.getByTestId('login-email').fill(tenantAEmail);
    await pageA.getByTestId('login-password').fill(password);
    await pageA.getByTestId('login-submit').click();
    await expect(pageA).toHaveURL(/\/$/, { timeout: 15000 });

    // 3. Create Building
    await pageA.goto('/buildings');
    await pageA.waitForLoadState('networkidle');

    await pageA.getByTestId('add-building-button').filter({ visible: true }).first().click({ force: true });
    await expect(pageA.getByTestId('bname-input')).toBeVisible();
    await pageA.getByTestId('bname-input').fill(buildingNameA);
    await pageA.getByTestId('bcode-input').fill(buildingCodeA);
    await pageA.getByTestId('baddress-input').fill('Tenant A Street');
    await pageA.getByTestId('save-button').click({ force: true });

    // Verify UI
    await expect(pageA.locator(`text=${buildingNameA}`).filter({ visible: true }).first()).toBeVisible({ timeout: 10000 });
    await contextA.close();
  });

  test('Tenant B cannot see Tenant A buildings', async ({ browser }) => {
    // 1. Register Tenant B
    const apiContext = await request.newContext({
      baseURL: 'http://127.0.0.1:3001',
    });
    
    const regResB = await apiContext.post('/api/v1/auth/register', {
      data: {
        email: tenantBEmail,
        phone: `09${Math.floor(10000000 + Math.random() * 90000000)}`,
        password,
        fullName: 'Tenant B Admin',
        orgName: `Org B ${timestamp}`
      }
    });
    expect(regResB.ok()).toBeTruthy();
    const dataB = await regResB.json();
    tenantBToken = dataB.data.accessToken;

    // 2. Login as Tenant B in Browser
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    
    // Skip on mobile/tablet viewports since building CRUD/Explorer is desktop-only
    const isMobile = pageB.viewportSize()?.width && pageB.viewportSize()!.width < 1024;
    if (isMobile) {
      await contextB.close();
      test.skip();
    }
    
    pageB.on('console', msg => console.log('TENANT B CONSOLE:', msg.text()));
    pageB.on('pageerror', error => console.log('TENANT B ERROR:', error.message));
    
    // Block SSE
    await pageB.route('**/api/v1/notifications/stream*', async (route) => {
      await route.fulfill({ status: 503, headers: { 'x-intentional-error': 'true' } });
    });

    await pageB.goto('/login');
    await pageB.getByTestId('login-email').fill(tenantBEmail);
    await pageB.getByTestId('login-password').fill(password);
    await pageB.getByTestId('login-submit').click();
    await expect(pageB).toHaveURL(/\/$/, { timeout: 15000 });

    // 3. Go to buildings and verify Tenant A building is missing
    await pageB.goto('/buildings');
    await pageB.waitForLoadState('networkidle');

    // Expect Tenant A building NOT to be visible
    await expect(pageB.locator(`text=${buildingNameA}`).first()).not.toBeVisible({ timeout: 5000 });

    // Verify via API directly that Tenant B gets empty buildings list
    const getRes = await apiContext.get('/api/v1/buildings', {
      headers: { Authorization: `Bearer ${tenantBToken}` }
    });
    expect(getRes.ok()).toBeTruthy();
    const buildingsList = await getRes.json();
    // Assuming backend returns { data: [...] } or just [...]
    const items = buildingsList.data || buildingsList;
    expect(items.length).toBe(0);

    await contextB.close();
  });
});
