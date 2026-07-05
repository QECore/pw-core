import { expect } from '@playwright/test';
import { registry as scenario } from '../../pages/registry';

// Recorded on 5 Jul 2026, 4:03:29 PM
scenario.describe.serial('Recorded Serial Suite', () => {
  scenario('2.1. Recorded Test', async ({ workerPwCore }) => {
    await workerPwCore.click('features');
    await workerPwCore.page.getByText('Dynamic Locators').click();
    await workerPwCore.page.getByText('Auto Steps').click();
    await workerPwCore.page.getByText('Capabilities').click();
    await workerPwCore.page.getByText('Secret Masking').click();
    await workerPwCore.page.getByText('Table Component').click();
  });

  scenario('2.2. Recorded Test', async ({ workerWorkspace, workerPlayground }) => {
    await workerWorkspace.click('QA-WorkspaceBtn');
    await workerPlayground.click('wsPlayground');
  });

  scenario('2.3. Recorded Test', async ({ workerPlayground }) => {
    await workerPlayground.click('tabTriggerCharts');
    await workerPlayground.click('tabTriggerTables');
    await workerPlayground.fill('otp-input', '');
    await workerPlayground.click('tabTriggerInputs');
    await workerPlayground.click('tabTriggerButtons');
    await workerPlayground.click('tabTriggerCharts');
    await workerPlayground.click('tabTriggerOverlays');
    await workerPlayground.click('tabTriggerAdvanced');
  });
});
