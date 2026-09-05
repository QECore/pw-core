import { Locator, expect as playwrightExpect, test } from '@playwright/test'
import { ChainedKeys, PageKeys, GetStrategyOfKey } from '../config'
import { LocatorResolutionOptions, LocatorTarget } from '../locators/resolver'
import { formatAssertionDescription } from '../utils/formatter'
import { getCallerLocation } from '../utils/caller-location'

export type VerifyOptions = {
  timeout?: number
  nth?: number
  hasText?: string | RegExp
  message?: string
}

type PlaywrightLocatorMatchers = ReturnType<typeof playwrightExpect<Locator>>

type ModifyMatcherArgs<Args extends readonly unknown[]> = Args extends []
  ? [options?: { nth?: number; hasText?: string | RegExp; message?: string }]
  : Args extends [infer First, (infer Second)?]
    ? [
        First,
        (Exclude<Second, undefined> & {
          nth?: number
          hasText?: string | RegExp
          message?: string
        })?
      ]
    : Args extends [(infer First)?]
      ? Exclude<First, undefined> extends object
        ? [
            (Exclude<First, undefined> & {
              nth?: number
              hasText?: string | RegExp
              message?: string
            })?
          ]
        : [
            Exclude<First, undefined>,
            options?: {
              nth?: number
              hasText?: string | RegExp
              message?: string
            }
          ]
      : [
          options?: {
            nth?: number
            hasText?: string | RegExp
            message?: string
          }
        ]

type DynamicallyModifiedMatchers<T, Target> = {
  [K in keyof PlaywrightLocatorMatchers]: K extends 'not'
    ? Omit<VerifyMatchers<T, Target>, 'not'>
    : K extends 'toBeChecked'
      ? Target extends Locator
        ? (...args: ModifyMatcherArgs<Parameters<PlaywrightLocatorMatchers[K]>>) => Promise<void>
        : Target extends string
          ? GetStrategyOfKey<T, Target> extends 'checkbox' | 'radio'
            ? (...args: ModifyMatcherArgs<Parameters<PlaywrightLocatorMatchers[K]>>) => Promise<void>
            : never
          : never
      : PlaywrightLocatorMatchers[K] extends (...args: infer Args) => unknown
        ? (...args: ModifyMatcherArgs<Args>) => Promise<void>
        : PlaywrightLocatorMatchers[K]
}

export type VerifyMatchers<T, Target> = DynamicallyModifiedMatchers<T, Target> &
  PromiseLike<void> & {
    (
      options?: Parameters<PlaywrightLocatorMatchers['toBeVisible']>[0] & {
        nth?: number
        hasText?: string | RegExp
        message?: string
      }
    ): Promise<void>
  }

export type VerifyFn<T> = <Target extends PageKeys<T> | Locator>(
  target: Target,
  options?: VerifyOptions
) => VerifyMatchers<T, Target>

export type AssertionsMethod<T> = {
  verify: VerifyFn<T> & { soft: VerifyFn<T> }
  verifyHidden(
    target: PageKeys<T> | Locator,
    options?: Parameters<ReturnType<typeof playwrightExpect<Locator>>['toBeHidden']>[0] & {
      nth?: number
      hasText?: string | RegExp
      message?: string
    }
  ): Promise<void>
  verifyEnabled(
    target: PageKeys<T> | Locator,
    options?: Parameters<ReturnType<typeof playwrightExpect<Locator>>['toBeEnabled']>[0] & {
      nth?: number
      hasText?: string | RegExp
      message?: string
    }
  ): Promise<void>
  verifyDisabled(
    target: PageKeys<T> | Locator,
    options?: Parameters<ReturnType<typeof playwrightExpect<Locator>>['toBeDisabled']>[0] & {
      nth?: number
      hasText?: string | RegExp
      message?: string
    }
  ): Promise<void>
  expect(target: PageKeys<T> | Locator, message?: string): ReturnType<typeof playwrightExpect<Locator>>
  locator(
    target: PageKeys<T> | Locator,
    options?: Parameters<Locator['filter']>[0] & { nth?: number }
  ): Locator
}

