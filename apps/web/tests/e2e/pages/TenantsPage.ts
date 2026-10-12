import { Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class TenantsPage extends BasePage {
  constructor(page: Page) {
    super(page, '/tenants');
  }

  // Scope visibility to the test-id node itself; descendant :visible can match
  // many nested nodes and causes strict-mode failures on responsive layouts.
  get root() { return this.page.locator('[data-testid="tenants-root"]:visible').first(); }
  get kpiGrid() { return this.page.locator('[data-testid="tenants-kpi-grid"]:visible').first(); }
  get filterBar() { return this.page.locator('[data-testid="tenants-filter-bar"]:visible').first(); }
  get list() { return this.page.locator('[data-testid="tenants-list"]:visible').first(); }
  get tenantCards() { return this.page.locator('[data-testid="tenant-card"]:visible'); }
  get emptyState() { return this.page.locator('[data-testid="empty-tenants-state"]:visible').first(); }
  get errorState() { return this.page.locator('[data-testid="tenants-error-state"]:visible').first(); }
  
  get detailDrawer() { return this.page.locator('[data-testid="tenant-detail-drawer"]:visible').first(); }
  get detailClose() { return this.page.locator('[data-testid="tenant-detail-close"]:visible').first(); }

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
