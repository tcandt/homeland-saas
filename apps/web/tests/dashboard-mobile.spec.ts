import { test, expect } from '@playwright/test';

test('Mobile Dashboard Visual Test', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  // Chụp ảnh screenshot baseline để đối chiếu
  await expect(page).toHaveScreenshot('dashboard-mobile-390px.png', {
    maxDiffPixelRatio: 0.1, // Chấp nhận 10% sai lệch
    fullPage: true,
  });
});
