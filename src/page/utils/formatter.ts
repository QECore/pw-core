import { Locator } from '@playwright/test'

type Stringifiable = { toString(): string }

function isStringifiable(value: unknown): value is Stringifiable {
  return typeof value === 'object' && value !== null && typeof (value as Stringifiable).toString === 'function'
}

export function formatTarget(target: unknown): string {
  if (typeof target === 'string') return target
  if (isStringifiable(target)) {
    return target.toString().replace(/^Locator@/, '')
  }
  return 'locator'
}

export function formatStepDescription(methodName: string, target: unknown, args: readonly unknown[]): string {
  const targetStr = formatTarget(target)
  if (methodName === 'fill' && args[0] !== undefined) {
    const options = args[1]
    let shouldMask = false
    if (options && typeof options === 'object' && 'mask' in options && options.mask !== undefined) {
      shouldMask = options.mask === true
    } else {
      const targetStrLower = targetStr.toLowerCase()
      shouldMask = targetStrLower.includes('pass') || targetStrLower.includes('pw')
    }
    const displayValue = shouldMask ? '*'.repeat(String(args[0]).length) : args[0]
    return `Fill "${targetStr}" with "${displayValue}"`
  }
  if (methodName === 'click') return `Click "${targetStr}"`
  if (methodName === 'dblclick') return `Double-click "${targetStr}"`
  if (methodName === 'dragTo') return `Drag "${targetStr}" to "${formatTarget(args[0])}"`
  if (methodName === 'check') return `Check "${targetStr}"`
  if (methodName === 'uncheck') return `Uncheck "${targetStr}"`

  const formattedMethod = methodName.charAt(0).toUpperCase() + methodName.slice(1)
  const cleanArgs = args
    .filter((a) => typeof a === 'string' || typeof a === 'number')
    .map((a) => `"${a}"`)
    .join(', ')
  return `${formattedMethod} "${targetStr}"${cleanArgs ? ' with ' + cleanArgs : ''}`
}

export function formatAssertionDescription(
  target: unknown,
  matcherName: string,
  isNegated: boolean,
  args: readonly unknown[]
): string {
  const targetStr = formatTarget(target)
  const prefix = `Verify "${targetStr}"`
  const matcherMap: Record<string, string> = {
    toBeVisible: isNegated ? 'is not visible' : 'is visible',
    toBeHidden: isNegated ? 'is not hidden' : 'is hidden',
    toBeEnabled: isNegated ? 'is not enabled' : 'is enabled',
    toBeDisabled: isNegated ? 'is not disabled' : 'is disabled',
    toBeChecked: isNegated ? 'is not checked' : 'is checked',
    toHaveText: (isNegated ? 'does not have text "' : 'has text "') + args.map((a) => String(a)).join(', ') + '"',
    toContainText: (isNegated ? 'does not contain "' : 'contains "') + args.map((a) => String(a)).join(', ') + '"',
    toHaveCount: (isNegated ? 'does not have count of "' : 'has count of "') + args[0] + '"'
  }
  return `${prefix} ${matcherMap[matcherName] || `${isNegated ? 'not ' : ''}${matcherName}`}`
}
