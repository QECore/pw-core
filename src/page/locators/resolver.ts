import { Page, Locator, test } from '@playwright/test'
import {
  ChainedKeys,
  PageKeys,
  zeroArgMethodsList,
  oneArgMethodsList,
  strategyList,
  rolesList
} from '../config'
import { formatStepDescription, formatTarget } from '../utils/formatter'
import { getExpandedTestIds } from './dynamic-locator-resolver'
import { getCallerLocation } from '../utils/caller-location'

export const locatorStrategies: Record<string, { resolver: string; role?: string }> = {
  testId: { resolver: 'getByTestId' },
  selector: { resolver: 'locator' },
  text: { resolver: 'getByText' },
  label: { resolver: 'getByLabel' },
  title: { resolver: 'getByTitle' },
  placeholder: { resolver: 'getByPlaceholder' },
  altText: { resolver: 'getByAltText' }
}

// Add all roles dynamically
for (const role of rolesList) {
  locatorStrategies[role] = { resolver: 'getByRole', role }
}

export interface LocatorMetadata {
  strategy: string
  value: any
}

export function cleanKey(s: string): string {
  let clean = s
  const suffixes = ['Btn', 'Button', 'Link', 'Input', 'Checkbox', 'Option', 'Title', 'Label', 'Value', 'Text', 'Wrapper', 'Container', 'Card', 'Item']
  for (const suffix of suffixes) {
    clean = clean.replace(new RegExp(`[-_]?${suffix}$`, 'i'), '')
  }
  clean = clean.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
  clean = clean.replace(/^\d+/, '').replace(/\d+$/, '')
  return clean
}

export const lookupIndexCache = new WeakMap<object, Map<string, LocatorMetadata>>()

export function buildLookupIndex(config: any): Map<string, LocatorMetadata> {
  const index = new Map<string, LocatorMetadata>()
  const seenInStrategies = new Map<string, string[]>()

  const addKey = (key: string, strategy: string, value: any) => {
    const cleanedKey = cleanKey(key)
    if (seenInStrategies.has(cleanedKey)) {
      const existing = seenInStrategies.get(cleanedKey)!
      if (!existing.includes(strategy)) {
        existing.push(strategy)
      }
    } else {
      seenInStrategies.set(cleanedKey, [strategy])
    }
    index.set(cleanedKey, { strategy, value })
  }

  // 1. Process testId / testIds (backward compatibility)
  const testIdConfig = config.testId || config.testIds
  if (testIdConfig) {
    const expanded = getExpandedTestIds(testIdConfig)
    for (const key of Object.keys(expanded)) {
      addKey(key, 'testId', expanded[key])
    }
  }

  // 2. Process selector / selectors (backward compatibility)
  const selectorConfig = config.selector || config.selectors
  if (selectorConfig) {
    const expanded = getExpandedTestIds(selectorConfig)
    for (const key of Object.keys(expanded)) {
      addKey(key, 'selector', expanded[key])
    }
  }

  // 3. Process all other strategies
  for (const strategy of strategyList) {
    if (strategy === 'testId' || strategy === 'selector') continue
    const items = config[strategy]
    if (Array.isArray(items)) {
      for (const item of items) {
        if (typeof item === 'string') {
          addKey(item, strategy, item)
        }
      }
    }
  }

  // 4. Duplicate Check & Validation
  for (const [key, strategies] of seenInStrategies.entries()) {
    if (strategies.length > 1) {
      throw new Error(
        `Duplicate locator value "${key}"\n\nFound in\n\n${strategies.join('\n\n')}\n\nLocator values must be globally unique.`
      )
    }
  }

  return index
}

export function defineLocators(instance: any, context: Page | Locator, config: any): void {
  let index = lookupIndexCache.get(config)
  if (!index) {
    index = buildLookupIndex(config)
    lookupIndexCache.set(config, index)
  }

  for (const key of index.keys()) {
    Object.defineProperty(instance, key, {
      get: () => {
        return resolveLocator(context, config, key)
      },
      enumerable: true,
      configurable: true
    })
  }
}

