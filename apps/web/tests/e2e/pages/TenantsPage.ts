import { Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class TenantsPage extends BasePage {
  constructor(page: Page) {
    super(page, '/tenants');
  }

  // Use :visible to avoid strict mode violations due to responsive rendering
  get root() { return this.page.getByTestId('tenants-root').locator(':visible').first(); }
  get kpiGrid() { return this.page.getByTestId('tenants-kpi-grid').locator(':visible').first(); }
  get filterBar() { return this.page.getByTestId('tenants-filter-bar').locator(':visible').first(); }
  get list() { return this.page.getByTestId('tenants-list').locator(':visible').first(); }
  get tenantCards() { return this.page.getByTestId('tenant-card').locator(':visible'); }
  get emptyState() { return this.page.getByTestId('empty-tenants-state').locator(':visible').first(); }
  get errorState() { return this.page.getByTestId('tenants-error-state').locator(':visible').first(); }
  
  get detailDrawer() { return this.page.getByTestId('tenant-detail-drawer').locator(':visible').first(); }
  get detailClose() { return this.page.getByTestId('tenant-detail-close').locator(':visible').first(); }

  async openFirstTenant() {
    await expect(this.tenantCards.first()).toBeVisible();
    
    // Retry clicking until the drawer is visible to handle hydration delays
    await expect(async () => {
      await this.tenantCards.first().dispatchEvent('click');
      await expect(this.detailDrawer).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 10000 });
  }

  async closeTenantDrawer() {
    await this.detailClose.click();
    await expect(this.detailDrawer).toBeHidden();
  }
}
