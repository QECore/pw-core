import type { Page } from '@playwright/test'
import { LocatorCandidate } from './types'

export async function checkUniqueness(page: Page, candidates: LocatorCandidate[]): Promise<LocatorCandidate[]> {
  for (const candidate of candidates) {
    try {
      const count = await page.locator(candidate.selector).count()
      candidate.unique = count === 1
    } catch (e) {
      candidate.unique = false
    }
  }
  return candidates
}
