const test = require('node:test')
const assert = require('node:assert/strict')
const { toRegistryKey } = require('../../dist/codegen/key-utils')

test('key-utils: basic camelCase conversion', () => {
  assert.equal(toRegistryKey('hello world'), 'helloWorld')
  assert.equal(toRegistryKey('switch-to-k6-core'), 'switchToK6Core')
  assert.equal(toRegistryKey('POST api/app/projects Create-a-project'), 'postApiAppProjectsCreateAProject')
  assert.equal(toRegistryKey('GET api/app/projects List all projects'), 'getApiAppProjectsListAllProjects')
})

test('key-utils: leading digits stripping and lowercasing', () => {
  assert.equal(toRegistryKey('01Dynamic-Locators'), 'dynamicLocators')
  assert.equal(toRegistryKey('01-dashboard'), 'dashboard')
  assert.equal(toRegistryKey('12345'), 'element')
})

test('key-utils: role suffixes', () => {
  assert.equal(toRegistryKey('submit', { roleSuffix: 'Btn' }), 'submitBtn')
  assert.equal(toRegistryKey('submitBtn', { roleSuffix: 'Btn' }), 'submitBtn')
  assert.equal(toRegistryKey('save-button', { roleSuffix: 'Btn' }), 'saveButtonBtn')
})

test('key-utils: empty and special characters', () => {
  assert.equal(toRegistryKey(''), 'element')
  assert.equal(toRegistryKey('   '), 'element')
  assert.equal(toRegistryKey('!@#$%^&*()'), 'element')
  assert.equal(toRegistryKey('User Profile (Admin View)'), 'userProfileAdminView')
})

test('key-utils: max length truncation', () => {
  const longText = 'This is an exceptionally long element title with excessive description words'
  const key = toRegistryKey(longText)
  assert.ok(key.length <= 40)
  assert.ok(/^[a-z][a-zA-Z0-9]*$/.test(key))
})

test('key-utils: toWorkerKey and toUnprefixedPageKey', () => {
  const { toWorkerKey, toUnprefixedPageKey } = require('../../dist/codegen/key-utils')
  assert.equal(toWorkerKey('loginPage'), 'workerLoginPage')
  assert.equal(toWorkerKey('workerLoginPage'), 'workerLoginPage')
  assert.equal(toUnprefixedPageKey('workerLoginPage'), 'loginPage')
  assert.equal(toUnprefixedPageKey('loginPage'), 'loginPage')
})
