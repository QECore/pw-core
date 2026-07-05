import { expect } from '@playwright/test';
import { registry as scenario } from '../../pages/registry';

// Recorded on 5 Jul 2026, 4:03:15 PM
scenario('1. Recorded Test', async ({ pwCore }) => {
  await pwCore.goto();
  await pwCore.click('why-pw-core');
  await pwCore.click('registry');
  await pwCore.click('typed-page');
});
