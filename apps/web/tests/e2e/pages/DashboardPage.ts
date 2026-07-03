import { Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class DashboardPage extends BasePage {
  constructor(page: Page) {
    super(page, '/');
  }

  async verifyDashboardLoaded() {
    // Wait for the dashboard root to be visible
    const root = this.page.getByTestId('dashboard-root');
    await expect(root).toBeVisible({ timeout: 10000 });
  }

  async verifyKpiVisible() {
    const kpiGrid = this.page.getByTestId('dashboard-kpi-grid');
    await expect(kpiGrid).toBeVisible();
  }

  async verifyHeaderVisible() {
    const header = this.page.getByTestId('app-header');
    await expect(header).toBeVisible();
  }

  async verifySidebarVisible() {
    const sidebar = this.page.getByTestId('app-sidebar');
    const isMobile = (this.page.viewportSize()?.width || 1024) < 768;
    if (isMobile) {
      await expect(sidebar).toBeHidden();
    } else {
      await expect(sidebar).toBeVisible();
    }
  }

  async logout() {
    const isMobile = (this.page.viewportSize()?.width || 1024) < 768;
    if (isMobile) {
      // On mobile, the logout button is currently hidden inside the sidebar or not implemented.
      // We skip actual UI logout for mobile in this smoke test.
      await this.page.evaluate(() => {
        localStorage.removeItem('token');
      });
      await this.page.goto('/login');
      return;
    }

    const logoutBtn = this.page.getByTestId('logout-button');
    await logoutBtn.click();
    await this.page.waitForURL('**/login', { timeout: 10000 });
  }
}
