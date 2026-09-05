import { toRegistryKey, toUnprefixedPageKey } from './key-utils'
import { getSelectorValue } from './selector-parser'
import { matchDynamicEntry, type RegistryRoot, type RegistryPageConfig } from './registry-store'
import type { SelectorStrategyType } from './types'

export interface MatchResult {
  pageKey: string
  elementKey: string
  val: string
  type: string
  isNew: boolean
}

export function toCamelCase(str: string): string {
  return toRegistryKey(str)
}

const normalizePageKey = toUnprefixedPageKey

/**
 * Determines the page key from a URL or title, checking existing registry configs first.
 */
export function findPageKey(url: string, title: string, registryObj: RegistryRoot, overrideMode?: boolean): string {
  let pathname = ''
  let hashPath = ''
  try {
    const u = new URL(url)
    pathname = u.pathname
    if (u.hash && u.hash.startsWith('#/')) {
      hashPath = u.hash.slice(1)
    }
  } catch {
    // Fall back to raw url string if not a standard absolute URL
    pathname = url || ''
  }

  const cleanPath = (p: string) => {
    let result = p.split('?')[0].split('#')[0]
    if (result.startsWith('/')) result = result.substring(1)
    if (result.endsWith('/')) result = result.slice(0, -1)
    return result
  }

  const effectivePath = hashPath && hashPath !== '/' && hashPath !== '' ? cleanPath(hashPath) : cleanPath(pathname)

  for (const key of Object.keys(registryObj)) {
    const pageConfig = registryObj[key]
    if (pageConfig && pageConfig.url) {
      let configUrl = pageConfig.url
      if (configUrl.startsWith('/')) configUrl = configUrl.substring(1)
      if (configUrl.endsWith('/')) configUrl = configUrl.slice(0, -1)
      if (configUrl === effectivePath) {
        const isCodegen = key.startsWith('codegen_') || key === 'codegenPage'
        if (!overrideMode && !isCodegen) continue
        if (!effectivePath && isCodegen) continue
        return key
      }
    }
  }

  let keyBase = ''
  if (effectivePath) {
    const segments = effectivePath.split('/').filter(Boolean)
    keyBase = segments
      .map((seg, idx) => {
        const parts = seg.split(/[^a-zA-Z0-9]+/).filter(Boolean)
        if (parts.length === 0) return ''
        return parts
          .map((part, partIdx) => {
            if (idx === 0 && partIdx === 0) {
              return part.charAt(0).toLowerCase() + part.slice(1)
            }
            return part.charAt(0).toUpperCase() + part.slice(1)
          })
          .join('')
      })
      .join('')
  }
  if (!keyBase && title) {
    const firstSegment = title.split(/[|\u2014\-:]/)[0].trim()
    const cleanTitle = (firstSegment || title).replace(/[^a-zA-Z0-9\s]/g, '').trim()
    const words = cleanTitle.split(/\s+/).filter(Boolean)
    keyBase = words
      .map((w, idx) => {
        const clean = w.replace(/[^a-zA-Z0-9]/g, '')
        if (idx === 0) return clean.charAt(0).toLowerCase() + clean.slice(1)
        return clean.charAt(0).toUpperCase() + clean.slice(1)
      })
      .join('')
  }
  if (!keyBase) {
    keyBase = 'home'
  }

  if (overrideMode) {
    return keyBase
  }
  return `codegen_${keyBase}`
}

/**
 * Searches a registry dictionary or array for a matching value.
 */
