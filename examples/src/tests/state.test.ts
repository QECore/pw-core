import { scenario } from '@utils/fixtures';

scenario.describe.serial('Worker Page State Reuse Suite', () => {
  // Scenario 1: Setup state inside the workerPage
  scenario('Test 1: Navigate and transition page state on workerPage', async ({ workerLoginPage: lp, workerDashboardPage: dp }) => {
    await lp.goto();
    await lp.waitForLoadState('networkidle');
    await lp.verifyURL();
    await lp.verify('defaultUserLogin');

    // Perform action that transitions page state (Login)
    await lp.click('defaultUserLogin');
    await dp.verifyURL({ timeout: 2000 });
  });

  // Scenario 2: Verify same state persists in a subsequent test in the same worker,
  // without requesting the page-scoped `page` or `loginPage` fixtures at all.
  scenario('Test 2: Verify same page instance and state persist on workerPage', async ({ workerDashboardPage: dp }) => {
    // Verify using workerDashboardPage fixture (which is bound to workerPage)
    await dp.verifyURL();
    await dp.verify('heading');
  });
});
