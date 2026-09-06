const test = require('node:test')
const assert = require('node:assert/strict')
const {
  findPageKey,
  findElementKey,
  findMatchInDict,
  toCamelCase
} = require('../../dist/codegen/registry-matcher')

test('registry-matcher: toCamelCase and key formatting', () => {
  assert.equal(toCamelCase('hello-world'), 'helloWorld')
  assert.equal(toCamelCase('submit_btn'), 'submitBtn')
  assert.equal(toCamelCase('01-dashboard'), 'dashboard')
})

test('registry-matcher: findPageKey', () => {
  const registry = {
    loginPage: {
      url: '/login'
    },
    dashboard: {
      url: '/app/dashboard'
    }
  }

  assert.equal(findPageKey('https://example.com/login', 'Login', registry, true), 'loginPage')
  assert.equal(findPageKey('https://example.com/app/dashboard', 'Dashboard', registry, true), 'dashboard')
  assert.equal(findPageKey('https://example.com/settings/profile', 'Profile Settings', registry, true), 'settingsProfile')
  assert.equal(findPageKey('https://example.com/', '', registry, true), 'home')
})

test('registry-matcher: findElementKey', () => {
  const registry = {
    myPage: {
      url: '/',
      testIds: {
        existingBtn: 'existing-id'
      },
      button: ['Save']
    }
  }

  // Exact match on existing testId
  const match1 = findElementKey('data-testid="existing-id"', 'myPage', registry, true)
  assert.deepEqual(match1, {
    pageKey: 'myPage',
    elementKey: 'existingBtn',
    val: 'existing-id',
    type: 'testId',
    isNew: false
  })

  // Exact match on role list
  const match2 = findElementKey('internal:role=button[name="Save"i]', 'myPage', registry, true)
  assert.deepEqual(match2, {
    pageKey: 'myPage',
    elementKey: 'Save',
    val: 'Save',
    type: 'button',
    isNew: false
  })

  // New element key generation
  const match3 = findElementKey('data-testid="new-action-btn"', 'myPage', registry, true)
  assert.equal(match3.isNew, true)
  assert.equal(match3.elementKey, 'newActionBtn')
  assert.equal(match3.type, 'testId')
})
