import { LocatorCandidate } from '../types'

/**
 * Validates if the selected candidate has a partial of the target element's text.
 * If target element has text, splits the text into words/partials.
 * Checks if candidate.locator or candidate.selector contains any of these words (case-insensitive).
 * If it doesn't, we should choose the text strategy instead.
 */
export function validateAndSelectLocator(
  candidate: LocatorCandidate,
  candidates: LocatorCandidate[],
  targetText: string
): LocatorCandidate {
  if (!targetText) {
    return candidate
  }

  // Parse words/partials from the target element's text
  // Lowercase, split by whitespace, and remove non-alphanumeric characters
  const words = targetText
    .toLowerCase()
    .split(/\s+/)
    .map(w => w.replace(/[^\w]/g, ''))
    .filter(Boolean)

  if (words.length === 0) {
    return candidate
  }

  // Check if candidate locator or selector contains any of these words
  const locatorLower = (candidate.locator || '').toLowerCase()
  const selectorLower = (candidate.selector || '').toLowerCase()
  
  const matches = words.some(word => locatorLower.includes(word) || selectorLower.includes(word))

  if (matches) {
    return candidate
  }

  // Else you have to choose the text as your locator strategy
  // Find the text candidate that targets the element directly (source === 'target')
  const textCandidate = candidates.find(c => c.strategy === 'text' && c.source === 'target')
  if (textCandidate) {
    return textCandidate
  }

  return candidate
}
