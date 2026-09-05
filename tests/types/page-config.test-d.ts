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
dashboardPage.fill('Username', 'admin')
dashboardPage.check('RememberMe')
dashboardPage.chain('submitBtn.userRow')

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

// @ts-expect-error - Calling check on a textbox element key should be rejected
dashboardPage.check('Username')

// @ts-expect-error - Invalid chain path should be rejected
dashboardPage.chain('nonExistentKey.userRow')