export function findMatchInDict(
  val: string,
  strategyType: string,
  pageKey: string,
  registryObj: RegistryRoot,
  overrideMode?: boolean
): MatchResult | null {
  const getExpandedKey = (dynamicKey: string, placeholder: string, value: string) => {
    const isPurePlaceholder = dynamicKey === `{${placeholder}}`
    let capValue = ''
    if (isPurePlaceholder) {
      capValue = value
    } else {
      const words = value.split(/[^a-zA-Z0-9]/).filter(Boolean)
      capValue = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('')
    }
    return dynamicKey.replace(`{${placeholder}}`, capValue)
  }

  let targetPageKey = pageKey
  for (const k of Object.keys(registryObj)) {
    if (normalizePageKey(k) === normalizePageKey(pageKey)) {
      targetPageKey = k
      break
    }
  }
  const pageConfig = registryObj[targetPageKey] || {}

  const searchConfig = (config: RegistryPageConfig, pk: string): MatchResult | null => {
    if (strategyType === 'testId') {
      const dict = config.testId || config.testIds || {}
      for (const k of Object.keys(dict)) {
        const entry = dict[k]
        if (typeof entry === 'object' && entry !== null) {
          const { matches, matchedValue, placeholderName } = matchDynamicEntry(val, entry, true)
          if (matches && matchedValue && placeholderName) {
            const arr = entry[placeholderName] || []
            if (!arr.includes(matchedValue)) {
              entry[placeholderName] = [...arr, matchedValue]
            }
            const expandedKey = getExpandedKey(k, placeholderName, matchedValue)
            return { pageKey: pk, elementKey: expandedKey, val, type: 'testId', isNew: false }
          }
        } else if (entry === val) {
          return { pageKey: pk, elementKey: k, val, type: 'testId', isNew: false }
        }
      }
    } else if (strategyType === 'selector') {
      const dict = config.selector || config.selectors || {}
      for (const k of Object.keys(dict)) {
        const entry = dict[k]
        if (typeof entry === 'object' && entry !== null) {
          const { matches, matchedValue, placeholderName } = matchDynamicEntry(val, entry, false)
          if (matches && matchedValue && placeholderName) {
            const arr = entry[placeholderName] || []
            if (!arr.includes(matchedValue)) {
              entry[placeholderName] = [...arr, matchedValue]
            }
            const expandedKey = getExpandedKey(k, placeholderName, matchedValue)
            return { pageKey: pk, elementKey: expandedKey, val, type: 'selector', isNew: false }
          }
        } else if (entry === val) {
          return { pageKey: pk, elementKey: k, val, type: 'selector', isNew: false }
        }
      }
    } else {
      const arr = config[strategyType]
      if (Array.isArray(arr)) {
        if (arr.includes(val)) {
          const elementKey = val
          return { pageKey: pk, elementKey, val, type: strategyType, isNew: false }
        }
      }
    }
    return null
  }

  const targetMatch = searchConfig(pageConfig, targetPageKey)
  if (targetMatch) return targetMatch

  for (const pk of Object.keys(registryObj)) {
    if (normalizePageKey(pk) === normalizePageKey(pageKey)) continue

    const isCurrentCodegen = pageKey.startsWith('codegen_') || pageKey === 'codegenPage'
    const isOtherCodegen = pk.startsWith('codegen_') || pk === 'codegenPage'
    if (isCurrentCodegen && isOtherCodegen) continue

    const config = registryObj[pk] || {}
    const match = searchConfig(config, pk)
    if (match) return match
  }

  return null
}

/**
 * Resolves a selector to an element key and page key in the registry.
 */
export function findElementKey(
  selector: string,
  pageKey: string,
  registryObj: RegistryRoot,
  overrideMode?: boolean,
  extra?: { targetTestId?: string; targetId?: string; targetParentId?: string; overrideType?: SelectorStrategyType }
): MatchResult {
  let { type, val } = getSelectorValue(selector)
  if (extra?.overrideType) {
    type = extra.overrideType
  }

  // 1. Try matching with the selector itself first
  const selectorMatch = findMatchInDict(val, type, pageKey, registryObj, overrideMode)
  if (selectorMatch) return selectorMatch

  // 1.5. Check if the value exists in ANY other strategy array/object under the page config to avoid duplicates and recreation
  const pageConfig = registryObj[pageKey] || {}
  for (const k of Object.keys(pageConfig)) {
    if (k === 'url') continue
    const match = findMatchInDict(val, k, pageKey, registryObj, overrideMode)
    if (match) {
      return match
    }
  }

  // 2. Try matching targetTestId (if any) against testIds in registry
  if (extra?.targetTestId) {
    const testIdMatch = findMatchInDict(extra.targetTestId, 'testId', pageKey, registryObj, overrideMode)
    if (testIdMatch) return testIdMatch
  }

  // 3. Try matching targetId (if any) against selectors/testIds
  if (extra?.targetId) {
    const idSelectorMatch = findMatchInDict(extra.targetId, 'selector', pageKey, registryObj, overrideMode)
    if (idSelectorMatch) return idSelectorMatch
    const idTestIdMatch = findMatchInDict(extra.targetId, 'testId', pageKey, registryObj, overrideMode)
    if (idTestIdMatch) return idTestIdMatch
  }

  // 4. Try matching targetParentId (if any) against selectors/testIds
  if (extra?.targetParentId) {
    const pIdSelectorMatch = findMatchInDict(extra.targetParentId, 'selector', pageKey, registryObj, overrideMode)
    if (pIdSelectorMatch) return pIdSelectorMatch
  }

  let baseKey = type === 'testId' || type === 'selector' ? toCamelCase(val) : val
  if (!baseKey) baseKey = 'element'

  let finalKey = baseKey
  let counter = 1
  const existingKeys = new Set<string>()
  for (const key of Object.keys(pageConfig)) {
    const entry = pageConfig[key]
    if (Array.isArray(entry)) {
      entry.forEach((v) => existingKeys.add(v))
    } else if (typeof entry === 'object' && entry !== null) {
      Object.keys(entry).forEach((k) => existingKeys.add(k))
    }
  }

  while (existingKeys.has(finalKey)) {
    finalKey = baseKey + counter
    counter++
  }

  return { pageKey, elementKey: finalKey, val, type, isNew: true }
}
