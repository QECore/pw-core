import { registry as test } from "@pages/registry";

// Serial — all tests run sequentially in one browser, sharing the same worker page
test.describe.serial('Playground Serial Suite', () => {
  test.beforeAll(async ({ workerPlayground }) => {
    await workerPlayground.goto();
  })

  test(
    'Navigate to playground and interact with input elements',
    async ({ workerPlayground }) => {
      await workerPlayground.click('tabTriggerInputs');

      await workerPlayground.fill('playgroundText', 'Serial Input');
      await workerPlayground.fill('playgroundPassword', 'pass123');
      await workerPlayground.fill('playgroundNumber', '99');
      await workerPlayground.fill('playgroundTextarea', 'Worker-scoped textarea content');

      await workerPlayground.click('playgroundSwitch');
      await workerPlayground.check('Accept terms');
    }
  );

  test(
    'Switch to buttons tab and interact with button variants',
    async ({ workerPlayground }) => {
      await workerPlayground.click('tabTriggerButtons');

      await workerPlayground.click('btnVariantDefault');
      await workerPlayground.click('btnVariantSecondary');
      await workerPlayground.click('btnVariantOutline');
      await workerPlayground.click('btnVariantDestructive');

      await workerPlayground.click('toggleAlignCenter');
      await workerPlayground.click('toggleAlignRight');
      await workerPlayground.click('toggleAlignLeft');
    }
  );

  test(
    'Browse remaining tabs on the shared worker page',
    async ({ workerPlayground }) => {
      await workerPlayground.click('tabTriggerTables');
      await workerPlayground.click('tabTriggerCharts');
      await workerPlayground.click('tabTriggerOverlays');
      await workerPlayground.click('tabTriggerAdvanced');
    }
  );
});
