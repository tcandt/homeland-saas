import { Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class LoginPage extends BasePage {
  constructor(page: Page) {
    super(page, '/login');
  }

  async login(email: string, password: string = 'Homeland@123456') {
    await this.goto();
    
    // Fill credentials
    const emailInput = this.page.getByTestId('login-email');
    const passwordInput = this.page.getByTestId('login-password');
    const submitBtn = this.page.getByTestId('login-submit');

    await emailInput.fill(email);
    await passwordInput.fill(password);
    
    // Submit
    await Promise.all([
      this.page.waitForNavigation({ waitUntil: 'networkidle' }),
      submitBtn.click(),
    ]);
  }
}
