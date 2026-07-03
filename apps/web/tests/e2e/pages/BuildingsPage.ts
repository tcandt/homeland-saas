import { Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class BuildingsPage extends BasePage {
  constructor(page: Page) {
    super(page, '/buildings');
  }

  // Locators
  get addBuildingButton() { return this.page.getByTestId('add-building-button').and(this.page.locator(':visible')); }
  get emptyBuildingsState() { return this.page.getByTestId('empty-buildings-state').and(this.page.locator(':visible')); }
  get bnameInput() { return this.page.getByTestId('bname-input'); }
  get baddressInput() { return this.page.getByTestId('baddress-input'); }
  get saveButton() { return this.page.getByTestId('save-button'); }
  
  get editBuildingButton() { return this.page.getByTestId('edit-building-button'); }
  get addFloorButton() { return this.page.getByTestId('add-floor-button'); }

  getBuildingNode(id: string) { return this.page.getByTestId(`building-node-${id}`); }
  getFloorNode(id: string) { return this.page.getByTestId(`floor-node-${id}`); }
  getRoomNode(id: string) { return this.page.getByTestId(`room-node-${id}`); }

  getFloorAccordion(id: string) { return this.page.getByTestId(`floor-accordion-${id}`); }
  getRoomCard(id: string) { return this.page.getByTestId(`room-card-${id}`); }

  async createBuilding(name: string, address: string) {
    await this.addBuildingButton.click();
    await this.bnameInput.fill(name);
    await this.baddressInput.fill(address);
    await this.saveButton.click();
    // Wait for modal to disappear
    await expect(this.saveButton).toBeHidden({ timeout: 5000 });
  }

  async selectBuilding(id: string) {
    await this.getBuildingNode(id).click();
  }
}
