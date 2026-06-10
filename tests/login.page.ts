import { Page } from '@playwright/test';
import { TypedPage, createPageConfig } from '../src/page/index';

export const loginConfig = createPageConfig({
  url: 'https://example.com/login',
  testIds: {
    username: 'username-input',
    password: 'password-input',
    submit: 'login-button',
  },
  selectors: {
    errorMessage: '.error-message',
  }
});

export class LoginPage extends TypedPage<typeof loginConfig> {
  constructor(page: Page) {
    super(page, loginConfig);
  }

  async login(user: string, pass: string) {
    await this.fill('username', user);
    await this.fill('password', pass);
    await this.reload();
    await this.locator('username', { hasText: user }).fill(user);
    await this.click('submit');
    await this.verify('errorMessage')
  }
}
