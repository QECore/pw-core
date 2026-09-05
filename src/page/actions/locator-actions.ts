import { Locator, test } from '@playwright/test'
import { AllowedMethodKeys, getOptionsArgumentIndex, zeroArgMethodsList, oneArgMethodsList } from '../config'
import { LocatorResolutionOptions, LocatorTarget } from '../locators/resolver'
import { formatStepDescription, formatTarget } from '../utils/formatter'
import { getCallerLocation } from '../utils/caller-location'

type LocatorResolver = (target: LocatorTarget, options?: LocatorResolutionOptions) => Locator
type ActionArguments = unknown[]
type ActionOptions = Record<string, unknown>
type LocatorMethod = (...args: ActionArguments) => unknown

function isActionOptions(value: unknown): value is ActionOptions {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getResolutionOptions(value: unknown): Pick<LocatorResolutionOptions, 'nth' | 'hasText'> {
  if (!isActionOptions(value)) return {}

  return {
    nth: typeof value.nth === 'number' ? value.nth : undefined,
    hasText: typeof value.hasText === 'string' || value.hasText instanceof RegExp ? value.hasText : undefined
  }
}

function removeLocatorStrategyOptions(options: ActionOptions): ActionOptions {
  const { exact, checked, disabled, expanded, includeHidden, level, pressed, selected, ...playwrightOptions } = options
  return playwrightOptions
}

export function executeAction(
  prop: AllowedMethodKeys,
  resolveLocatorFn: LocatorResolver,
  timeout: number | undefined,
  args: ActionArguments
): Promise<unknown> {
  const [locatorKey, ...methodArgs] = args

  const optionsIndex = getOptionsArgumentIndex(prop)
  const userOptions = optionsIndex !== -1 && methodArgs.length > optionsIndex ? methodArgs[optionsIndex] : undefined
  const resolutionOptions = getResolutionOptions(userOptions)

  const isCount = prop === 'count'
  const locator = resolveLocatorFn(locatorKey as LocatorTarget, {
    ...resolutionOptions,
    raw: isCount,
    ...(isActionOptions(userOptions) ? userOptions : {})
  })
  const method = Reflect.get(locator, prop) as unknown
  if (typeof method !== 'function') {
    throw new Error(`Property '${prop}' does not exist on Locator.`)
  }

  if (prop === 'dragTo' && methodArgs.length > 0) {
    methodArgs[0] = resolveLocatorFn(methodArgs[0] as LocatorTarget)
  }

  if (optionsIndex !== -1 && methodArgs.length > optionsIndex) {
    const opts = methodArgs[optionsIndex]
    if (isActionOptions(opts)) {
      methodArgs[optionsIndex] = removeLocatorStrategyOptions(opts)
    }
  }

  if (timeout !== undefined) {
    if (optionsIndex !== -1) {
      while (methodArgs.length < optionsIndex) {
        methodArgs.push(undefined)
      }
      const existingOptions = methodArgs[optionsIndex] || {}
      methodArgs[optionsIndex] = { timeout, ...existingOptions }
    }
  }

  const stepName = formatStepDescription(prop, locatorKey, methodArgs)

  if (prop === 'fill' && methodArgs.length > 1) {
    const opts = methodArgs[1]
    if (isActionOptions(opts) && 'mask' in opts) {
      const { mask, ...playwrightOpts } = opts
      methodArgs[1] = playwrightOpts
    }
  }

  let shouldMask = false
  if (prop === 'fill' && methodArgs.length > 0) {
    const opts = methodArgs[1]
    if (isActionOptions(opts) && opts.mask !== undefined) {
      shouldMask = opts.mask === true
    } else {
      const targetStr = formatTarget(locatorKey)
      const targetStrLower = targetStr.toLowerCase()
      shouldMask = targetStrLower.includes('pass') || targetStrLower.includes('pw')
    }
  }

  if (prop === 'fill' && shouldMask) {
    return test.step(
      stepName,
      async () => {
        await locator.focus()
        await locator.evaluate((el, val) => {
          const inputEl = el as HTMLInputElement | HTMLTextAreaElement
          const prototype =
            el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
          const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value')
          if (descriptor && descriptor.set) {
            descriptor.set.call(inputEl, val)
          } else {
            inputEl.value = val
          }
          inputEl.dispatchEvent(new Event('input', { bubbles: true }))
          inputEl.dispatchEvent(new Event('change', { bubbles: true }))
        }, methodArgs[0] as string)
      },
      { box: true, location: getCallerLocation() }
    )
  }

  return test.step(
    stepName,
    () => {
      return (method as LocatorMethod).apply(locator, methodArgs)
    },
    { box: true, location: getCallerLocation() }
  )
}

export function defineActionMethods(
  instance: object,
  resolveLocatorFn: LocatorResolver,
  timeout: number | undefined
): void {
  const locatorMethods = [...zeroArgMethodsList, ...oneArgMethodsList]
  for (const prop of locatorMethods) {
    Object.defineProperty(instance, prop, {
      value: (...args: ActionArguments) => {
        return executeAction(prop as AllowedMethodKeys, resolveLocatorFn, timeout, args)
      },
      writable: true,
      configurable: true,
      enumerable: false
    })
  }
}
