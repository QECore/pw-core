import { Locator, expect as playwrightExpect } from '@playwright/test';

export function typedExpect(resolved: Locator, message?: string): ReturnType<typeof playwrightExpect<Locator>> {
  return playwrightExpect(resolved, message);
}
