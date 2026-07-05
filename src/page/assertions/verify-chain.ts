import { Locator, expect as playwrightExpect, test } from '@playwright/test'
import { ChainedKeys, PageKeys, GetStrategyOfKey } from '../config'
import { formatAssertionDescription } from '../utils/formatter'
import { getCallerLocation } from '../utils/caller-location'

export type VerifyOptions = {
  timeout?: number
  nth?: number
  hasText?: string | RegExp
  message?: string
}

type PlaywrightLocatorMatchers = ReturnType<typeof playwrightExpect<Locator>>

type ModifyMatcherArgs<Args extends any[]> = Args extends []
  ? [options?: { nth?: number; hasText?: string | RegExp; message?: string }]
  : Args extends [any, any?]
    ? [
        Args[0],
        (Exclude<Args[1], undefined> & {
          nth?: number
          hasText?: string | RegExp
          message?: string
        })?
      ]
    : Args extends [any?]
      ? Exclude<Args[0], undefined> extends object
        ? [
            (Exclude<Args[0], undefined> & {
              nth?: number
              hasText?: string | RegExp
              message?: string
            })?
          ]
        : [
            Exclude<Args[0], undefined>,
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
      : PlaywrightLocatorMatchers[K] extends (...args: infer Args) => any
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

export function createVerifyChain<T>(
  resolveLocator: (target: any, options?: { nth?: number; hasText?: string | RegExp; raw?: boolean }) => Locator,
  target: PageKeys<T> | Locator,
  verifyOptions: VerifyOptions | undefined,
  isSoft: boolean
): VerifyMatchers<T, any> {
  const defaultNth = verifyOptions?.nth
  const defaultHasText = verifyOptions?.hasText
  const defaultMessage = verifyOptions?.message
  const expectFn = isSoft ? playwrightExpect.soft : playwrightExpect

  const createMatcher = (isNegated: boolean): any => {
    const baseFn = async (options?: any) => {
      const nth = options?.nth !== undefined ? options.nth : defaultNth
      const hasText = options?.hasText !== undefined ? options.hasText : defaultHasText
      const stepName =
        options?.message ?? defaultMessage ?? formatAssertionDescription(target, 'toBeVisible', isNegated, [options])
      await test.step(
        stepName,
        async () => {
          const locator = resolveLocator(target, { nth, hasText })
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
          return (targetObj as any)[prop]
        }
        if (prop === 'not') {
          if (isNegated) return undefined
          return createMatcher(true)
        }
        if (prop === 'then') {
          return (onfulfilled?: any, onrejected?: any) => {
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
          return (targetObj as any)[prop]
        }

        return async (...args: any[]) => {
          const lastArg = args[args.length - 1]
          const lastIsOptions =
            lastArg !== null && typeof lastArg === 'object' && !(lastArg instanceof RegExp) && !Array.isArray(lastArg)
          const valueArgs = lastIsOptions ? args.slice(0, args.length - 1) : args
          const options = lastIsOptions ? lastArg : undefined
          const nth = options && 'nth' in options ? options.nth : defaultNth
          const hasText = options && 'hasText' in options ? options.hasText : defaultHasText
          const isHaveCount = prop === 'toHaveCount'

          const stepName =
            options?.message ?? defaultMessage ?? formatAssertionDescription(target, String(prop), isNegated, valueArgs)
          await test.step(
            stepName,
            async () => {
              const locator = resolveLocator(target, {
                nth,
                hasText,
                raw: isHaveCount
              })
              const expectation = expectFn(locator, stepName)
              const match = isNegated ? expectation.not : expectation
              await (match as any)[prop](...args)
            },
            { box: true, location: getCallerLocation() }
          )
        }
      }
    })
  }

  return createMatcher(false)
}
