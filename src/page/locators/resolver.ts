import { Page, Locator, test } from '@playwright/test'
import {
  ChainedKeys,
  PageConfig,
  PageKeys,
  StrategyType,
  zeroArgMethodsList,
  oneArgMethodsList,
  strategyList,
  rolesList
} from '../config'
import { formatStepDescription, formatTarget } from '../utils/formatter'
import { getExpandedTestIds } from './dynamic-locator-resolver'
import { getCallerLocation } from '../utils/caller-location'

export interface LocatorStrategyDefinition {
  resolver: string
  role?: string
}

export const locatorStrategies: Record<string, LocatorStrategyDefinition> = {
  testId: { resolver: 'getByTestId' },
  selector: { resolver: 'locator' },
  text: { resolver: 'getByText' },
  label: { resolver: 'getByLabel' },
  title: { resolver: 'getByTitle' },
  placeholder: { resolver: 'getByPlaceholder' },
  altText: { resolver: 'getByAltText' }
}

for (const role of rolesList) {
  locatorStrategies[role] = { resolver: 'getByRole', role }
}

export interface LocatorMetadata {
  strategy: StrategyType
  value: string
}

/** A configured locator key or a raw Playwright locator. */
export type LocatorTarget = string | Locator

/** Shared internal options understood by locator resolution. */
export type LocatorResolutionOptions = {
  nth?: number
  raw?: boolean
  hasText?: string | RegExp
} & Record<string, unknown>

export function cleanKey(s: string): string {
  let clean = s
  const suffixes = [
    'Btn',
    'Button',
    'Link',
    'Input',
    'Checkbox',
    'Option',
    'Title',
    'Label',
    'Value',
    'Text',
    'Wrapper',
    'Container',
    'Card',
    'Item'
  ]
  for (const suffix of suffixes) {
    clean = clean.replace(new RegExp(`[-_]?${suffix}$`, 'i'), '')
  }
  clean = clean.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
  clean = clean.replace(/^\d+/, '').replace(/\d+$/, '')
  return clean
}

export const lookupIndexCache = new WeakMap<object, Map<string, LocatorMetadata>>()

function getLookupIndex(config: PageConfig): Map<string, LocatorMetadata> {
  let index = lookupIndexCache.get(config)
  if (!index) {
    index = buildLookupIndex(config)
    lookupIndexCache.set(config, index)
  }
  return index
}

export function buildLookupIndex(config: PageConfig): Map<string, LocatorMetadata> {
  const index = new Map<string, LocatorMetadata>()
  const seenInStrategies = new Map<string, string[]>()

  const addKey = (key: string, strategy: StrategyType, value: string) => {
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

export function defineLocators(instance: object, context: Page | Locator, config: PageConfig): void {
  const index = getLookupIndex(config)

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

function resolvePlaywrightLocator(
  ctx: Page | Locator,
  resolver: string,
  role: string | undefined,
  value: string | RegExp,
  options?: LocatorResolutionOptions
): Locator {
  const toRegex = (val: string): RegExp => {
    const escaped = val.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
    return new RegExp(escaped.replace(/\s+/g, '\\s+'), 'i')
  }

  if (resolver === 'getByRole') {
    const val = typeof value === 'string' ? toRegex(value) : value
    const roleOptions: { name: string | RegExp; [key: string]: unknown } = { name: val }
    if (options) {
      const allowedOptions = [
        'exact',
        'checked',
        'disabled',
        'expanded',
        'includeHidden',
        'level',
        'pressed',
        'selected'
      ] as const
      for (const opt of allowedOptions) {
        if (opt in options && options[opt] !== undefined) {
          roleOptions[opt] = options[opt]
        }
      }
    }
    return ctx.getByRole(role as Parameters<Page['getByRole']>[0], roleOptions)
  }

  if (resolver === 'locator') {
    return ctx.locator(value as string)
  }

  const opt: { exact?: boolean } = {}
  if (options && 'exact' in options && typeof options.exact === 'boolean') {
    opt.exact = options.exact
  }
  const val = typeof value === 'string' ? toRegex(value) : value

  switch (resolver) {
    case 'getByTestId':
      return ctx.getByTestId(val)
    case 'getByLabel':
      return ctx.getByLabel(val, opt)
    case 'getByPlaceholder':
      return ctx.getByPlaceholder(val, opt)
    case 'getByAltText':
      return ctx.getByAltText(val, opt)
    case 'getByTitle':
      return ctx.getByTitle(val, opt)
    case 'getByText':
      return ctx.getByText(val, opt)
    default:
      return typeof val === 'string' ? ctx.locator(val) : ctx.getByText(val, opt)
  }
}

export function resolveLocator(
  context: Page | Locator,
  config: PageConfig,
  target: LocatorTarget,
  options?: LocatorResolutionOptions
): Locator {
  if (typeof target !== 'string') return target
  const targetStr = target

  const index = getLookupIndex(config)

  const resolveSingle = (key: string, ctx: Page | Locator): Locator => {
    const cleaned = cleanKey(key)
    const meta = index.get(cleaned)
    if (!meta) {
      throw new Error(`Locator key '${key}' is not defined in page object configuration.`)
    }

    const strategy = locatorStrategies[meta.strategy]
    if (!strategy) {
      throw new Error(`Unknown locator strategy '${meta.strategy}' for key '${key}'.`)
    }

    const { resolver, role } = strategy
    return resolvePlaywrightLocator(ctx, resolver, role, meta.value, options)
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
  config: PageConfig,
  target: LocatorTarget,
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

const ACTION_METHODS = new Set<string>([...zeroArgMethodsList, ...oneArgMethodsList])

export function wrapLocatorWithProxy(loc: Locator): Locator {
  return new Proxy(loc, {
    get: (targetLoc, propKey, receiver) => {
      const val = Reflect.get(targetLoc, propKey, receiver)
      if (typeof val === 'function' && typeof propKey === 'string' && ACTION_METHODS.has(propKey)) {
        return (...args: unknown[]) => {
          const stepName = formatStepDescription(propKey, targetLoc, args)
          return test.step(
            stepName,
            async () => {
              return await (targetLoc as unknown as Record<string, (...a: unknown[]) => unknown>)[propKey](...args)
            },
            { box: true, location: getCallerLocation() }
          )
        }
      }
      return val
    }
  })
}
