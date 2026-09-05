import type { Page } from '@playwright/test'

/**
 * Normalizes action name to ensure check/uncheck are only used on checkboxes.
 * Otherwise, falls back to click.
 */
export async function normalizeActionName(page: Page, selector: string, actionName: string): Promise<string> {
  if (actionName !== 'check' && actionName !== 'uncheck') {
    return actionName
  }

  if (!selector) {
    return 'click'
  }

  try {
    const isCheckbox = await page.locator(selector).evaluate((element) => {
      const el = element as HTMLInputElement
      return el.tagName.toLowerCase() === 'input' && el.type === 'checkbox'
    }, null, { timeout: 500 }).catch(() => false)

    if (!isCheckbox) {
      return 'click'
    }
  } catch (e) {
    return 'click'
  }

  return actionName
}
