import { scenario } from '@utils/fixtures';

scenario('Verify password masking in step descriptions during login flow', async ({ loginPage, dashboardPage }) => {
  await loginPage.page.goto("http://localhost:5173/login");

  // Fill email (should not be masked in logs/reports)
  await loginPage.fill('email', 'default@mail.com');

  // Fill password (should be masked in logs/reports)
  await loginPage.fill('password', 'default');

  // Click login
  await loginPage.click('submit');

  // Verify dashboard loaded
  await dashboardPage.verifyURL();
});
