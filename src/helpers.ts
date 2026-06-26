import { Page, test } from '@playwright/test';
import { getCallerLocation } from './page/utils/caller-location';

/** Read a value from the browser's localStorage. Returns null if the key is absent. */
export async function getLocalStorage(page: Page, key: string): Promise<string | null> {
  return test.step(`Get localStorage "${key}"`, async () => {
    return page.evaluate((k) => localStorage.getItem(k), key);
  }, { box: true, location: getCallerLocation() });
}

/** Write a value to the browser's localStorage. */
export async function setLocalStorage(page: Page, key: string, value: string): Promise<void> {
  await test.step(`Set localStorage "${key}"`, async () => {
    await page.evaluate(([k, v]) => localStorage.setItem(k, v), [key, value]);
  }, { box: true, location: getCallerLocation() });
}

/** Read a value from the browser's sessionStorage. Returns null if the key is absent. */
export async function getSessionStorage(page: Page, key: string): Promise<string | null> {
  return test.step(`Get sessionStorage "${key}"`, async () => {
    return page.evaluate((k) => sessionStorage.getItem(k), key);
  }, { box: true, location: getCallerLocation() });
}

/** Write a value to the browser's sessionStorage. */
export async function setSessionStorage(page: Page, key: string, value: string): Promise<void> {
  await test.step(`Set sessionStorage "${key}"`, async () => {
    await page.evaluate(([k, v]) => sessionStorage.setItem(k, v), [key, value]);
  }, { box: true, location: getCallerLocation() });
}

/**
 * Seeds sessionStorage entries via addInitScript before any navigation.
 * Only runs when authenticated cookies are present (loaded from storageState),
 * so unauthenticated tests that clear storageState are unaffected.
 */
export async function seedSessionStorage(page: Page, entries: Record<string, string>): Promise<void> {
  const cookies = await page.context().cookies();
  if (cookies.length > 0) {
    const pairs = Object.entries(entries);
    await test.step('Seed sessionStorage', async () => {
      await page.addInitScript((items: Array<[string, string]>) => {
        for (const [key, value] of items) {
          sessionStorage.setItem(key, value);
        }
      }, pairs);
    }, { box: true, location: getCallerLocation() });
  }
}
