import { registry as test } from '@pages/registry';
import { scenario } from '@utils/fixtures';

// Parallel — each test runs in its own browser instance
test(
  'Verify login and project creation flow on /app',
  async ({ loginPage, dashboardPage, projectsPage, sidebar }) => {
    await loginPage.goto();
    await loginPage.verifyTitle('PW-Core Workspace — Build, Test & Document');
    await loginPage.waitForLoadState('networkidle');

    await loginPage.verify('defaultUserLogin').toBeEnabled();
    await loginPage.click('defaultUserLogin');
    await dashboardPage.verifyURL();
    await dashboardPage.verify('heading');

    await sidebar.click('itemProjects');
    await projectsPage.verifyURL();

    await projectsPage.click('newProject');
    await projectsPage.fill('formTitle', 'Demo Project');
    await projectsPage.fill('formDescription', 'Created via pw-core automation');
    await projectsPage.verifyEnabled('formSave');
    await projectsPage.click('formSave');

    await projectsPage.verify('table', { hasText: 'Demo Project' });
  }
);

// Parallel — uses overridden PlaygroundPage class with custom helpers
scenario(
  'Verify playground inputs using overridden page class helpers',
  async ({ playground }) => {
    await playground.goto();
    await playground.click('tabTriggerInputs');
    await playground.fillInputForm('Hello World', 'secret123', '42');
    await playground.fill('playgroundTextarea', 'This is a test message');
    await playground.fillOtp('654321');
  }
);
