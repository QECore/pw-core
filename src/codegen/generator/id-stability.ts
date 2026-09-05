/**
 * Checks whether an HTML element's ID attribute is stable and non-generated.
 * Filters out framework auto-generated IDs (React, MUI, HeadlessUI, Ember, Angular),
 * UUIDs, hashes, and purely numeric IDs.
 */
export function isStableId(id: string): boolean {
  if (!id) return false
  const lower = id.toLowerCase()

  // React/MUI/HeadlessUI/Ember auto-generated patterns
  if (lower.startsWith(':r') && /\d/.test(lower)) return false
  if (lower.startsWith('mui-')) return false
  if (lower.startsWith('headlessui-')) return false
  if (lower.startsWith('ember-')) return false
  if (lower.startsWith('ng-')) return false

  // UUID pattern
  const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
  if (uuidRegex.test(lower)) return false

  // Long hex hashes or random looking alpha-numeric (e.g. f4c2d91, 8d72b3ef)
  const hexHashRegex = /^[0-9a-f]{7,8}$/i
  if (hexHashRegex.test(lower)) return false

  // Purely numeric or ends with a long random number (e.g. button-12847291)
  if (/^\d+$/.test(lower)) return false
  if (/\d{5,}$/.test(lower)) return false

  return true
}
