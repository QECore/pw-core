import { Locator } from '@playwright/test';
import type { PageKeys, ChainedKeys } from '../config';

/**
 * Playwright Locator methods proxied onto the page object.
 * Each method resolves a config key (or Locator) as the first argument.
 *
 * @example
 * ```ts
 * await page.click('submit');
 * await page.fill('username', 'alice', { nth: 1 });
 * ```
 *
 * pw-core adds `nth` to options — targets a specific match when multiple elements resolve.
 */

type ProxyKeys =
  | 'click'
  | 'dblclick'
  | 'hover'
  | 'focus'
  | 'blur'
  | 'check'
  | 'uncheck'
  | 'clear'
  | 'waitFor'
  | 'isChecked'
  | 'isDisabled'
  | 'isVisible'
  | 'textContent'
  | 'innerText'
  | 'allInnerTexts'
  | 'allTextContents'
  | 'count'
  | 'scrollIntoViewIfNeeded'
  | 'boundingBox'
  | 'press'
  | 'pressSequentially'
  | 'selectOption'
  | 'setInputFiles'
  | 'getAttribute';

type ModifyProxyArgs<Args extends any[]> =
  Args extends []
    ? [options?: { nth?: number; hasText?: string | RegExp }]
    : Args extends [any, any?]
      ? [Args[0], (Exclude<Args[1], undefined> & { nth?: number; hasText?: string | RegExp })?]
      : Args extends [any?]
        ? Exclude<Args[0], undefined> extends object
          ? [(Exclude<Args[0], undefined> & { nth?: number; hasText?: string | RegExp })?]
          : [Exclude<Args[0], undefined>, options?: { nth?: number; hasText?: string | RegExp }]
        : [options?: { nth?: number; hasText?: string | RegExp }];

type BaseProxyLocatorMethods<T> = {
  [K in keyof Locator as K extends ProxyKeys ? K : never]: (
    target: PageKeys<T> | ChainedKeys<T> | Locator,
    ...args: ModifyProxyArgs<Parameters<Locator[K]>>
  ) => ReturnType<Locator[K]>;
};

/**
 * Playwright Locator methods proxied onto the page object.
 * Each method resolves a config key (or Locator) as the first argument.
 *
 * @example
 * ```ts
 * await page.click('submit');
 * await page.fill('username', 'alice', { nth: 1 });
 * ```
 *
 * pw-core adds `nth` and `hasText` to options — targets a specific match when multiple elements resolve.
 */
export interface ProxyLocatorMethods<T> extends BaseProxyLocatorMethods<T> {
  /** @see {@link https://playwright.dev/docs/api/class-locator#locator-fill Locator.fill} */
  fill(
    target: PageKeys<T> | ChainedKeys<T> | Locator,
    value: string,
    options?: Parameters<Locator['fill']>[1] & { nth?: number; hasText?: string | RegExp; mask?: boolean }
  ): Promise<void>;

  /** @see {@link https://playwright.dev/docs/api/class-locator#locator-drag-to Locator.dragTo} */
  dragTo(
    target: PageKeys<T> | ChainedKeys<T> | Locator,
    destination: PageKeys<T> | ChainedKeys<T> | Locator,
    options?: Parameters<Locator['dragTo']>[1] & { nth?: number; hasText?: string | RegExp }
  ): Promise<void>;
}
