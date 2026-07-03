import { test, expect } from '@playwright/test';

test('Desktop Dashboard Visual Test', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  // Chụp ảnh screenshot baseline để đối chiếu
  await expect(page).toHaveScreenshot('dashboard-desktop-1440px.png', {
    maxDiffPixelRatio: 0.1, // Chấp nhận 10% sai lệch (đạt mục tiêu 90-95%)
    fullPage: true,
  });
});