export function resolveLocator(
  context: Page | Locator,
  config: any,
  target: any,
  options?: { nth?: number; raw?: boolean; hasText?: string | RegExp } & Record<string, any>
): Locator {
  if (typeof target !== 'string') return target as Locator
  const targetStr = target as string

  let index = lookupIndexCache.get(config)
  if (!index) {
    index = buildLookupIndex(config)
    lookupIndexCache.set(config, index)
  }

  const toRegex = (val: string): RegExp => {
    const escaped = val.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
    return new RegExp(escaped.replace(/\s+/g, '\\s+'), 'i')
  }

  const resolveSingle = (key: string, ctx: Page | Locator): Locator => {
    const cleaned = cleanKey(key)
    const meta = index!.get(cleaned)
    if (!meta) {
      throw new Error(`Locator key '${key}' is not defined in page object configuration.`)
    }

    const strategy = locatorStrategies[meta.strategy]
    if (!strategy) {
      throw new Error(`Unknown locator strategy '${meta.strategy}' for key '${key}'.`)
    }

    const { resolver, role } = strategy

    if (resolver === 'getByRole') {
      const val = typeof meta.value === 'string' ? toRegex(meta.value) : meta.value
      const roleOptions: any = { name: val }
      if (options) {
        const allowedOptions = ['exact', 'checked', 'disabled', 'expanded', 'includeHidden', 'level', 'pressed', 'selected']
        for (const opt of allowedOptions) {
          if (opt in options) {
            roleOptions[opt] = options[opt]
          }
        }
      }
      return (ctx as any)[resolver](role, roleOptions)
    } else if (resolver === 'locator') {
      return (ctx as any)[resolver](meta.value)
    } else {
      const opt: any = {}
      if (options && 'exact' in options) {
        opt.exact = options.exact
      }
      const val = typeof meta.value === 'string' ? toRegex(meta.value) : meta.value
      return (ctx as any)[resolver](val, opt)
    }
  }

  let loc: Locator
  const cleanedTarget = cleanKey(targetStr)
  if (index.has(cleanedTarget)) {
    loc = resolveSingle(targetStr, context)
  } else if (targetStr.includes('.')) {
    const parts = targetStr.split('.')
    loc = resolveSingle(parts[0], context)
    for (let i = 1; i < parts.length; i++) {
      loc = resolveSingle(parts[i], loc)
    }
  } else {
    loc = resolveSingle(targetStr, context)
  }

  let resolved = loc
  if (options?.hasText !== undefined) {
    resolved = resolved.filter({ hasText: options.hasText })
  }

  if (options?.raw) {
    return resolved
  }
  if (options?.nth !== undefined) {
    return resolved.nth(options.nth)
  }
  return resolved.first()
}

/**
 * Resolve a config key to a proxied Locator with step-wrapped Playwright methods.
 */
export function locator(
  context: Page | Locator,
  config: any,
  target: any,
  options?: Parameters<Locator['filter']>[0] & { nth?: number }
): Locator {
  const resolved = resolveLocator(context, config, target, { raw: true })
  const filtered = options ? resolved.filter(options) : resolved
  const loc =
    options && typeof options === 'object' && 'nth' in options && options.nth !== undefined
      ? filtered.nth(options.nth)
      : filtered
  return wrapLocatorWithProxy(loc)
}

export function wrapLocatorWithProxy(loc: Locator): Locator {
  const actionMethods = [...zeroArgMethodsList, ...oneArgMethodsList]
  return new Proxy(loc, {
    get: (targetLoc, propKey, receiver) => {
      const val = Reflect.get(targetLoc, propKey, receiver)
      if (typeof val === 'function' && actionMethods.includes(propKey as any)) {
        return (...args: any[]) => {
          const stepName = formatStepDescription(propKey as string, targetLoc, args)
          if (propKey === 'fill') {
            const options = args[1]
            let shouldMask = false
            if (options && typeof options === 'object' && options.mask !== undefined) {
              shouldMask = options.mask === true
            } else {
              const targetStr = formatTarget(targetLoc)
              const targetStrLower = targetStr.toLowerCase()
              shouldMask = targetStrLower.includes('pass') || targetStrLower.includes('pw')
            }
            if (shouldMask) {
              return test.step(
                stepName,
                async () => {
                  await targetLoc.focus()
                  await targetLoc.evaluate((el, val) => {
                    const inputEl = el as HTMLInputElement | HTMLTextAreaElement
                    const prototype =
                      el.tagName === 'TEXTAREA'
                        ? window.HTMLTextAreaElement.prototype
                        : window.HTMLInputElement.prototype
                    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value')
                    if (descriptor && descriptor.set) {
                      descriptor.set.call(inputEl, val)
                    } else {
                      inputEl.value = val
                    }
                    inputEl.dispatchEvent(new Event('input', { bubbles: true }))
                    inputEl.dispatchEvent(new Event('change', { bubbles: true }))
                  }, args[0])
                },
                { box: true, location: getCallerLocation() }
              )
            }
          }
          return test.step(stepName, () => val.apply(targetLoc, args), {
            box: true,
            location: getCallerLocation()
          })
        }
      }
      return val
    }
  })
}
