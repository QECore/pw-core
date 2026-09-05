import type { Page } from '@playwright/test'
import { LocatorCandidate } from '../types'
import { scanElementInBrowser, domScannerPayload } from './dom-scanner'
import { scoreAndRankCandidates } from './candidate-scorer'
import { validateAndSelectLocator } from './locator.validator'

export { isStableId } from './id-stability'
export { generateKeyFromText, generateKeyFromCandidate } from './key-builder'
export { validateAndSelectLocator } from './locator.validator'
export { normalizeActionName } from './action.validator'

/**
 * Evaluates the element at `selector` inside the page, scans candidate locators across the DOM tree,
 * scores and ranks them based on priority, stability, semantics, and uniqueness, and returns the best candidate.
 */
export async function generateSmartLocator(page: Page, selector: string): Promise<LocatorCandidate | null> {
  if (!selector) return null

  const locator = page.locator(selector)
  const count = await locator.count().catch(() => 0)
  if (count === 0) return null

  // Evaluate candidate collection and DOM context extraction inside the browser page
  const scanResult = await locator
    .first()
    .evaluate(scanElementInBrowser, domScannerPayload, { timeout: 1000 })
    .catch(() => null)

  if (!scanResult || !scanResult.candidates || scanResult.candidates.length === 0) {
    return null
  }

  // Score, penalize, and rank candidates on Node.js side
  const sorted = await scoreAndRankCandidates(page, scanResult)

  const assignExtraAttrs = (c: LocatorCandidate) => {
    if (c) {
      c.targetTestId = scanResult.targetTestId
      c.targetId = scanResult.targetId
      c.targetParentId = scanResult.targetParentId
    }
    return c
  }

  let decidedCandidate: LocatorCandidate | undefined = sorted.find((c) => c.unique && c.source === 'target')
  let isUnique = true

  if (!decidedCandidate) {
    decidedCandidate = sorted.find((c) => c.source === 'target') || sorted[0]
    isUnique = false
  }

  if (decidedCandidate) {
    const validated = validateAndSelectLocator(decidedCandidate, sorted, scanResult.targetText)
    if (validated !== decidedCandidate) {
      decidedCandidate = validated
      isUnique = validated.unique
    }
  }

  if (decidedCandidate) {
    if (!isUnique) {
      if (!decidedCandidate.selector.includes('>> nth=')) {
        decidedCandidate.selector = `${decidedCandidate.selector} >> nth=0`
        decidedCandidate.locator = `${decidedCandidate.locator}.first()`
      }
    }
    return assignExtraAttrs(decidedCandidate)
  }

  return null
}
