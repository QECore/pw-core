import { expect } from '@playwright/test';
import { scenario } from '../pages/fixtures';

const pages = scenario.pages;
const LoginPageClass = pages.loginPage;

scenario('test page-scoped and worker-scoped fixtures', async ({ loginPage, workerLoginPage, page, workerPage }) => {
  expect(loginPage).toBeInstanceOf(LoginPageClass);
  expect(workerLoginPage).toBeInstanceOf(LoginPageClass);

  // Verify same page is used in the page object fixtures
  expect(loginPage.page).toBe(page);
  expect(workerLoginPage.page).toBe(workerPage);

  // Page fixture verification
  await loginPage.goto();
  await loginPage.verifyURL();
  await loginPage.verify('defaultUserLogin').toBeVisible();

  // Worker-scoped fixture verification
  await workerLoginPage.goto();
  await workerLoginPage.verifyURL();
  await workerLoginPage.verify('defaultUserLogin').toBeVisible();
});
