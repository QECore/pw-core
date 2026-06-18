import { scenario as baseScenario } from '@utils/fixtures';
import { Page, Browser, BrowserContext } from '@playwright/test';

type Session = {
  context: BrowserContext;
  page: Page;
} & {
  [K in keyof typeof baseScenario.pages]: InstanceType<(typeof baseScenario.pages)[K]>;
};

// Helper to create an isolated user session with all page objects instantiated
async function createUser(browser: Browser): Promise<Session> {
  const context = await browser.newContext();
  const page = await context.newPage();

  const pages: any = {};
  for (const [key, PageClass] of Object.entries(baseScenario.pages)) {
    pages[key] = new (PageClass as any)(page);
  }

  return {
    context,
    page,
    ...pages
  } as Session;
}

// Extend the imported scenario locally with custom user session fixtures
const scenario = baseScenario.extend<{
  user1: Session;
  user2: Session;
}>({
  user1: async ({ browser }, use) => {
    const session = await createUser(browser);
    await use(session);
    await session.context.close();
  },
  
  user2: async ({ browser }, use) => {
    const session = await createUser(browser);
    await use(session);
    await session.context.close();
  },
});

/**
 * NOTE: This is a simulation of multiple isolated contexts/sessions in a single test,
 * not real multi-user authentication. You can follow this pattern for seamless multi-user flows.
 */
scenario('Verify multi-user concurrent context control', async ({ user1, user2 }) => {
  // Both navigate to login page
  await user1.loginPage.goto();
  await user2.loginPage.goto();

  // User 1 (Admin) logs in
  await user1.loginPage.click('defaultUserLogin');
  await user1.dashboardPage.verifyURL();
  await user1.dashboardPage.verify('heading').toHaveText('Dashboard');

  // User 2 logs in independently
  await user2.loginPage.click('defaultUserLogin');
  await user2.dashboardPage.verifyURL();
  await user2.dashboardPage.verify('heading').toHaveText('Dashboard');
});

