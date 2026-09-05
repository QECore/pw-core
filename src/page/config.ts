import type { Locator } from '@playwright/test'
import type {
  DynamicLocatorEntry,
  DynamicTestIdEntry,
  DynamicSelectorEntry
} from './locators/dynamic-locator-resolver'

export { ProxyLocatorMethods } from './types/proxy-methods'
export type {
  DynamicLocatorEntry,
  DynamicTestIdEntry,
  DynamicSelectorEntry
} from './locators/dynamic-locator-resolver'

import { zeroArgMethodsList, oneArgMethodsList } from '../constants/methods'
import { strategyList } from '../constants/strategies'
import type { AllowedMethodKeys } from '../types/methods'
import type { StrategyType, LocatorStrategyOptions } from '../types/strategies'
import type {
  ResolvedTestIdKeys,
  AllExpandedTestIdKeys,
  AllOtherExpandedTestIdKeys,
  ValidateTestIds
} from './types/validation'

export { zeroArgMethodsList, oneArgMethodsList } from '../constants/methods'
export { rolesList, strategyList } from '../constants/strategies'
export type { AllowedZeroArgMethods, AllowedOneArgMethods, AllowedMethodKeys } from '../types/methods'
export type { RoleType, StrategyType, PlaywrightRoleOptions, PlaywrightTextOptions, LocatorStrategyOptions } from '../types/strategies'

// Mapping of locator keys to their strategy group
export type GetStrategyOfKey<T, K extends string> =
  // Check testId / testIds
  K extends (T extends { testId: infer I } ? ResolvedTestIdKeys<I> : never)
    ? 'testId'
    : K extends (T extends { testIds: infer I } ? ResolvedTestIdKeys<I> : never)
      ? 'testId'
      // Check selector / selectors
      : K extends (T extends { selector: infer S } ? ResolvedTestIdKeys<S> : never)
        ? 'selector'
        : K extends (T extends { selectors: infer S } ? ResolvedTestIdKeys<S> : never)
          ? 'selector'
          // Check other strategies
          : {
              [S in Exclude<StrategyType, 'testId' | 'selector'>]: K extends (T extends Record<S, readonly string[]>
                ? T[S][number]
                : never)
                ? S
                : never
            }[Exclude<StrategyType, 'testId' | 'selector'>]

export type ModifyOptionsForTarget<T, Target, Options> = Options & {
  nth?: number
  hasText?: string | RegExp
} & (Target extends string
  ? LocatorStrategyOptions<GetStrategyOfKey<T, Target>>
  : {})

// Core key types
export type PageKeys<T> =
  | (T extends { testId: infer I } ? (I extends Record<string, unknown> ? ResolvedTestIdKeys<I> : never) : never)
  | (T extends { testIds: infer I } ? (I extends Record<string, unknown> ? ResolvedTestIdKeys<I> : never) : never)
  | (T extends { selector: infer S } ? (S extends Record<string, unknown> ? ResolvedTestIdKeys<S> : never) : never)
  | (T extends { selectors: infer S } ? (S extends Record<string, unknown> ? ResolvedTestIdKeys<S> : never) : never)
  | {
      [S in Exclude<StrategyType, 'testId' | 'selector'>]: T extends Record<S, readonly string[]>
        ? T[S][number]
        : never
    }[Exclude<StrategyType, 'testId' | 'selector'>]

export type CheckableLocatorKeys<T> = {
  [S in 'checkbox' | 'radio']: T extends Record<S, readonly string[]> ? T[S][number] : never
}['checkbox' | 'radio']

export type CheckboxLocatorKeys<T> = T extends Record<'checkbox', readonly string[]>
  ? T['checkbox'][number]
  : never

export type EditableLocatorKeys<T> = {
  [S in 'label' | 'placeholder' | 'textbox' | 'searchbox']: T extends Record<S, readonly string[]> ? T[S][number] : never
}['label' | 'placeholder' | 'textbox' | 'searchbox']

export type SelectableLocatorKeys<T> = {
  [S in 'combobox' | 'listbox' | 'option']: T extends Record<S, readonly string[]> ? T[S][number] : never
}['combobox' | 'listbox' | 'option']

export type TypedLocators<T> = {
  [K in PageKeys<T>]: Locator
}

export type UniversalKeys<T> =
  | (T extends { testId: infer I } ? ResolvedTestIdKeys<I> : never)
  | (T extends { testIds: infer I } ? ResolvedTestIdKeys<I> : never)
  | (T extends { selector: infer S } ? ResolvedTestIdKeys<S> : never)
  | (T extends { selectors: infer S } ? ResolvedTestIdKeys<S> : never)

export type SemanticKeys<T> = Exclude<PageKeys<T>, UniversalKeys<T>>

export type ChainedKeys<T> =
  | `${UniversalKeys<T>}.${PageKeys<T>}`
  | `${UniversalKeys<T>}.${SemanticKeys<T>}.${UniversalKeys<T>}`
  | `${UniversalKeys<T>}.${UniversalKeys<T>}.${PageKeys<T>}`

