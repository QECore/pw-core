/**
 * Key creation utilities for codegen-generated registry keys.
 *
 * Rules:
 * - Custom keys (testId, selector) are always camelCase
 * - No spaces, hyphens, or special characters
 * - Leading digits are trimmed
 * - Trailing digits are preserved (they may be disambiguation suffixes)
 * - Role suffixes (Btn, Input) are appended after sanitization
 */

/**
 * Convert an arbitrary string into a clean camelCase registry key.
 *
 * @example
 * toRegistryKey('GET api/app/projects List all projects') => 'getApiAppProjectsListAllProjects'
 * toRegistryKey('01Dynamic-Locators') => 'dynamicLocators'
 * toRegistryKey('POST api/app/projects Create-a-project') => 'postApiAppProjectsCreateAProject'
 * toRegistryKey('switch-to-k6-core') => 'switchToK6Core'
 * toRegistryKey('hello world') => 'helloWorld'
 */
export function toRegistryKey(str: string, options?: { roleSuffix?: string }): string {
  if (!str) return 'element'

  // Strip all non-alphanumeric characters except spaces (used as word separators)
  // First, normalize common separators (hyphens, underscores, slashes, dots) to spaces
  let normalized = str
    .replace(/[-_/\\.]+/g, ' ')
    // Remove any remaining special characters (keep letters, digits, spaces)
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()

  if (!normalized) return 'element'

  // Split into words on whitespace and camelCase boundaries
  const words = normalized
    .replace(/([a-z])([A-Z])/g, '$1 $2') // split camelCase
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2') // split consecutive uppercase
    .split(/\s+/)
    .filter(Boolean)

  if (words.length === 0) return 'element'

  // Build camelCase
  const camel = words
    .map((word, idx) => {
      if (idx === 0) return word.toLowerCase()
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join('')

  // Trim leading digits and ensure first char is lowercase
  let result = camel.replace(/^\d+/, '')
  if (!result) return 'element'
  result = result.charAt(0).toLowerCase() + result.slice(1)

  // Append role suffix if requested (e.g. 'Btn' for buttons)
  if (options?.roleSuffix) {
    const lowerResult = result.toLowerCase()
    const lowerSuffix = options.roleSuffix.toLowerCase()
    if (!lowerResult.endsWith(lowerSuffix)) {
      result += options.roleSuffix
    }
  }

  // Hard cap at 40 characters
  if (result.length > 40) result = result.slice(0, 40)

  return result
}

/**
 * Formats a worker fixture prefix for page keys.
 *
 * @example
 * toWorkerKey('loginPage') => 'workerLoginPage'
 * toWorkerKey('workerLoginPage') => 'workerLoginPage'
 */
export function toWorkerKey(key: string): string {
  if (key.startsWith('worker')) return key
  return `worker${key.charAt(0).toUpperCase()}${key.slice(1)}`
}

/**
 * Strips the worker prefix and lowercases the initial character.
 *
 * @example
 * toUnprefixedPageKey('workerLoginPage') => 'loginPage'
 * toUnprefixedPageKey('loginPage') => 'loginPage'
 */
export function toUnprefixedPageKey(key: string): string {
  if (key.startsWith('worker') && key.length > 6) {
    return key.slice(6).charAt(0).toLowerCase() + key.slice(7)
  }
  return key
}
