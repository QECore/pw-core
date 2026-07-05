import { expect } from '@playwright/test';
import { registry as scenario } from '../../pages/registry';

// Recorded on 5 Jul 2026, 4:04:07 PM
scenario.describe.serial('Recorded Serial Suite', () => {
  scenario('3.1. Recorded Test', async ({ workerWorkspace, workerSwagger }) => {
    await workerWorkspace.click('QA-WorkspaceBtn');
    await workerSwagger.click('wsSwagger');
  });

  scenario('3.2. Recorded Test', async ({ workerSwagger }) => {
    await workerSwagger.click('swaggerTabModels');
    await workerSwagger.click('swaggerTabEndpoints');
    await workerSwagger.click('swaggerEndpointGetApiAppActivity');
    await workerSwagger.click('swaggerExecuteGetApiAppActivity');
    await workerSwagger.click('swaggerEndpointGetApiAppProjects');
    await workerSwagger.click('swaggerExecuteGetApiAppProjects');
    await workerSwagger.verify('codeBlockInset');
  });
});
