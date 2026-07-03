import { Page, expect } from '@playwright/test';
import { setupStrictPageValidation } from '../helpers/global-handler';

export class BasePage {
  readonly page: Page;
  readonly path: string;

  constructor(page: Page, path: string) {
    this.page = page;
    this.path = path;
    setupStrictPageValidation(page);
  }

  async goto() {
    await this.page.goto(this.path);
    await this.page.waitForLoadState('networkidle');
  }

  async waitForHydration() {
    // Wait until React has finished hydration. We can do this by checking a stable data-testid
    // or just networkidle.
    await this.page.waitForLoadState('networkidle');
  }
}
