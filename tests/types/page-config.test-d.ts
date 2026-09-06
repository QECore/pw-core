import { createPageConfig, createPageRegistry, type TypedPage, type PageKeys } from '../../src/page'

// ============================================================================
// 1. Valid Page Config Compilation
// ============================================================================

const validConfig = createPageConfig({
  url: '/dashboard',
  testId: {
    submitBtn: 'submit-button',
    userRow: 'user-row'
  },
  selector: {
    sidebar: '.main-sidebar'
  },
  button: ['Save', 'Cancel'] as const,
  textbox: ['Username', 'Password'] as const,
  checkbox: ['RememberMe'] as const
})

// Assert PageKeys<typeof validConfig> matches expected union
type ExpectedKeys = 'submitBtn' | 'userRow' | 'sidebar' | 'Save' | 'Cancel' | 'Username' | 'Password' | 'RememberMe'
type ActualKeys = PageKeys<typeof validConfig>
type AssertEqual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
const keysMatch: AssertEqual<ActualKeys, ExpectedKeys> = true

// ============================================================================
// 2. Valid Dynamic Locator Page Config
// ============================================================================

const validDynamicConfig = createPageConfig({
  url: '/items',
  testId: {
    '{status}{item}Card': {
      status: ['active', 'inactive'] as const,
      item: ['profile', 'settings'] as const,
      testId: 'status-item-card'
    }
  }
})

// Dynamic keys should be expanded into camelCase union
type ExpectedDynamicKeys = 'activeProfileCard' | 'activeSettingsCard' | 'inactiveProfileCard' | 'inactiveSettingsCard'
type ActualDynamicKeys = PageKeys<typeof validDynamicConfig>
const dynamicKeysMatch: AssertEqual<ActualDynamicKeys, ExpectedDynamicKeys> = true

// ============================================================================
// 3. Valid Page Registry Compilation & Fixture Inference
// ============================================================================

const testRunner = createPageRegistry({
  dashboard: validConfig,
  items: validDynamicConfig
})

export const { pages } = testRunner

testRunner('fixture inference check', async ({ dashboard, workerDashboard, items, workerItems }) => {
  type DashboardAssert = AssertEqual<typeof dashboard, TypedPage<typeof validConfig>>
  const dMatch: DashboardAssert = true

  type WorkerDashboardAssert = AssertEqual<typeof workerDashboard, TypedPage<typeof validConfig>>
  const wdMatch: WorkerDashboardAssert = true

  dashboard.click('Save')
  workerDashboard.click('Cancel')
  items.click('activeProfileCard')
  workerItems.click('inactiveSettingsCard')
})

// Check typed action calls on inferred page instance
declare const dashboardPage: TypedPage<typeof validConfig>

// Valid calls
dashboardPage.click('submitBtn')
dashboardPage.click('Save')
dashboardPage.fill('submitBtn', 'admin')
dashboardPage.check('submitBtn')
dashboardPage.chain('submitBtn.userRow')
dashboardPage.chain('sidebar.submitBtn.Save')
dashboardPage.chain('sidebar', 'submitBtn', 'Save')
dashboardPage.chain('sidebar', 'submitBtn', { nth: 1 })

// Strategy-specific options:
dashboardPage.click('Save', { exact: true })
dashboardPage.resolveLocator('submitBtn', { nth: 1 })

// ============================================================================
// 4. Type Negative Tests (@ts-expect-error assertions)
// ============================================================================

createPageConfig({
  url: '/invalid',
  // @ts-expect-error - Unknown configuration property should be rejected
  unknownStrategy: ['invalid']
})

createPageConfig({
  testId: {
    // @ts-expect-error - Duplicate key defined across both testId and selector should be rejected
    duplicateKey: 'test-id'
  },
  selector: {
    // @ts-expect-error - Duplicate key defined across both testId and selector should be rejected
    duplicateKey: '.selector'
  }
})

createPageConfig({
  testId: {
    // @ts-expect-error - Dynamic locator missing required placeholder array should be rejected
    '{name}Button': {
      testId: 'name-button'
    }
  }
})

createPageConfig({
  testId: {
    '{name}Button': {
      // @ts-expect-error - Dynamic locator with non-array placeholder value should be rejected
      name: 'single-string-not-array',
      testId: 'name-button'
    }
  }
})

// @ts-expect-error - Calling click on non-existent element key should be rejected
dashboardPage.click('nonExistentKey')

// @ts-expect-error - Invalid chain path should be rejected
dashboardPage.chain('nonExistentKey.userRow')

// @ts-expect-error - Argument-based chains must also start with a universal key
dashboardPage.chain('Save', 'submitBtn')

// @ts-expect-error - Every action still rejects unknown locator keys
dashboardPage.fill('nonExistentKey', 'admin')

// ============================================================================
// 5. Action IntelliSense Contracts
// ============================================================================

