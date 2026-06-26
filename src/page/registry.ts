import test, { Page, TestType, Browser } from '@playwright/test';
import { PageConfig, ValidatePageConfig } from './config';
import { TypedPage } from './typed-page';

export type PageRegistry = Record<string, PageConfig>;

export interface PageConstructor<C extends PageConfig> {
  new (page: Page): TypedPage<C>;
}

export type PageRegistryTest<
  T extends Record<string, PageConfig>,
  P,
  W,
  O = {}
> = TestType<
  P & {
    [K in keyof T]: K extends keyof O
      ? O[K] extends new (page: Page, ...args: any[]) => infer R
        ? R
        : NonNullable<T[K]['Class']> extends new (page: Page, ...args: any[]) => infer R2
        ? R2
        : TypedPage<T[K]>
      : NonNullable<T[K]['Class']> extends new (page: Page, ...args: any[]) => infer R
      ? R
      : TypedPage<T[K]>;
  },
  W & {
    [K in keyof T as `worker${Capitalize<K & string>}`]: K extends keyof O
      ? O[K] extends new (page: Page, ...args: any[]) => infer R
        ? R
        : NonNullable<T[K]['Class']> extends new (page: Page, ...args: any[]) => infer R2
        ? R2
        : TypedPage<T[K]>
      : NonNullable<T[K]['Class']> extends new (page: Page, ...args: any[]) => infer R
      ? R
      : TypedPage<T[K]>;
  } & {
    workerPage: Page;
  }
> & {
  pages: {
    [K in keyof T]: K extends keyof O
      ? O[K]
      : NonNullable<T[K]['Class']> extends new (page: Page, ...args: any[]) => any
      ? NonNullable<T[K]['Class']>
      : PageConstructor<T[K]>;
  };
  classes: {
    [K in keyof T]: K extends keyof O
      ? O[K]
      : NonNullable<T[K]['Class']> extends new (page: Page, ...args: any[]) => any
      ? NonNullable<T[K]['Class']>
      : PageConstructor<T[K]>;
  };
  extend<
    O2 extends Partial<{
      [K in keyof T]: new (page: Page, ...args: any[]) => any;
    }>,
    B extends TestType<any, any> = typeof test
  >(
    overrides: O2,
    base?: B
  ): B extends TestType<infer BaseP, infer BaseW>
    ? PageRegistryTest<T, BaseP, BaseW, O2>
    : never;
};

function createPageRegistryWithClasses<
  T extends Record<string, PageConfig>,
  B extends TestType<any, any>
>(registry: T, classes: any, base: B): B extends TestType<infer BaseP, infer BaseW> ? PageRegistryTest<T, BaseP, BaseW> : never {
  const fixtures: any = {
    // Shared worker context and page
    workerContext: [async ({ browser }: { browser: Browser }, use: (c: any) => Promise<void>) => {
      const context = await browser.newContext();
      await use(context);
      await context.close();
    }, { scope: 'worker' }],

    workerPage: [async ({ workerContext }: { workerContext: any }, use: (p: Page) => Promise<void>) => {
      const page = await workerContext.newPage();
      await use(page);
    }, { scope: 'worker' }]
  };

  for (const key of Object.keys(registry)) {
    fixtures[key] = async ({ page }: { page: Page }, use: (r: any) => Promise<void>) => {
      const PageClass = classes[key];
      const instance = new PageClass(page);
      await use(instance);
    };

    const workerKey = `worker${key.charAt(0).toUpperCase()}${key.slice(1)}`;
    fixtures[workerKey] = [async ({ workerPage }: { workerPage: Page }, use: (r: any) => Promise<void>) => {
      const PageClass = classes[key];
      const instance = new PageClass(workerPage);
      await use(instance);
    }, { scope: 'worker' }];
  }

  const testRunner = base.extend(fixtures) as any;
  testRunner.pages = classes;
  testRunner.classes = classes;

  const originalExtend = testRunner.extend.bind(testRunner);
  testRunner.extend = (overrides: any, customBase: any = test) => {
    if (!overrides) {
      return originalExtend();
    }
    const isPlaywrightFixtures = Object.values(overrides).every(
      val => (typeof val === 'function' && !val.toString().startsWith('class')) || Array.isArray(val)
    );
    if (isPlaywrightFixtures) {
      return originalExtend(overrides);
    }

    const newClasses = { ...classes };
    for (const key of Object.keys(overrides)) {
      if (overrides[key]) {
        newClasses[key] = overrides[key];
      }
    }
    return createPageRegistryWithClasses(registry, newClasses, customBase);
  };

  return testRunner;
}

/**
 * Creates a page registry that registers page objects as Playwright fixtures,
 * automatically creating both page-scoped fixtures and worker-scoped fixtures prefixed with 'worker'.
 *
 * @example
 * ```ts
 * import { createPageRegistry } from 'pw-core/page';
 * import { LoginPage, config } from './login.page.js';
 *
 * // returns the extended test runner directly
 * const test = createPageRegistry({
 *   login: { ...config, Class: LoginPage },
 * });
 *
 * // returns page classes only when accessing .pages
 * const pages = createPageRegistry({
 *   login: { ...config, Class: LoginPage },
 * }).pages;
 *
 * // In your tests, you can use both the page-scoped and worker-scoped fixtures:
 * test('login flow', async ({ login, workerLogin }) => {
 *   await login.goto();
 *   await login.login('alice', 'secret');
 *
 *   await workerLogin.goto();
 *   await workerLogin.login('bob', 'secret');
 * });
 * ```
 */
export function createPageRegistry<
  const T extends Record<string, PageConfig>
>(registry: [T] extends [{ [K in keyof T]: ValidatePageConfig<T[K]>; }]
  ? T
  : { [K in keyof T]: ValidatePageConfig<T[K]>; }
): typeof test extends TestType<infer P, infer W> ? PageRegistryTest<T, P, W> : never {
  const classes: any = {};
  for (const key of Object.keys(registry)) {
    const config = (registry as Record<string, PageConfig>)[key];
    classes[key] = config.Class || (class extends TypedPage<any> {
      constructor(page: Page) {
        super(page, config);
      }
    });
  }

  return createPageRegistryWithClasses(registry, classes, test) as any;
}

