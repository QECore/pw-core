import { Page } from '@playwright/test';
import { TypedPage, createPageConfig } from '../src/page/index';

export const dashboardConfig = createPageConfig({
  url: 'https://example.com/dashboard',
  testIds: {
    welcome: 'welcome-message',
  },
  selectors: {
    logoutBtn: 'button.logout',
  }
});

export class DashboardPage extends TypedPage<typeof dashboardConfig> {
  constructor(page: Page) {
    super(page, dashboardConfig);
  }

  async logout() {
    await this.click('logoutBtn');
  }
}
