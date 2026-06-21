import { expect } from '@playwright/test';
import { scenario } from '@utils/fixtures';

scenario('Verify advanced locators, actions and assertions in pw-core', async ({
  loginPage,
  dashboardPage,
  projectsPage,
  sidebar
}) => {
  // 1. Navigation and Title Verification
  await loginPage.goto();
  await loginPage.verifyTitle('PW-Core Workspace — Build, Test & Document');
  await loginPage.waitForLoadState('networkidle');

  // 2. Click action using options (hasText)
  // This resolves the locator and filters it by the provided text before clicking
  await loginPage.click('defaultUserLogin', { hasText: /Default/ });
  await dashboardPage.verifyURL();

  // 3. All verify methods (using default visibility checks)
  await dashboardPage.verify('heading'); // Inbuilt visibility check
  await loginPage.verifyHidden('defaultUserLogin'); // verifyHidden asserts that the element is hidden

  // Navigate to Projects Page
  await sidebar.click('itemProjects');
  await projectsPage.verifyURL();
  await projectsPage.verifyEnabled('newProject'); // verifyEnabled asserts element is enabled

  // 4. Action click/fill using options (nth)
  await projectsPage.click('newProject', { nth: 0 });
  await projectsPage.fill('formTitle', 'Form Title Nth Test', { nth: 0 });
  await projectsPage.fill('formDescription', 'Form Description Nth Test', { nth: 0 });

  // Verify disabled state using verifyEnabled
  await projectsPage.verifyEnabled('formSave');
  await projectsPage.click('formSave');

  // 5. Locator chaining on typed Page objects
  // Resolves the parent 'table' locator and chains standard Playwright locator methods on it
  const projectTableRows = projectsPage.locator('table').locator('tbody tr').first();
  await expect(projectTableRows).toBeVisible();
});
