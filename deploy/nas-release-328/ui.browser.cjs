const { chromium, expect } = require('@playwright/test');
const fs = require('node:fs');
const base = process.argv[2] || 'https://homeland.ductinh.one';
async function main() {
  const browser = await chromium.launch({ headless: true });
  fs.mkdirSync('deploy/nas-release-328/audit', { recursive: true });
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 960 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${base}/login`, { waitUntil: 'networkidle', timeout: 120000 });
      await expect(page.getByText('v3.2.8', { exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(errors).toEqual([]);
      await page.screenshot({ path: `deploy/nas-release-328/audit/login-${width}.png`, fullPage: true });
      console.log(JSON.stringify({ width, version: '3.2.8', pageErrors: 0, overflow: false }));
      await page.close();
    }
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
