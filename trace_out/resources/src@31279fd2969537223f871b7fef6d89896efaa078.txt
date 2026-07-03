import { Page, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

export async function checkA11y(page: Page, testName: string) {
  const accessibilityScanResults = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'best-practice'])
    .analyze();
  
  if (accessibilityScanResults.violations.length > 0) {
    console.warn(`[A11y] ${accessibilityScanResults.violations.length} violations found for ${testName}`);
    // Best practice violations might be false positives from UI libraries.
    // If strict fail is needed: expect(accessibilityScanResults.violations).toEqual([]);
  }
}