export type TargetKey<T> = PageKeys<T> | ChainedKeys<T> | Locator

export type ValidateTarget<K, T> = K extends Locator ? Locator : K extends PageKeys<T> | ChainedKeys<T> ? K : never

export function getOptionsArgumentIndex(methodName: AllowedMethodKeys): number {
  if ((zeroArgMethodsList as readonly string[]).includes(methodName)) return 0
  if ((oneArgMethodsList as readonly string[]).includes(methodName)) return 1
  return -1
}

/** Map type accepted by the `testId` property in a page config. */
export type TestIdMap = Record<string, string | DynamicTestIdEntry>

export type SelectorMap = Record<string, string | DynamicSelectorEntry>

export type PageConfig = {
  url?: string
  testId?: TestIdMap
  selector?: SelectorMap
  // Backward compatibility
  testIds?: TestIdMap
  selectors?: SelectorMap
} & {
  [S in Exclude<StrategyType, 'testId' | 'selector'>]?: readonly string[]
}

export type KeysOfStrategy<T, S extends StrategyType> = S extends 'testId'
  ? T extends { testId: infer I }
    ? ResolvedTestIdKeys<I>
    : T extends { testIds: infer I }
      ? ResolvedTestIdKeys<I>
      : never
  : S extends 'selector'
    ? T extends { selector: infer I }
      ? ResolvedTestIdKeys<I>
      : T extends { selectors: infer S2 }
        ? ResolvedTestIdKeys<S2>
        : never
    : T extends Record<S, infer A>
      ? A extends readonly string[]
        ? A[number]
        : never
      : never

export type KeysOfOtherStrategies<T, S extends StrategyType> = {
  [O in Exclude<StrategyType, S>]: KeysOfStrategy<T, O>
}[Exclude<StrategyType, S>]

type GetTestIds<T> = T extends { testId: infer I }
  ? (I extends Record<string, unknown> ? I : {})
  : T extends { testIds: infer I }
    ? (I extends Record<string, unknown> ? I : {})
    : {}

type GetSelectors<T> = T extends { selector: infer S }
  ? (S extends Record<string, unknown> ? S : {})
  : T extends { selectors: infer S }
    ? (S extends Record<string, unknown> ? S : {})
    : {}

export type ValidatePageConfig<T> = {
  url?: string
  testId?: T extends { testId: infer I }
    ? I extends Record<string, unknown>
      ? ValidateTestIds<I, 'testId', GetSelectors<T>> & {
          [K in keyof I]: K extends KeysOfOtherStrategies<T, 'testId'>
            ? { [P in `Error: Duplicate key "${K & string}" is defined in multiple strategies`]: never }
            : unknown
        }
      : TestIdMap
    : TestIdMap
  testIds?: T extends { testIds: infer I }
    ? I extends Record<string, unknown>
      ? ValidateTestIds<I, 'testId', GetSelectors<T>> & {
          [K in keyof I]: K extends KeysOfOtherStrategies<T, 'testId'>
            ? { [P in `Error: Duplicate key "${K & string}" is defined in multiple strategies`]: never }
            : unknown
        }
      : TestIdMap
    : TestIdMap
  selector?: T extends { selector: infer S }
    ? S extends Record<string, unknown>
      ? ValidateTestIds<S, 'selector', GetTestIds<T>> & {
          [K in keyof S]: K extends KeysOfOtherStrategies<T, 'selector'>
            ? { [P in `Error: Duplicate key "${K & string}" is defined in multiple strategies`]: never }
            : unknown
        }
      : SelectorMap
    : SelectorMap
  selectors?: T extends { selectors: infer S }
    ? S extends Record<string, unknown>
      ? ValidateTestIds<S, 'selector', GetTestIds<T>> & {
          [K in keyof S]: K extends KeysOfOtherStrategies<T, 'selector'>
            ? { [P in `Error: Duplicate key "${K & string}" is defined in multiple strategies`]: never }
            : unknown
        }
      : SelectorMap
    : SelectorMap
} & {
  [S in Exclude<StrategyType, 'testId' | 'selector'>]?: T extends Record<S, infer A>
    ? A extends readonly string[]
      ? {
          [I in keyof A]: A[I] extends string
            ? A[I] extends KeysOfOtherStrategies<T, S>
              ? `Error: Duplicate key "${A[I]}" is defined in multiple strategies`
              : A[I]
            : A[I]
        }
      : readonly string[]
    : readonly string[]
} & {
  [K in Exclude<keyof T, keyof PageConfig>]: never
}

/**
 * Creates a strongly-typed page configuration object containing URLs, testIds, and CSS selectors.
 */
export function createPageConfig<const T extends PageConfig>(
  config: [T] extends [ValidatePageConfig<T>] ? T : ValidatePageConfig<T>
): T {
  return config as T
}

