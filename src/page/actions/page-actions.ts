import { Page, expect as playwrightExpect, test } from '@playwright/test';

type GotoOptions = { referrer?: string; timeout?: number; waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit' };
type ToHaveURLOptions = Parameters<ReturnType<typeof playwrightExpect<Page>>['toHaveURL']>[1];
type ToHaveTitleOptions = Parameters<ReturnType<typeof playwrightExpect<Page>>['toHaveTitle']>[1];
type StepLocation = { file: string; line: number; column: number };

function resolveUrlPattern(
  url: string | undefined,
  constructorName: string,
  urlOrOptions?: string | RegExp | ToHaveURLOptions,
  options?: ToHaveURLOptions
): { targetUrl: string | RegExp; actualOptions: ToHaveURLOptions | undefined } {
  let targetUrl: string | RegExp;
  let actualOptions = options;

  if (urlOrOptions !== undefined && (typeof urlOrOptions === 'string' || urlOrOptions instanceof RegExp)) {
    if (typeof urlOrOptions === 'string') {
      targetUrl = new RegExp('.*' + urlOrOptions.replace('/#', ''));
    } else {
      targetUrl = urlOrOptions;
    }
  } else {
    if (!url) {
      throw new Error(`URL is not defined on ${constructorName}`);
    }
    targetUrl = new RegExp('.*' + url.replace('/#', ''));
    if (typeof urlOrOptions === 'object') {
      actualOptions = urlOrOptions;
    }
  }

  return { targetUrl, actualOptions };
}

/**
 * Navigate to the page URL defined in the page config.
 * Wraps {@link https://playwright.dev/docs/api/class-page#page-goto Page.goto} in a test step.
 */
export async function goto(
  page: Page,
  url: string | undefined,
  constructorName: string,
  options?: GotoOptions,
  location?: StepLocation
): Promise<void> {
  await test.step(`Goto "${url || ''}"`, async () => {
    if (!url) {
      throw new Error(`URL is not defined on ${constructorName}`);
    }
    await page.goto(url, options);
  }, { box: true, location });
}

/**
 * Assert the current URL matches the page config URL or a custom pattern.
 * Uses {@link https://playwright.dev/docs/api/class-pageassertions#page-assertions-to-have-url expect(page).toHaveURL}.
 */
export async function verifyURL(
  page: Page,
  url: string | undefined,
  constructorName: string,
  urlOrOptions?: string | RegExp | ToHaveURLOptions,
  options?: ToHaveURLOptions,
  location?: StepLocation
): Promise<void> {
  const { targetUrl, actualOptions } = resolveUrlPattern(url, constructorName, urlOrOptions, options);
  const stepName = `Verify URL matches "${targetUrl.toString()}"`;
  await test.step(stepName, async () => {
    await playwrightExpect(page).toHaveURL(targetUrl, actualOptions);
  }, { box: true, location });
}

/**
 * Assert the page title matches the expected value.
 * Uses {@link https://playwright.dev/docs/api/class-pageassertions#page-assertions-to-have-title expect(page).toHaveTitle}.
 */
export async function verifyTitle(
  page: Page,
  title: string | RegExp,
  options?: ToHaveTitleOptions,
  location?: StepLocation
): Promise<void> {
  const stepName = `Verify title matches "${title}"`;
  await test.step(stepName, async () => {
    await playwrightExpect(page).toHaveTitle(title, options);
  }, { box: true, location });
}

/**
 * Reload the page.
 * Wraps {@link https://playwright.dev/docs/api/class-page#page-reload Page.reload} in a test step.
 */
export async function reload(
  page: Page,
  options?: Parameters<Page['reload']>[0],
  location?: StepLocation
): Promise<void> {
  await test.step('Reload page', async () => {
    await page.reload(options);
  }, { box: true, location });
}

/**
 * Wait for the page to reach a load state.
 * Wraps {@link https://playwright.dev/docs/api/class-page#page-wait-for-load-state Page.waitForLoadState} in a test step.
 */
export async function waitForLoadState(
  page: Page,
  state?: Parameters<Page['waitForLoadState']>[0],
  options?: Parameters<Page['waitForLoadState']>[1],
  location?: StepLocation
): Promise<void> {
  const stepName = `Wait for load state "${state ?? 'load'}"`;
  await test.step(stepName, async () => {
    await page.waitForLoadState(state, options);
  }, { box: true, location });
}

/**
 * Wait for navigation to a URL. Defaults to the page config URL when no pattern is given.
 * Wraps {@link https://playwright.dev/docs/api/class-page#page-wait-for-url Page.waitForURL} in a test step.
 */
export async function waitForURL(
  page: Page,
  url: string | undefined,
  constructorName: string,
  urlOrOptions?: string | RegExp | Parameters<Page['waitForURL']>[1],
  options?: Parameters<Page['waitForURL']>[1],
  location?: StepLocation
): Promise<void> {
  let targetUrl: string | RegExp;
  let actualOptions = options;

  if (urlOrOptions !== undefined && (typeof urlOrOptions === 'string' || urlOrOptions instanceof RegExp)) {
    targetUrl = urlOrOptions;
  } else {
    if (!url) {
      throw new Error(`URL is not defined on ${constructorName}`);
    }
    targetUrl = url;
    if (typeof urlOrOptions === 'object') {
      actualOptions = urlOrOptions;
    }
  }

  const stepName = `Wait for URL "${targetUrl.toString()}"`;
  await test.step(stepName, async () => {
    await page.waitForURL(targetUrl, actualOptions);
  }, { box: true, location });
}
