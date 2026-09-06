import test, { Browser, BrowserContext, Page, TestType } from '@playwright/test'
import { PageConfig, ValidatePageConfig } from './config'
import { TypedPage } from './typed-page'
import { buildLookupIndex } from './locators/resolver'

export type PageRegistry = Record<string, PageConfig>

export interface PageConstructor<C extends PageConfig> {
  new (page: Page): TypedPage<C>
}

type RuntimePageClass = new (page: Page) => TypedPage<PageConfig>
type RuntimePageClasses = Record<string, RuntimePageClass>
type FixtureUse<T> = (value: T) => Promise<void>
type PageFixture = (args: { page: Page }, use: FixtureUse<TypedPage<PageConfig>>) => Promise<void>
type WorkerFixture = [
  setup: (args: { workerPage: Page }, use: FixtureUse<TypedPage<PageConfig>>) => Promise<void>,
  options: { scope: 'worker' }
]
type WorkerContextFixture = [
  setup: (args: { browser: Browser }, use: FixtureUse<BrowserContext>) => Promise<void>,
  options: { scope: 'worker' }
]
type WorkerPageFixture = [
  setup: (args: { workerContext: BrowserContext }, use: FixtureUse<Page>) => Promise<void>,
  options: { scope: 'worker' }
]
type RuntimeFixture = PageFixture | WorkerFixture | WorkerContextFixture | WorkerPageFixture
type RuntimeFixtures = Record<string, RuntimeFixture>

// Local runtime key transformation helpers for fixture aliases.
// Intentionally kept local to preserve runtime isolation (page/ does not depend on codegen/).
function toUnprefixedPageKey(key: string): string {
  return key.slice(6).charAt(0).toLowerCase() + key.slice(7)
}

function toWorkerPageKey(key: string): string {
  return key.startsWith('worker') ? key : `worker${key.charAt(0).toUpperCase()}${key.slice(1)}`
}

function getPageKeyAliases(key: string): { pageKey: string; workerKey: string } {
  if (key.startsWith('worker')) {
    const unprefixed = toUnprefixedPageKey(key)
    return { pageKey: unprefixed || key, workerKey: key }
  }
  return { pageKey: key, workerKey: toWorkerPageKey(key) }
}

function createPageFixture(PageClass: RuntimePageClass): PageFixture {
  return async ({ page }, use) => {
    await use(new PageClass(page))
  }
}

function createWorkerFixture(PageClass: RuntimePageClass): WorkerFixture {
  return [
    async ({ workerPage }, use) => {
      await use(new PageClass(workerPage))
    },
    { scope: 'worker' }
  ]
}

function createRegistryFixtures<T extends Record<string, PageConfig>>(
  registry: T,
  classes: RuntimePageClasses
): RuntimeFixtures {
  const fixtures: RuntimeFixtures = {
    workerContext: [
      async ({ browser }: { browser: Browser }, use: FixtureUse<BrowserContext>) => {
        const context = await browser.newContext()
        await use(context)
        await context.close()
      },
      { scope: 'worker' }
    ],
    workerPage: [
      async ({ workerContext }: { workerContext: BrowserContext }, use: FixtureUse<Page>) => {
        await use(await workerContext.newPage())
      },
      { scope: 'worker' }
    ]
  }

  for (const key of Object.keys(registry)) {
    const PageClass = classes[key]
    const { pageKey, workerKey } = getPageKeyAliases(key)
    fixtures[pageKey] = createPageFixture(PageClass)
    fixtures[workerKey] = createWorkerFixture(PageClass)
  }

  return fixtures
}

export type PageRegistryTest<T extends Record<string, PageConfig>, P extends {}, W extends {}, O = {}> = TestType<
  P & {
    [K in keyof T]: K extends keyof O
      ? O[K] extends new (page: Page, ...args: unknown[]) => infer R
        ? R
        : TypedPage<T[K]>
      : TypedPage<T[K]>
  } & {
    [K in keyof T as K extends `worker${infer R}` ? Uncapitalize<R> : never]: K extends keyof O
      ? O[K] extends new (page: Page, ...args: unknown[]) => infer R
        ? R
        : TypedPage<T[K]>
      : TypedPage<T[K]>
  },
  W & {
    [K in keyof T as K extends `worker${string}` ? K : `worker${Capitalize<K & string>}`]: K extends keyof O
      ? O[K] extends new (page: Page, ...args: unknown[]) => infer R
        ? R
        : TypedPage<T[K]>
      : TypedPage<T[K]>
  } & {
    workerPage: Page
  }
