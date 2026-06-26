import { Page, Locator, expect as playwrightExpect, test } from '@playwright/test';
import {
  TypedLocators,
  ProxyLocatorMethods,
  PageKeys,
  ChainedKeys,
  DynamicSelectorEntry
} from './config';
import type { DynamicLocatorEntry } from './locators/dynamic-locator-resolver';
import {
  VerifyOptions,
  VerifyFn,
  AssertionsMethod,
  createVerifyChain
} from './assertions/verify-chain';
import {
  verifyHidden,
  verifyDisabled,
  verifyEnabled
} from './assertions/verify-helpers';
import { typedExpect } from './assertions/expect';
import { goto, verifyURL, verifyTitle, reload, waitForLoadState, waitForURL } from './actions/page-actions';
import { defineActionMethods } from './actions/locator-actions';
import { defineLocators, resolveLocator, locator } from './locators/resolver';
import { getCallerLocation } from './utils/caller-location';

class TypedPageClass<T extends { testIds?: Record<string, string | DynamicLocatorEntry>; selectors?: Record<string, string | DynamicSelectorEntry>; url?: string }> {
  readonly page: Page;
  readonly context: Page | Locator;
  protected readonly config: T;
  readonly url?: string;
  public timeout?: number;

  constructor(context: Page | Locator, config: T, options?: { timeout?: number }) {
    this.context = context;
    this.page = typeof (context as any).page === 'function'
      ? (context as any).page()
      : (context as Page);
    this.config = config;
    this.url = config.url;
    this.timeout = options?.timeout;

    defineLocators(this, this.context, this.config);
    defineActionMethods(this, this.resolveLocator.bind(this), this.timeout);

    // Auto-wrap subclass methods with Playwright test.step
    const builtInMethods = new Set([
      'constructor', 'goto', 'verifyURL', 'verifyTitle', 'reload',
      'waitForLoadState', 'waitForURL', 'resolveLocator', 'locator',
      'verify', 'verifyHidden', 'verifyEnabled', 'verifyDisabled', 'expect'
    ]);

    let proto = Object.getPrototypeOf(this);
    while (proto && proto !== Object.prototype && proto !== TypedPageClass.prototype) {
      const propNames = Object.getOwnPropertyNames(proto);
      for (const prop of propNames) {
        const desc = Object.getOwnPropertyDescriptor(proto, prop);
        if (desc && typeof desc.value === 'function' && !builtInMethods.has(prop) && !prop.startsWith('_')) {
          const originalFn = desc.value;
          Object.defineProperty(this, prop, {
            value: function(this: any, ...args: any[]) {
              const words = prop.split(/(?=[A-Z])/).map(w => w.toLowerCase());
              if (words.length > 0) {
                words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1);
              }
              const sentence = words.join(' ');
              
              const formattedArgs = args.map(arg => {
                if (typeof arg === 'object' && arg !== null) {
                  try {
                    return JSON.stringify(arg);
                  } catch {
                    return String(arg);
                  }
                }
                return String(arg);
              });

              const stepName = formattedArgs.length > 0 
                ? `${sentence} - ${formattedArgs.join(' - ')}`
                : sentence;

              return test.step(stepName, () => {
                return originalFn.apply(this, args);
              });
            },
            writable: true,
            configurable: true,
            enumerable: true
          });
        }
      }
      proto = Object.getPrototypeOf(proto);
    }
  }

  /** Navigate to the URL from page config. */
  async goto(options?: { referrer?: string; timeout?: number; waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit' }): Promise<void> {
    return goto(this.page, this.url, this.constructor.name, options, getCallerLocation());
  }

  /** Assert the current URL matches the page config URL or a custom pattern. */
  async verifyURL(
    urlOrOptions?: string | RegExp | Parameters<ReturnType<typeof playwrightExpect<Page>>['toHaveURL']>[1],
    options?: Parameters<ReturnType<typeof playwrightExpect<Page>>['toHaveURL']>[1]
  ): Promise<void> {
    return verifyURL(this.page, this.url, this.constructor.name, urlOrOptions, options, getCallerLocation());
  }

  /** Assert the page title matches the expected value. */
  async verifyTitle(
    title: string | RegExp,
    options?: Parameters<ReturnType<typeof playwrightExpect<Page>>['toHaveTitle']>[1]
  ): Promise<void> {
    return verifyTitle(this.page, title, options, getCallerLocation());
  }

  /** Reload the current page. */
  async reload(options?: Parameters<Page['reload']>[0]): Promise<void> {
    return reload(this.page, options, getCallerLocation());
  }

  /** Wait for the page to reach a load state. */
  async waitForLoadState(
    state?: Parameters<Page['waitForLoadState']>[0],
    options?: Parameters<Page['waitForLoadState']>[1]
  ): Promise<void> {
    return waitForLoadState(this.page, state, options, getCallerLocation());
  }

  /** Wait for navigation to a URL. Defaults to the page config URL. */
  async waitForURL(
    urlOrOptions?: string | RegExp | Parameters<Page['waitForURL']>[1],
    options?: Parameters<Page['waitForURL']>[1]
  ): Promise<void> {
    return waitForURL(this.page, this.url, this.constructor.name, urlOrOptions, options, getCallerLocation());
  }

  resolveLocator(target: PageKeys<T> | ChainedKeys<T> | Locator, options?: { nth?: number; raw?: boolean; hasText?: string | RegExp }): Locator {
    return resolveLocator(this.context, this.config, target as any, options);
  }

  /** Resolve a config key to a proxied Locator with step-wrapped methods. */
  locator(target: PageKeys<T> | ChainedKeys<T> | Locator, options?: Parameters<Locator['filter']>[0] & { nth?: number }): Locator {
    return locator(this.context, this.config, target as any, options);
  }

  /** Chainable assertions on config keys. Supports `.soft` for soft assertions. */
  get verify(): VerifyFn<T> & { soft: VerifyFn<T> } {
    const fn = (target: any, opts?: VerifyOptions) =>
      createVerifyChain(this.resolveLocator.bind(this) as any, target, opts, false);
    (fn as any).soft = (target: any, opts?: VerifyOptions) =>
      createVerifyChain(this.resolveLocator.bind(this) as any, target, opts, true);
    return fn as any;
  }

  async verifyHidden(target: PageKeys<T> | ChainedKeys<T> | Locator, options?: Parameters<ReturnType<typeof playwrightExpect<Locator>>['toBeHidden']>[0] & { nth?: number; message?: string }): Promise<void> {
    return verifyHidden(this.resolveLocator.bind(this) as any, target as any, options, getCallerLocation());
  }

  async verifyEnabled(target: PageKeys<T> | ChainedKeys<T> | Locator, options?: Parameters<ReturnType<typeof playwrightExpect<Locator>>['toBeEnabled']>[0] & { nth?: number; message?: string }): Promise<void> {
    return verifyEnabled(this.resolveLocator.bind(this) as any, target as any, options, getCallerLocation());
  }

  async verifyDisabled(target: PageKeys<T> | ChainedKeys<T> | Locator, options?: Parameters<ReturnType<typeof playwrightExpect<Locator>>['toBeDisabled']>[0] & { nth?: number; message?: string }): Promise<void> {
    return verifyDisabled(this.resolveLocator.bind(this) as any, target as any, options, getCallerLocation());
  }

  expect(target: PageKeys<T> | ChainedKeys<T> | Locator, message?: string): ReturnType<typeof playwrightExpect<Locator>> {
    const resolved = typeof target !== 'string' ? (target as Locator) : this.resolveLocator(target as any);
    return typedExpect(resolved, message);
  }
}

export type TypedPageType<T extends { testIds?: Record<string, string | DynamicLocatorEntry>; selectors?: Record<string, string | DynamicSelectorEntry>; url?: string }> = TypedPageClass<T> &
  TypedLocators<T> &
  ProxyLocatorMethods<T> &
  AssertionsMethod<T>;

export const TypedPage = TypedPageClass as {
  new <T extends { testIds?: Record<string, string | DynamicLocatorEntry>; selectors?: Record<string, string | DynamicSelectorEntry>; url?: string }>(context: Page | Locator, config: T, options?: { timeout?: number }): TypedPageType<T>;
};

export type TypedPage<T extends { testIds?: Record<string, string | DynamicLocatorEntry>; selectors?: Record<string, string | DynamicSelectorEntry>; url?: string }> = TypedPageType<T>;
