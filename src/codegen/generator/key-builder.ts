import { toRegistryKey } from '../key-utils'

/**
 * Derives a camelCase registry key from element text with optional role suffix.
 */
export function generateKeyFromText(text: string, role?: string): string {
  if (!text) return ''
  const roleSuffix = role === 'button' ? 'Btn' : undefined
  return toRegistryKey(text, { roleSuffix })
}

/**
 * Derives a camelCase key from a candidate's attribute or selector value.
 * E.g. data-parent-id="why-pw-core" → whyPwCore
 */
export function generateKeyFromCandidate(
  candidate: { strategy: string; selector: string; valueToScore?: string },
  role?: string
): string {
  const val = candidate.valueToScore || ''
  if (!val) return ''

  // For data-attribute, id, testId strategies — use the attribute value directly
  if (['dataAttribute', 'id', 'idAttribute', 'testId'].includes(candidate.strategy)) {
    return generateKeyFromText(val, role)
  }

  // For role/label/text — use the text value
  if (['role', 'label', 'text', 'placeholder', 'altText', 'title'].includes(candidate.strategy)) {
    return generateKeyFromText(val, role)
  }

  return ''
}