// Every action accepts configured keys and only its documented option shape.
dashboardPage.click('submitBtn', { button: 'right', nth: 1 })
dashboardPage.dblclick('submitBtn', { delay: 10 })
dashboardPage.hover('submitBtn', { position: { x: 1, y: 1 } })
dashboardPage.focus('submitBtn', { timeout: 100 })
dashboardPage.blur('submitBtn', { timeout: 100 })
dashboardPage.check('submitBtn', { force: true })
dashboardPage.uncheck('submitBtn', { force: true })
dashboardPage.clear('submitBtn', { timeout: 100 })
dashboardPage.waitFor('submitBtn', { state: 'visible' })
dashboardPage.isChecked('submitBtn', { timeout: 100 })
dashboardPage.isDisabled('submitBtn', { timeout: 100 })
dashboardPage.isVisible('submitBtn', { timeout: 100 })
dashboardPage.textContent('submitBtn', { timeout: 100 })
dashboardPage.innerText('submitBtn', { timeout: 100 })
dashboardPage.allInnerTexts('submitBtn')
dashboardPage.allTextContents('submitBtn')
dashboardPage.count('submitBtn')
dashboardPage.scrollIntoViewIfNeeded('submitBtn', { timeout: 100 })
dashboardPage.boundingBox('submitBtn')
dashboardPage.press('submitBtn', 'Enter', { delay: 10 })
dashboardPage.pressSequentially('submitBtn', 'text', { delay: 10 })
dashboardPage.selectOption('submitBtn', 'value', { timeout: 100 })
dashboardPage.setInputFiles('submitBtn', 'file.txt', { timeout: 100 })
dashboardPage.getAttribute('submitBtn', 'data-testid', { timeout: 100 })
dashboardPage.fill('submitBtn', 'text', { mask: true, timeout: 100 })
dashboardPage.dragTo('submitBtn', 'userRow', { timeout: 100 })

// Every action rejects free-form target strings.
// @ts-expect-error
dashboardPage.click('unknown')
// @ts-expect-error
dashboardPage.dblclick('unknown')
// @ts-expect-error
dashboardPage.hover('unknown')
// @ts-expect-error
dashboardPage.focus('unknown')
// @ts-expect-error
dashboardPage.blur('unknown')
// @ts-expect-error
dashboardPage.check('unknown')
// @ts-expect-error
dashboardPage.uncheck('unknown')
// @ts-expect-error
dashboardPage.clear('unknown')
// @ts-expect-error
dashboardPage.waitFor('unknown')
// @ts-expect-error
dashboardPage.isChecked('unknown')
// @ts-expect-error
dashboardPage.isDisabled('unknown')
// @ts-expect-error
dashboardPage.isVisible('unknown')
// @ts-expect-error
dashboardPage.textContent('unknown')
// @ts-expect-error
dashboardPage.innerText('unknown')
// @ts-expect-error
dashboardPage.allInnerTexts('unknown')
// @ts-expect-error
dashboardPage.allTextContents('unknown')
// @ts-expect-error
dashboardPage.count('unknown')
// @ts-expect-error
dashboardPage.scrollIntoViewIfNeeded('unknown')
// @ts-expect-error
dashboardPage.boundingBox('unknown')
// @ts-expect-error
dashboardPage.press('unknown', 'Enter')
// @ts-expect-error
dashboardPage.pressSequentially('unknown', 'text')
// @ts-expect-error
dashboardPage.selectOption('unknown', 'value')
// @ts-expect-error
dashboardPage.setInputFiles('unknown', 'file.txt')
// @ts-expect-error
dashboardPage.getAttribute('unknown', 'data-testid')
// @ts-expect-error
dashboardPage.fill('unknown', 'text')
// @ts-expect-error
dashboardPage.dragTo('unknown', 'userRow')

// Every action options object rejects unsupported properties.
// @ts-expect-error
dashboardPage.click('submitBtn', { unsupportedOption: true })
// @ts-expect-error
dashboardPage.dblclick('submitBtn', { unsupportedOption: true })
// @ts-expect-error
dashboardPage.hover('submitBtn', { unsupportedOption: true })
// @ts-expect-error
dashboardPage.focus('submitBtn', { unsupportedOption: true })
// @ts-expect-error
dashboardPage.blur('submitBtn', { unsupportedOption: true })
// @ts-expect-error
dashboardPage.check('submitBtn', { unsupportedOption: true })
// @ts-expect-error
dashboardPage.uncheck('submitBtn', { unsupportedOption: true })
// @ts-expect-error
dashboardPage.clear('submitBtn', { unsupportedOption: true })
// @ts-expect-error
dashboardPage.waitFor('submitBtn', { unsupportedOption: true })
// @ts-expect-error
dashboardPage.isChecked('submitBtn', { unsupportedOption: true })
// @ts-expect-error
dashboardPage.isDisabled('submitBtn', { unsupportedOption: true })
// @ts-expect-error
dashboardPage.isVisible('submitBtn', { unsupportedOption: true })
// @ts-expect-error
dashboardPage.textContent('submitBtn', { unsupportedOption: true })
// @ts-expect-error
dashboardPage.innerText('submitBtn', { unsupportedOption: true })
// @ts-expect-error
dashboardPage.scrollIntoViewIfNeeded('submitBtn', { unsupportedOption: true })
// @ts-expect-error
dashboardPage.press('submitBtn', 'Enter', { unsupportedOption: true })
// @ts-expect-error
dashboardPage.pressSequentially('submitBtn', 'text', { unsupportedOption: true })
// @ts-expect-error
dashboardPage.selectOption('submitBtn', 'value', { unsupportedOption: true })
// @ts-expect-error
dashboardPage.setInputFiles('submitBtn', 'file.txt', { unsupportedOption: true })
// @ts-expect-error
dashboardPage.getAttribute('submitBtn', 'data-testid', { unsupportedOption: true })
// @ts-expect-error
dashboardPage.fill('submitBtn', 'text', { unsupportedOption: true })
// @ts-expect-error
dashboardPage.dragTo('submitBtn', 'userRow', { unsupportedOption: true })

// @ts-expect-error - Destination keys are also closed to configured locators
dashboardPage.dragTo('submitBtn', 'unknown')
