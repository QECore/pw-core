import type { Page } from '@playwright/test'
import { getPriorityScore } from '../scorer'
import { LocatorCandidate } from '../types'
import {
  decorativeList,
  isRestrictedClass,
  PATTERNS,
  stateClasses
} from './locator.restricted'
import { isStableId } from './id-stability'
import { generateKeyFromText, generateKeyFromCandidate } from './key-builder'
import type { DomScanResult } from './dom-scanner'

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[-_\s]/g, '')
    .replace(/[^\w]/g, '')
}

/**
 * Transforms raw scanned candidates into fully scored and uniqueness-validated LocatorCandidates.
 */
export async function scoreAndRankCandidates(
  page: Page,
  scanResult: DomScanResult
): Promise<LocatorCandidate[]> {
  const targetNormalized = normalize(scanResult.targetText || scanResult.targetAccessibleName || '')
  const candidates: LocatorCandidate[] = []

  for (const c of scanResult.candidates) {
    const val = c.valueToScore || ''
    const valLower = val.toLowerCase()

    // No long values more than 50 chars
    if (val.length > 50) {
      continue
    }

    // Reject unstable text
    if (c.strategy === 'text') {
      if (
        Object.values(PATTERNS.restrictedTexts).some((keyword) => valLower.includes(keyword)) ||
        val.length > 40
      ) {
        continue
      }
    }

    // Calculate priority
    const priorityScore = getPriorityScore(c)

    // Calculate Proximity Bonus
    let proximityScore = 0
    if (c.source === 'target') proximityScore = 300
    else if (c.source === 'child') proximityScore = 250
    else if (c.source === 'sibling') proximityScore = 250
    else if (c.source === 'parent') proximityScore = 200
    else if (c.source === 'ancestor') {
      if (c.depth === 1) proximityScore = 150 // Grandparent
      else proximityScore = 100 // Ancestor depth 3
    }

    // Calculate Similarity Bonus
    const candidateNormalized = normalize(val)
    const similarityScore = targetNormalized && targetNormalized === candidateNormalized ? 200 : 0

    // Calculate Semantic Bonus
    let semanticScore = 0
    if (/[a-zA-Z]/.test(valLower)) {
      const hasHyphen = valLower.includes('-')
      const hasUnderscore = valLower.includes('_')
      const hasCamelCase = /[a-z][A-Z]/.test(val)
      const wordsCount = valLower.split(/[-_\s]+/).filter(Boolean).length
      if (hasHyphen || hasUnderscore || hasCamelCase || wordsCount > 1) {
        semanticScore = 100
      }
    }

    // Calculate Accessibility Bonus
    const accessibilityBonus = c.strategy === 'label' || c.strategy === 'ariaLabel' ? 150 : 0

    // Calculate Stability Bonus
    const isStable =
      c.strategy === 'testId' ||
      (c.strategy === 'id' && isStableId(val)) ||
      (c.strategy === 'dataAttribute' &&
        (c.attrName === 'data-page' ||
          c.attrName === 'data-section' ||
          c.attrName === 'data-parent-id' ||
          c.attrName === 'data-test-id' ||
          c.attrName === 'data-testid' ||
          c.attrName === 'datatestid'))
    const stabilityBonus = isStable ? 100 : 0

    // Calculate Penalties
    let penalties = 0
    if (c.strategy === 'role' && !c.selector.includes('name=')) {
      penalties += 350 // penalize role without name so placeholder/label/text are preferred
    }
    if (c.strategy === 'id' && !isStableId(val)) {
      penalties += 600 // heavily penalize unstable IDs so they rank below semantic locators
    }
    if (c.strategy === 'class') {
      if (isRestrictedClass(val)) penalties += 1000
      if (stateClasses.includes(valLower)) penalties += 1000
      if (/^[A-Z]/.test(val)) penalties += 1000
    }
    const hasDecorative = decorativeList.some(
      (item) => valLower.includes(item) || c.selector.toLowerCase().includes(item)
    )
    if (hasDecorative) {
      penalties += 500
    }
    if (['true', 'false', '0', '1'].includes(valLower)) {
      penalties += 500
    }
    const isUuid =
      new RegExp(PATTERNS.unstableIdentifiers.uuidPattern, 'i').test(valLower) ||
      new RegExp(PATTERNS.unstableIdentifiers.numericPattern).test(valLower) ||
      new RegExp(PATTERNS.unstableIdentifiers.hexHashPattern, 'i').test(valLower) ||
      new RegExp(PATTERNS.unstableIdentifiers.longAlphaNumPattern, 'i').test(valLower)
    if (isUuid) {
      penalties += 500
    }

    candidates.push({
      selector: c.selector,
      locator: c.locator,
      source: c.source,
      strategy: c.strategy,
      depth: c.depth,
      baseScore: priorityScore,
      semanticScore,
      proximityScore,
      similarityScore,
      uniquenessScore: 0,
      contextScore: proximityScore,
      totalScore: 0,
      unique: false,
      valueToScore: c.valueToScore,
      attrName: c.attrName,
      accessibilityBonus,
      stabilityBonus,
      penalties
    })
  }

  // Verify uniqueness and assign final score
  for (const c of candidates) {
    try {
      const count = await page.locator(c.selector).count()
      c.unique = count === 1
    } catch {
      // If counting selector fails or times out, mark as non-unique
      c.unique = false
    }
    c.uniquenessScore = c.unique ? 0 : -500

    // final score calculation
    c.totalScore =
      c.baseScore +
      c.proximityScore +
      c.semanticScore +
      c.similarityScore +
      (c.accessibilityBonus || 0) +
      (c.stabilityBonus || 0) +
      c.uniquenessScore -
      (c.penalties || 0)

    // Generate key for registry
    let generatedKey = ''
    const isInputEl = ['input', 'textarea', 'select'].includes(scanResult.targetTagName)
    if (isInputEl) {
      const testIdCand = candidates.find((cand) => cand.strategy === 'testId')
      if (testIdCand && testIdCand.valueToScore) {
        generatedKey = generateKeyFromText(testIdCand.valueToScore, scanResult.targetRole)
      } else if (scanResult.targetName) {
        generatedKey = generateKeyFromText(scanResult.targetName, scanResult.targetRole)
      } else if (scanResult.targetType) {
        generatedKey = generateKeyFromText(scanResult.targetType + 'Input', scanResult.targetRole)
      } else {
        generatedKey = scanResult.targetTagName + 'Input'
      }
    } else {
      const visibleText = scanResult.targetAccessibleName || scanResult.targetText || ''
      if (visibleText && visibleText.trim().length > 0 && visibleText.length <= 50) {
        generatedKey = generateKeyFromText(visibleText.trim(), scanResult.targetRole)
      } else {
        generatedKey = generateKeyFromCandidate(c, scanResult.targetRole)
      }
    }
    c.generatedKey = generatedKey
    c.nearbyText = scanResult.targetText
    c.accessibleName = scanResult.targetAccessibleName
  }

  // If a stable unique candidate exists, heavily penalize unstable candidates to prioritize the stable ones
  const hasStableUnique = candidates.some(
    (c) =>
      c.unique &&
      (c.strategy === 'testId' ||
        (c.strategy === 'id' && isStableId(c.valueToScore || '')) ||
        (c.strategy === 'dataAttribute' &&
          (c.attrName === 'data-parent-id' ||
            c.attrName === 'data-test-id' ||
            c.attrName === 'data-testid' ||
            c.attrName === 'datatestid')))
  )

  if (hasStableUnique) {
    for (const c of candidates) {
      const isCandidateStable =
        c.strategy === 'testId' ||
        (c.strategy === 'id' && isStableId(c.valueToScore || '')) ||
        (c.strategy === 'dataAttribute' &&
          (c.attrName === 'data-parent-id' ||
            c.attrName === 'data-test-id' ||
            c.attrName === 'data-testid' ||
            c.attrName === 'datatestid'))
      if (!isCandidateStable) {
        c.totalScore -= 600
      }
    }
  }

  return candidates.sort((a, b) => b.totalScore - a.totalScore)
}
