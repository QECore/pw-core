import type { SelectorStrategyType } from './types'

export interface SelectorMatch {
  type: SelectorStrategyType
  val: string
}

/**
 * Parses a Playwright or CSS selector string and extracts its semantic strategy type and value.
 */
export function getSelectorValue(selector: string): SelectorMatch {
  // 1. Try to find data-testid first
  const testIdRegexes = [
    /internal:testid=\[data-testid="([^"]+)"[si]?\]/,
    /data-testid="([^"]+)"[si]?/,
    /\[data-testid="([^"]+)"[si]?\]/,
    /data-testid=([^\[\]\s]+)/
  ]
  for (const regex of testIdRegexes) {
    const match = selector.match(regex)
    if (match) {
      let val = match[1]
      val = val.replace(/^["']|["']$/g, '')
      return { type: 'testId', val }
    }
  }

  // 2. Playwright getByRole
  const roleRegex = /internal:role=([a-zA-Z0-9_-]+)\[name="([^"]+)"i?\]/
  const roleMatch = selector.match(roleRegex)
  if (roleMatch) {
    let type = roleMatch[1]
    if (type === 'img') type = 'altText'
    return { type: type as SelectorStrategyType, val: roleMatch[2] }
  }

  const roleSimpleRegex = /role=([a-zA-Z0-9_-]+)/
  const roleSimpleMatch = selector.match(roleSimpleRegex)
  if (roleSimpleMatch) {
    return { type: roleSimpleMatch[1] as SelectorStrategyType, val: roleSimpleMatch[1] }
  }

  // 3. Playwright getByLabel
  const labelRegex = /internal:label="([^"]+)"i?/
  const labelMatch = selector.match(labelRegex)
  if (labelMatch) {
    return { type: 'label', val: labelMatch[1] }
  }

  // 4. Playwright getByPlaceholder
  const placeholderRegexes = [
    /internal:placeholder="([^"]+)"i?/,
    /internal:attr=\[placeholder="([^"]+)"[si]?\]/
  ]
  for (const regex of placeholderRegexes) {
    const placeholderMatch = selector.match(regex)
    if (placeholderMatch) {
      return { type: 'placeholder', val: placeholderMatch[1] }
    }
  }

  // 5. Playwright getByAltText
  const altRegexes = [
    /internal:alt="([^"]+)"i?/,
    /internal:attr=\[alt="([^"]+)"[si]?\]/
  ]
  for (const regex of altRegexes) {
    const altMatch = selector.match(regex)
    if (altMatch) {
      return { type: 'altText', val: altMatch[1] }
    }
  }

  // 6. Playwright getByTitle
  const titleRegexes = [
    /internal:title="([^"]+)"i?/,
    /internal:attr=\[title="([^"]+)"[si]?\]/
  ]
  for (const regex of titleRegexes) {
    const titleMatch = selector.match(regex)
    if (titleMatch) {
      return { type: 'title', val: titleMatch[1] }
    }
  }

  // 7. Playwright getByText
  const textRegex = /(?:internal:text|text)="([^"]+)"i?/
  const textMatch = selector.match(textRegex)
  if (textMatch) {
    return { type: 'text', val: textMatch[1] }
  }

  const textSimpleRegex = /(?:internal:text|text)=([^"\s]+)/
  const textSimpleMatch = selector.match(textSimpleRegex)
  if (textSimpleMatch) {
    return { type: 'text', val: textSimpleMatch[1] }
  }

  // 8. Try to find ID selector
  const idRegexes = [/id=([a-zA-Z0-9_-]+)/, /#([a-zA-Z0-9_-]+)/]
  for (const regex of idRegexes) {
    const match = selector.match(regex)
    if (match) {
      return { type: 'selector', val: `#${match[1]}` }
    }
  }

  // 9. Try to find class selectors
  const classRegexes = [/\.([a-zA-Z0-9_-]+)/]
  for (const regex of classRegexes) {
    const match = selector.match(regex)
    if (match) {
      return { type: 'selector', val: `.${match[1]}` }
    }
  }

  // 10. Fallback to raw selector
  return { type: 'selector', val: selector }
}

/**
 * Extracts any `>> nth=N` or `>> first()` suffix from a Playwright selector.
 */
export function extractNthFromSelector(selector: string): {
  baseSelector: string
  nth?: number
} {
  const nthMatch = selector.match(/\s*>>\s*nth=(\d+)/i)
  if (nthMatch) {
    const baseSelector = selector.replace(/\s*>>\s*nth=\d+/i, '').trim()
    return { baseSelector, nth: parseInt(nthMatch[1], 10) }
  }
  if (selector.endsWith(' >> first()')) {
    const baseSelector = selector.substring(0, selector.length - ' >> first()'.length).trim()
    return { baseSelector, nth: 0 }
  }
  return { baseSelector: selector }
}
