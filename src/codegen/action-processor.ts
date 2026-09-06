import type { Page } from '@playwright/test'
import { extractNthFromSelector } from './selector-parser'
import { findPageKey, findElementKey, type MatchResult } from './registry-matcher'
import { generateSmartLocator } from './generator/index'
import { normalizeActionName } from './generator/action.validator'
import type { LocatorCandidate, RegistryRoot } from './types'
import type { RecordedAction } from './action-formatter'

export interface ProcessedAction {
  pageKey: string
  elementKey: string
  action: RecordedAction & { selector: string }
  matchResult: MatchResult | null
  smartLocator: LocatorCandidate | null
}

/**
 * Checks if a selector points to pw-core's floating recorder panel.
 */
export async function isOwnPanelSelector(page: Page, selector?: string): Promise<boolean> {
  if (!selector) return false
  const lowerSel = selector.toLowerCase()
  if (
    lowerSel.includes('pw-core') ||
    lowerSel.includes('pwcore') ||
    lowerSel.includes('new test') ||
    lowerSel.includes('add serial') ||
    lowerSel.includes('new-serial') ||
    lowerSel.includes('new-test')
  ) {
    return true
  }
  try {
    return await page
      .locator(selector)
      .evaluate((element) => {
        const el = element as HTMLElement
        return el.id === 'pw-core-codegen-panel' || el.closest('#pw-core-codegen-panel') !== null
      }, null, { timeout: 500 })
      .catch(() => false)
  } catch {
    // Return false if element evaluation throws or disconnected
    return false
  }
}

/**
 * Resolves a recorded action to its matching page key, element key, and registry match details.
 */
export async function processRecordedAction(
  page: Page,
  rawAction: RecordedAction & { selector: string },
  currentUrl: string,
  currentTitle: string,
  registryObj: RegistryRoot,
  overrideMode: boolean
): Promise<ProcessedAction | null> {
  const action = { ...rawAction }
  action.name = await normalizeActionName(page, action.selector, action.name)

  if (action.name === 'openPage' || action.name === 'closePage') {
    return null
  }

  if (await isOwnPanelSelector(page, action.selector)) {
    return null
  }

  let pageKey = findPageKey(currentUrl, currentTitle, registryObj, overrideMode)
  if (!registryObj[pageKey]) {
    let effectiveUrl = '/'
    try {
      const u = new URL(currentUrl)
      const hash = u.hash && u.hash.startsWith('#/') ? u.hash.slice(1) : ''
      const targetUrl = hash && hash !== '/' ? hash : u.pathname
      const clean = targetUrl.split('?')[0].split('#')[0]
      effectiveUrl = clean.startsWith('/') ? clean : '/' + clean
    } catch {
      // Fall back to default root path '/' if URL is malformed or relative
    }
    registryObj[pageKey] = { url: effectiveUrl }
  }

  let elementKey = 'element'
  let matchResult: MatchResult | null = null
  let smartLocator: LocatorCandidate | null = null

  if (action.selector) {
    let selectorToUse = action.selector
    smartLocator = await generateSmartLocator(page, action.selector)
    if (smartLocator) {
      selectorToUse = smartLocator.selector
    }

    const parsed = extractNthFromSelector(selectorToUse)
    selectorToUse = parsed.baseSelector
    if (parsed.nth !== undefined) {
      action.nth = parsed.nth
    }

    matchResult = findElementKey(selectorToUse, pageKey, registryObj, overrideMode, {
      targetTestId: smartLocator?.targetTestId,
      targetId: smartLocator?.targetId,
      targetParentId: smartLocator?.targetParentId,
      overrideType: action.name === 'check' || action.name === 'uncheck' ? 'checkbox' : undefined
    })
    pageKey = matchResult.pageKey
    elementKey = matchResult.elementKey

    // Use context-aware generatedKey if it produced a better name and the match is new
    if (
      matchResult.isNew &&
      (matchResult.type === 'testId' || matchResult.type === 'selector') &&
      smartLocator?.generatedKey &&
      smartLocator.generatedKey.length > 2
    ) {
      const proposedKey = smartLocator.generatedKey
      const targetConfig = registryObj[pageKey]
      const existingKeys = new Set([
        ...Object.keys(targetConfig?.testId || {}),
        ...Object.keys(targetConfig?.testIds || {}),
        ...Object.keys(targetConfig?.selector || {}),
        ...Object.keys(targetConfig?.selectors || {})
      ])
      if (!existingKeys.has(proposedKey)) {
        elementKey = proposedKey
      }
    }
  }

  return {
    pageKey,
    elementKey,
    action,
    matchResult,
    smartLocator
  }
}
