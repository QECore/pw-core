import { expect } from '@playwright/test';
import { createPageRegistry } from '../src/page/index';
import { LoginPage, loginConfig } from './login.page';
import { DashboardPage, dashboardConfig } from './dashboard.page';

// 1. Create registry with the configurations and custom classes
const registry = createPageRegistry({
  login: {
    ...loginConfig,
    Class: LoginPage,
  },
  dashboard: {
    ...dashboardConfig,
    Class: DashboardPage,
  }
});

// 2. Extend the test runner with the POM classes
const test = registry.extend({
  login: LoginPage,
  dashboard: DashboardPage,
});

// 3. Write POM tests
test('Custom POM methods and dynamic properties work correctly', async ({ login, dashboard, page }) => {
  // Mock routes to prevent real network calls and test page interactions
  await page.route('**/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: `
        <form>
          <label data-testid="username-input">testuser<input id="user"/></label>
          <input data-testid="password-input" id="pass" type="password"/>
          <button data-testid="login-button" type="button" onclick="document.querySelector('.error-message').style.display='block'">Log In</button>
          <div class="error-message" style="display:none;">Invalid credentials</div>
        </form>
      `
    });
  });

  await page.route('**/dashboard', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: `
        <div>
          <h1 data-testid="welcome-message">Welcome, User!</h1>
          <button class="logout">Log Out</button>
        </div>
      `
    });
  });

  // Navigate and verify LoginPage
  await login.goto();
  await login.verifyURL();

  // Test dynamic proxy actions inside custom POM method
  await login.login('testuser', 'secret');

  // Navigate to DashboardPage
  await dashboard.goto();
  await dashboard.verifyURL();

  // Test page assertions and dynamic locators
  await dashboard.expect('welcome').toBeVisible();
  await expect(dashboard.welcome).toContainText('Welcome, User!');

  // Test custom POM actions
  await dashboard.logout();
});
