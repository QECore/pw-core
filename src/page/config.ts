import { Locator, Page } from '@playwright/test'
import type {
  DynamicLocatorEntry,
  DynamicTestIdEntry,
  DynamicSelectorEntry
} from './locators/dynamic-locator-resolver.js'

export { ProxyLocatorMethods } from './types/proxy-methods.js'
export type {
  DynamicLocatorEntry,
  DynamicTestIdEntry,
  DynamicSelectorEntry
} from './locators/dynamic-locator-resolver.js'

export const zeroArgMethodsList = [
  'click',
  'dblclick',
  'hover',
  'focus',
  'blur',
  'check',
  'uncheck',
  'clear',
  'waitFor',
  'isChecked',
  'isDisabled',
  'isVisible',
  'textContent',
  'innerText',
  'allInnerTexts',
  'allTextContents',
  'count',
  'scrollIntoViewIfNeeded',
  'boundingBox'
] as const

export const oneArgMethodsList = [
  'fill',
  'press',
  'pressSequentially',
  'selectOption',
  'setInputFiles',
  'getAttribute',
  'dragTo'
] as const

export type AllowedZeroArgMethods = (typeof zeroArgMethodsList)[number]
export type AllowedOneArgMethods = (typeof oneArgMethodsList)[number]
export type AllowedMethodKeys = AllowedZeroArgMethods | AllowedOneArgMethods

import {
  ValidateDynamicEntryProperties,
  ExtractPlaceholders,
  HasDuplicatePlaceholders,
  ReplacePattern,
  ExpandDynamicKey,
  ResolvedTestIdKeys,
  AllExpandedTestIdKeys,
  AllOtherExpandedTestIdKeys,
  ValidateTestIds
} from './types/validation.js'

// ─── Core key types ──────────────────────────────────────────────────────────

export type PageKeys<T> =
  | (T extends { testIds?: infer I } ? (I extends Record<string, any> ? ResolvedTestIdKeys<I> : never) : never)
  | (T extends { selectors?: infer S } ? (S extends Record<string, any> ? ResolvedTestIdKeys<S> : never) : never)

export type TypedLocators<T> = {
  [K in PageKeys<T>]: Locator
}

export type ChainedKeys<T> = `${PageKeys<T>}.${PageKeys<T>}`

export type TargetKey<T> = PageKeys<T> | ChainedKeys<T> | Locator

export type ValidateTarget<K, T> = K extends Locator ? Locator : K extends PageKeys<T> | ChainedKeys<T> ? K : never

export function getOptionsArgumentIndex(methodName: AllowedMethodKeys): number {
  if ((zeroArgMethodsList as readonly string[]).includes(methodName)) return 0
  if ((oneArgMethodsList as readonly string[]).includes(methodName)) return 1
  return -1
}

/** Map type accepted by the `testIds` property in a page config. */
export type TestIdMap = Record<string, string | DynamicTestIdEntry>

export type SelectorMap = Record<string, string | DynamicSelectorEntry>

export type PageConfig = {
  url?: string
  testIds?: TestIdMap
  selectors?: SelectorMap
}

type GetTestIds<T> = T extends { testIds: infer I } ? (I extends Record<string, any> ? I : {}) : {}
type GetSelectors<T> = T extends { selectors: infer S } ? (S extends Record<string, any> ? S : {}) : {}

export type ValidatePageConfig<T> = {
  url?: string
  testIds?: T extends { testIds: infer I }
  ? I extends Record<string, any>
  ? ValidateTestIds<I, 'testId', GetSelectors<T>>
  : TestIdMap
  : TestIdMap
  selectors?: T extends { selectors: infer S }
  ? S extends Record<string, any>
  ? ValidateTestIds<S, 'selector', GetTestIds<T>>
  : SelectorMap
  : SelectorMap
} & {
  [K in Exclude<keyof T, keyof PageConfig>]: never
}

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
export function createPageConfig<const T extends PageConfig>(
  config: [T] extends [ValidatePageConfig<T>] ? T : ValidatePageConfig<T>
): T {
  return config as any
}
