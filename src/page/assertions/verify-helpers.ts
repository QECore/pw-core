import { Locator, expect as playwrightExpect, test } from '@playwright/test';
import { formatAssertionDescription } from '../utils/formatter';

export async function verifyHidden(
  resolveLocator: (target: any, options?: { nth?: number; hasText?: string | RegExp; raw?: boolean }) => Locator,
  target: any,
  options?: Parameters<ReturnType<typeof playwrightExpect<Locator>>['toBeHidden']>[0] & { nth?: number; hasText?: string | RegExp; message?: string }
): Promise<void> {
  const stepName = options?.message ?? formatAssertionDescription(target, 'toBeHidden', false, [options]);
  await test.step(stepName, async () => {
    const locator = resolveLocator(target, { nth: options?.nth, hasText: options?.hasText });
    await playwrightExpect(locator, stepName).toBeHidden(options);
  });
}

export async function verifyEnabled(
  resolveLocator: (target: any, options?: { nth?: number; hasText?: string | RegExp; raw?: boolean }) => Locator,
  target: any,
  options?: Parameters<ReturnType<typeof playwrightExpect<Locator>>['toBeEnabled']>[0] & { nth?: number; hasText?: string | RegExp; message?: string }
): Promise<void> {
  const stepName = options?.message ?? formatAssertionDescription(target, 'toBeEnabled', false, [options]);
  await test.step(stepName, async () => {
    const locator = resolveLocator(target, { nth: options?.nth, hasText: options?.hasText });
    await playwrightExpect(locator, stepName).toBeEnabled(options);
  });
}

export async function verifyDisabled(
  resolveLocator: (target: any, options?: { nth?: number; hasText?: string | RegExp; raw?: boolean }) => Locator,
  target: any,
  options?: Parameters<ReturnType<typeof playwrightExpect<Locator>>['toBeDisabled']>[0] & { nth?: number; hasText?: string | RegExp; message?: string }
): Promise<void> {
  const stepName = options?.message ?? formatAssertionDescription(target, 'toBeDisabled', false, [options]);
  await test.step(stepName, async () => {
    const locator = resolveLocator(target, { nth: options?.nth, hasText: options?.hasText });
    await playwrightExpect(locator, stepName).toBeDisabled(options);
  });
}
