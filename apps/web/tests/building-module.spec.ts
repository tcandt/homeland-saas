import { test, expect } from '@playwright/test';

const BREAKPOINTS = [
  { name: 'HD-Laptop', width: 1366, height: 768 },
  { name: 'FullHD', width: 1920, height: 1080 },
  { name: 'iPad-Landscape', width: 1024, height: 768 },
  { name: 'iPad-Portrait', width: 768, height: 1024 },
  { name: 'Android-Tablet', width: 800, height: 1280 },
  { name: 'Mobile', width: 390, height: 844 },
];

test.describe('Homeland Building Module Responsive Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to buildings page
    await page.goto('/buildings');
    await page.waitForLoadState('networkidle');
  });

  for (const bp of BREAKPOINTS) {
    test(`Visual test on ${bp.name} (${bp.width}x${bp.height})`, async ({ page }) => {
      // Set viewport
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.waitForTimeout(500);

      // 1. Snapshot Building Dashboard
      await expect(page.locator('body')).toBeVisible();
      await page.screenshot({ path: `tests/building-module.spec.ts-snapshots/dashboard-${bp.name}.png` });

      // 2. Select Floor (Click on Floor 1)
      const floorBtn = page.getByText('Tầng 1').first();
      if (await floorBtn.isVisible()) {
        await floorBtn.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: `tests/building-module.spec.ts-snapshots/floor-${bp.name}.png` });
      }

      // 3. Open Room Details Modal (Click on room P.101 detail button)
      const detailBtn = page.locator('button:has-text("Quản lý"), button:has-text("Chi tiết")').first();
      if (await detailBtn.isVisible()) {
        await detailBtn.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: `tests/building-module.spec.ts-snapshots/room-modal-${bp.name}.png` });
      }
    });
  }
});
