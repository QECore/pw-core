import { Locator, Page } from '@playwright/test';
import type { DynamicLocatorEntry, DynamicTestIdEntry, DynamicSelectorEntry } from './locators/dynamic-locator-resolver.js';

export { ProxyLocatorMethods } from './types/proxy-methods.js';
export type { DynamicLocatorEntry, DynamicTestIdEntry, DynamicSelectorEntry } from './locators/dynamic-locator-resolver.js';

export const zeroArgMethodsList = [
  'click', 'dblclick', 'hover', 'focus', 'blur', 'check', 'uncheck', 'clear',
  'waitFor', 'isChecked', 'isDisabled',
  'isVisible', 'textContent', 'innerText',
  'allInnerTexts', 'allTextContents', 'count',
  'scrollIntoViewIfNeeded', 'boundingBox'
] as const;

export const oneArgMethodsList = [
  'fill', 'press', 'pressSequentially', 'selectOption', 'setInputFiles',
  'getAttribute', 'dragTo'
] as const;

export type AllowedZeroArgMethods = typeof zeroArgMethodsList[number];
export type AllowedOneArgMethods = typeof oneArgMethodsList[number];
export type AllowedMethodKeys = AllowedZeroArgMethods | AllowedOneArgMethods;

import { ValidateDynamicEntryProperties, ExtractPlaceholders, HasDuplicatePlaceholders } from './types/validation.js';

// ─── Dynamic locator type-level expansion ────────────────────────────────────

/**
 * Replaces every `{Name}` placeholder in `Pattern` with `Capitalize<Value>`
 * where `Value` is drawn from the corresponding array in `Entry`.
 * Template-literal unions distribute automatically, producing the full cartesian product.
 */
type ReplacePattern<Pattern extends string, Entry> =
  Pattern extends `${infer Before}{${infer Name}}${infer After}`
    ? Name extends keyof Entry
      ? Entry[Name] extends readonly string[]
        ? `${Before}${Capitalize<Entry[Name][number]>}${ReplacePattern<After, Entry> & string}`
        : never
      : never
    : Pattern;

/**
 * Expands a dynamic key pattern into the union of all concrete (camelCased) keys.
 *
 * @example
 * ```ts
 * type Keys = ExpandDynamicKey<
 *   "{status}{id}Chart",
 *   { status: readonly ['active', 'inactive']; id: readonly ['line', 'bar']; testId: "status-id-chart" }
 * >;
 * // => "activeLineChart" | "activeBarChart" | "inactiveLineChart" | "inactiveBarChart"
 * ```
 */
type ExpandDynamicKey<Pattern extends string, Entry> =
  Uncapitalize<ReplacePattern<Pattern, Entry>>;

/**
 * Resolves every key in a testIds record:
 * - string values → the key itself (static locator)
 * - object values → the expanded dynamic key union
 */
type ResolvedTestIdKeys<I> = {
  [K in keyof I & string]: I[K] extends string
    ? K
    : ExpandDynamicKey<K, I[K]>
}[keyof I & string];

/**
 * Validates all entries in a testIds or selectors record.
 * Static (string) entries pass through. Dynamic entries are checked via ValidateDynamicEntryProperties.
 */
type ValidateTestIds<I, TargetKey extends 'testId' | 'selector'> = {
  [K in keyof I & string]: I[K] extends string
    ? string
    : K extends `${string}{${string}}${string}`
      ? HasDuplicatePlaceholders<K> extends true
        ? "Error: Pattern contains duplicate placeholders"
        : ValidateDynamicEntryProperties<K, I[K], TargetKey>
      : I[K]
};

// ─── Core key types ──────────────────────────────────────────────────────────

export type PageKeys<T> =
  (T extends { testIds?: infer I }
    ? I extends Record<string, any> ? ResolvedTestIdKeys<I> : never
    : never) |
  (T extends { selectors?: infer S }
    ? S extends Record<string, any> ? ResolvedTestIdKeys<S> : never
    : never);

export type TypedLocators<T> = {
  [K in PageKeys<T>]: Locator;
};

export type ChainedKeys<T> = `${PageKeys<T>}.${PageKeys<T>}`;

export type TargetKey<T> = PageKeys<T> | ChainedKeys<T> | Locator;

export type ValidateTarget<K, T> = K extends Locator ? Locator : K extends (PageKeys<T> | ChainedKeys<T>) ? K : never;

export function getOptionsArgumentIndex(methodName: AllowedMethodKeys): number {
  if ((zeroArgMethodsList as readonly string[]).includes(methodName)) return 0;
  if ((oneArgMethodsList as readonly string[]).includes(methodName)) return 1;
  return -1;
}

/** Map type accepted by the `testIds` property in a page config. */
export type TestIdMap = Record<string, string | DynamicTestIdEntry>;

export type SelectorMap = Record<string, string | DynamicSelectorEntry>;

export type PageConfig = {
  url?: string;
  testIds?: TestIdMap;
  selectors?: SelectorMap;
  Class?: new (page: Page, config?: any) => any;
};

export type ValidatePageConfig<T> = {
  url?: string;
  testIds?: T extends { testIds: infer I }
    ? I extends Record<string, any>
      ? ValidateTestIds<I, 'testId'>
      : TestIdMap
    : TestIdMap;
  selectors?: T extends { testIds: infer I; selectors: infer S }
    ? S extends Record<string, any>
      ? {
          [K in keyof S]: K extends keyof I
            ? `Duplicate key: ${K & string} already exists in testIds`
            : ValidateTestIds<S, 'selector'>[K & keyof S & string];
        }
      : SelectorMap
    : SelectorMap;
  Class?: new (page: Page, config?: any) => any;
} & {
  [K in Exclude<keyof T, keyof PageConfig>]: never;
};

/**
 * Creates a strongly-typed page configuration object containing URLs, testIds, and CSS selectors.
 *
 * @example
 * ```ts
 * import { createPageConfig } from 'pw-core/page';
 *
 * const config = createPageConfig({
 *   url: '/login',
 *   testIds: {
 *     username: 'username-input',
 *     password: 'password-input',
 *     submitBtn: 'login-button',
 *   },
 *   selectors: {
 *     errorAlert: '.alert-danger',
 *   }
 * });
 * ```
 */
export function createPageConfig<
  const T extends PageConfig
>(config: [T] extends [ValidatePageConfig<T>] ? T : ValidatePageConfig<T>): T {
  return config as any;
}
