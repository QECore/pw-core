const test = require('node:test')
const assert = require('node:assert/strict')
const { formatActionCall } = require('../../dist/codegen/action-formatter')

test('action-formatter: click and dblclick', () => {
  const code1 = formatActionCall('loginPage', 'submitBtn', { name: 'click' })
  assert.equal(code1, "  await loginPage.click('submitBtn');")

  const code2 = formatActionCall('loginPage', 'submitBtn', { name: 'click', nth: 2 })
  assert.equal(code2, "  await loginPage.click('submitBtn', { nth: 2 });")

  const code3 = formatActionCall('loginPage', 'itemRow', { name: 'click', clickCount: 2 })
  assert.equal(code3, "  await loginPage.dblclick('itemRow');")
})

test('action-formatter: fill, press, check, uncheck', () => {
  const code1 = formatActionCall('loginPage', 'usernameInput', { name: 'fill', text: 'alice' })
  assert.equal(code1, "  await loginPage.fill('usernameInput', 'alice');")

  const code2 = formatActionCall('loginPage', 'searchBox', { name: 'press', key: 'Enter', modifiers: ['Control'] })
  assert.equal(code2, "  await loginPage.press('searchBox', 'Control+Enter');")

  const code3 = formatActionCall('loginPage', 'rememberMe', { name: 'check' })
  assert.equal(code3, "  await loginPage.check('rememberMe');")

  const code4 = formatActionCall('loginPage', 'rememberMe', { name: 'uncheck' })
  assert.equal(code4, "  await loginPage.uncheck('rememberMe');")
})

test('action-formatter: assertions', () => {
  const code1 = formatActionCall('loginPage', 'headerText', { name: 'assertText', text: 'Welcome', substring: false })
  assert.equal(code1, "  await loginPage.verify('headerText').toHaveText('Welcome');")

  const code2 = formatActionCall('loginPage', 'headerText', { name: 'assertText', text: 'Welcome', substring: true })
  assert.equal(code2, "  await loginPage.verify('headerText').toContainText('Welcome');")

  const code3 = formatActionCall('loginPage', 'submitBtn', { name: 'assertVisible' })
  assert.equal(code3, "  await loginPage.verify('submitBtn');")

  const code4 = formatActionCall('loginPage', 'termsCheck', { name: 'assertChecked', checked: true })
  assert.equal(code4, "  await loginPage.verify('termsCheck').toBeChecked();")

  const code5 = formatActionCall('loginPage', 'termsCheck', { name: 'assertChecked', checked: false })
  assert.equal(code5, "  await loginPage.verify('termsCheck').not.toBeChecked();")
})
