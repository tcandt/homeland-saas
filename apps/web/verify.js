const { chromium } = require('@playwright/test');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Login
  await page.goto('http://localhost:3000/login', { timeout: 60000 });
  await page.waitForSelector('input[type="text"]', { timeout: 60000 });
  await page.fill('input[type="text"]', 'admin@homeland.local');
  if (!process.env.E2E_ADMIN_PASSWORD) throw new Error('E2E_ADMIN_PASSWORD is required');
  await page.fill('input[type="password"]', process.env.E2E_ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000); // Wait for login and redirect

  // Go to deposits
  await page.goto('http://localhost:3000/deposits');
  await page.waitForTimeout(3000); // Wait for data to load

  const viewports = [
    { width: 1920, height: 1080, name: '1920x1080' },
    { width: 1600, height: 900, name: '1600x900' },
    { width: 1440, height: 900, name: '1440x900' },
    { width: 1366, height: 768, name: '1366x768' },
    { width: 430, height: 932, name: '430x932' },
    { width: 390, height: 844, name: '390x844' }
  ];

  if (!fs.existsSync('./screenshots')) {
    fs.mkdirSync('./screenshots');
  }

  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `./screenshots/deposits-${vp.name}.png` });
  }

  // Open drawer
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.click('text=Nguyễn Văn A'); // Try clicking a row (mock or real data)
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `./screenshots/deposits-drawer.png` });

  await browser.close();
  console.log("Screenshots captured successfully!");
})();
