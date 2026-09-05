import { Locator, expect as playwrightExpect, test } from '@playwright/test'
import { VerifyResolver } from './verify-chain'
import { LocatorTarget } from '../locators/resolver'
import { formatAssertionDescription } from '../utils/formatter'

type StepLocation = { file: string; line: number; column: number }

export async function verifyHidden(
  resolveLocator: VerifyResolver,
  target: LocatorTarget,
  options?: Parameters<ReturnType<typeof playwrightExpect<Locator>>['toBeHidden']>[0] & {
    nth?: number
    hasText?: string | RegExp
    message?: string
  },
  location?: StepLocation
): Promise<void> {
  const stepName = options?.message ?? formatAssertionDescription(target, 'toBeHidden', false, [options])
  await test.step(
    stepName,
    async () => {
      const locator = resolveLocator(target, {
        nth: options?.nth,
        hasText: options?.hasText
      })
      await playwrightExpect(locator, stepName).toBeHidden(options)
    },
    { box: true, location }
  )
}

export async function verifyEnabled(
  resolveLocator: VerifyResolver,
  target: LocatorTarget,
  options?: Parameters<ReturnType<typeof playwrightExpect<Locator>>['toBeEnabled']>[0] & {
    nth?: number
    hasText?: string | RegExp
    message?: string
  },
  location?: StepLocation
): Promise<void> {
  const stepName = options?.message ?? formatAssertionDescription(target, 'toBeEnabled', false, [options])
  await test.step(
    stepName,
    async () => {
      const locator = resolveLocator(target, {
        nth: options?.nth,
        hasText: options?.hasText
      })
      await playwrightExpect(locator, stepName).toBeEnabled(options)
    },
    { box: true, location }
  )
}

export async function verifyDisabled(
  resolveLocator: VerifyResolver,
  target: LocatorTarget,
  options?: Parameters<ReturnType<typeof playwrightExpect<Locator>>['toBeDisabled']>[0] & {
    nth?: number
    hasText?: string | RegExp
    message?: string
  },
  location?: StepLocation
): Promise<void> {
  const stepName = options?.message ?? formatAssertionDescription(target, 'toBeDisabled', false, [options])
  await test.step(
    stepName,
    async () => {
      const locator = resolveLocator(target, {
        nth: options?.nth,
        hasText: options?.hasText
      })
      await playwrightExpect(locator, stepName).toBeDisabled(options)
    },
    { box: true, location }
  )
}