export type VerifyResolver = (target: LocatorTarget, options?: LocatorResolutionOptions) => Locator

type AssertionOptions = Record<string, unknown>
type AssertionMatcher = (...args: unknown[]) => Promise<void>

function isAssertionOptions(value: unknown): value is AssertionOptions {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof RegExp)
}

function getOptionNumber(options: AssertionOptions | undefined, key: 'nth'): number | undefined {
  const value = options?.[key]
  return typeof value === 'number' ? value : undefined
}

function getOptionText(options: AssertionOptions | undefined): string | RegExp | undefined {
  const value = options?.hasText
  return typeof value === 'string' || value instanceof RegExp ? value : undefined
}

function getOptionMessage(options: AssertionOptions | undefined): string | undefined {
  const value = options?.message
  return typeof value === 'string' ? value : undefined
}

export function createVerifyChain<T, Target extends PageKeys<T> | Locator>(
  resolveLocator: VerifyResolver,
  target: Target,
  verifyOptions: VerifyOptions | undefined,
  isSoft: boolean
): VerifyMatchers<T, Target> {
  const defaultNth = verifyOptions?.nth
  const defaultHasText = verifyOptions?.hasText
  const defaultMessage = verifyOptions?.message
  const expectFn = isSoft ? playwrightExpect.soft : playwrightExpect

  const createMatcher = (isNegated: boolean): VerifyMatchers<T, Target> => {
    const baseFn = async (options?: VerifyOptions): Promise<void> => {
      const nth = options?.nth !== undefined ? options.nth : defaultNth
      const hasText = options?.hasText !== undefined ? options.hasText : defaultHasText
      const stepName =
        options?.message ?? defaultMessage ?? formatAssertionDescription(target, 'toBeVisible', isNegated, [options])
      await test.step(
        stepName,
        async () => {
          const locator = resolveLocator(target as LocatorTarget, { nth, hasText })
          const expectation = expectFn(locator, stepName)
          const match = isNegated ? expectation.not : expectation
          await match.toBeVisible(options)
        },
        { box: true, location: getCallerLocation() }
      )
    }

    return new Proxy(baseFn, {
      get(targetObj, prop) {
        if (typeof prop === 'symbol') {
          return Reflect.get(targetObj, prop)
        }
        if (prop === 'not') {
          if (isNegated) return undefined
          return createMatcher(true)
        }
        if (prop === 'then') {
          return (onfulfilled?: (value: void) => unknown, onrejected?: (reason: unknown) => unknown) => {
            return baseFn().then(onfulfilled, onrejected)
          }
        }
        const skippedProps = new Set([
          'then',
          'catch',
          'finally',
          'bind',
          'call',
          'apply',
          'toString',
          'valueOf',
          'toLocaleString'
        ])
        if (skippedProps.has(prop)) {
          return Reflect.get(targetObj, prop)
        }

        return async (...args: unknown[]) => {
          const lastArg = args[args.length - 1]
          const lastIsOptions = isAssertionOptions(lastArg)
          const valueArgs = lastIsOptions ? args.slice(0, args.length - 1) : args
          const options = lastIsOptions ? lastArg : undefined
          const nth = getOptionNumber(options, 'nth') ?? defaultNth
          const hasText = getOptionText(options) ?? defaultHasText
          const isHaveCount = prop === 'toHaveCount'

          const stepName =
            getOptionMessage(options) ?? defaultMessage ?? formatAssertionDescription(target, prop, isNegated, valueArgs)
          await test.step(
            stepName,
            async () => {
              const locator = resolveLocator(target as LocatorTarget, {
                nth,
                hasText,
                raw: isHaveCount
              })
              const expectation = expectFn(locator, stepName)
              const match = isNegated ? expectation.not : expectation
              const matcher = Reflect.get(match, prop) as unknown
              if (typeof matcher !== 'function') {
                throw new Error(`Matcher '${prop}' does not exist on Playwright expectations.`)
              }
              await (matcher as AssertionMatcher).apply(match, args)
            },
            { box: true, location: getCallerLocation() }
          )
        }
      }
    }) as unknown as VerifyMatchers<T, Target>
  }

  return createMatcher(false)
}