> & {
  pages: {
    [K in keyof T]: K extends keyof O ? O[K] : PageConstructor<T[K]>
  } & {
    [K in keyof T as K extends `worker${infer R}` ? Uncapitalize<R> : never]: K extends keyof O ? O[K] : PageConstructor<T[K]>
  } & {
    [K in keyof T as K extends `worker${string}` ? K : `worker${Capitalize<K & string>}`]: K extends keyof O ? O[K] : PageConstructor<T[K]>
  }
  classes: {
    [K in keyof T]: K extends keyof O ? O[K] : PageConstructor<T[K]>
  } & {
    [K in keyof T as K extends `worker${infer R}` ? Uncapitalize<R> : never]: K extends keyof O ? O[K] : PageConstructor<T[K]>
  } & {
    [K in keyof T as K extends `worker${string}` ? K : `worker${Capitalize<K & string>}`]: K extends keyof O ? O[K] : PageConstructor<T[K]>
  }
  extend<
    O2 extends Partial<{
      [K in keyof T]: new (page: Page, ...args: unknown[]) => unknown
    }>,
    CustomP extends {} = typeof test extends TestType<infer DefaultP, infer _DefaultW> ? DefaultP : {},
    CustomW extends {} = typeof test extends TestType<infer _DefaultP, infer DefaultW> ? DefaultW : {}
  >(
    overrides: O2,
    base?: TestType<CustomP, CustomW>
  ): PageRegistryTest<T, CustomP, CustomW, O2>
}

// Local interface for attaching runtime dictionaries to Playwright runner
interface MutableRegistryRunner {
  extend: (...args: unknown[]) => unknown
  pages?: RuntimePageClasses
  classes?: RuntimePageClasses
}

function createPageRegistryWithClasses<
  T extends Record<string, PageConfig>,
  BaseP extends {},
  BaseW extends {}
>(
  registry: T,
  classes: RuntimePageClasses,
  base: TestType<BaseP, BaseW>
): PageRegistryTest<T, BaseP, BaseW> {
  const fixtures = createRegistryFixtures(registry, classes)

  // Copy worker and non-worker aliases in pages and classes dictionaries
  const extendedClasses = { ...classes }
  for (const key of Object.keys(classes)) {
    const { pageKey, workerKey } = getPageKeyAliases(key)
    if (!extendedClasses[pageKey]) {
      extendedClasses[pageKey] = classes[key]
    }
    if (!extendedClasses[workerKey]) {
      extendedClasses[workerKey] = classes[key]
    }
  }

  // Playwright compatibility boundary: extend test runner with fixtures and attach registry dictionaries
  const rawRunner = (base as unknown as { extend: (f: unknown) => MutableRegistryRunner }).extend(fixtures)
  rawRunner.pages = extendedClasses
  rawRunner.classes = extendedClasses

  const originalExtend = rawRunner.extend.bind(rawRunner)
  rawRunner.extend = (overrides?: unknown, customBase: unknown = test) => {
    if (!overrides) {
      return originalExtend()
    }
    const overridesObj = overrides as Record<string, unknown>
    const isPlaywrightFixtures = Object.values(overridesObj).every(
      (val) => (typeof val === 'function' && !val.toString().startsWith('class')) || Array.isArray(val)
    )
    if (isPlaywrightFixtures) {
      const runner = originalExtend(overrides) as MutableRegistryRunner
      runner.pages = extendedClasses
      runner.classes = extendedClasses
      runner.extend = rawRunner.extend
      return runner
    }

    const newClasses = { ...classes }
    for (const key of Object.keys(overridesObj)) {
      if (overridesObj[key]) {
        newClasses[key] = overridesObj[key] as RuntimePageClass
      }
    }
    return createPageRegistryWithClasses(
      registry,
      newClasses,
      (customBase ?? test) as unknown as TestType<BaseP, BaseW>
    )
  }

  return rawRunner as unknown as PageRegistryTest<T, BaseP, BaseW>
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
     codegenPage: {
       url: '/',
       selectors: {
         '{item}': {
           item: ['why-pw-core', 'why-not-playwright', 'registry', 'typed-page', 'features'],
           selector: '[data-parent-id="{item}"]'
         },
         copyToClipboardBtn: '.page',
         dynamicLocators: 'text="Dynamic Locators" >> nth=0',
         rootrailthumbright: '#rootRailThumbRight',
         'text{item}': {
           item: ['Auto Steps', 'Capabilities >> nth=0', 'Secret Masking'],
           selector: 'text="{item}"'
         },
         tshirts: '.title-title',
         tShirts: 'internal:role=link[name="T-Shirts"s]'
       },
       testIds: {
         qaWorkspaceBtn: 'active-workspace-btn',
         wsOptionApp: 'ws-option-app'
       }
     },
     blankPage: {
       url: '/',
       selectors: {
         element: '[data-pw-cursor="pointer"]'
       }
     }
   });
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
export function createPageRegistry<const T extends Record<string, PageConfig>>(
  registry: [T] extends [{ [K in keyof T]: ValidatePageConfig<T[K]> }]
    ? T
    : { [K in keyof T]: ValidatePageConfig<T[K]> }
): typeof test extends TestType<infer P, infer W> ? PageRegistryTest<T, P, W> : never {
  const classes: RuntimePageClasses = {}
  for (const key of Object.keys(registry)) {
    const config = (registry as Record<string, PageConfig>)[key]
    buildLookupIndex(config)
    classes[key] =
      class extends TypedPage<PageConfig> {
        constructor(page: Page) {
          super(page, config)
        }
      }
  }

  return createPageRegistryWithClasses(
    registry as Record<string, PageConfig>,
    classes,
    test
  ) as typeof test extends TestType<infer P, infer W> ? PageRegistryTest<T, P, W> : never
}
