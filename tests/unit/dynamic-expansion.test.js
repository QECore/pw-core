const test = require('node:test')
const assert = require('node:assert/strict')
const {
  expandDynamicLocators,
  getExpandedTestIds,
  isDynamicKey
} = require('../../dist/page/locators/dynamic-locator-resolver')

test('dynamic-expansion: isDynamicKey', () => {
  assert.equal(isDynamicKey('{item}'), true)
  assert.equal(isDynamicKey('text{item}'), true)
  assert.equal(isDynamicKey('staticKey'), false)
})

test('dynamic-expansion: expandDynamicLocators single placeholder', () => {
  const input = {
    staticKey: 'static-id',
    '{status}Button': {
      status: ['active', 'inactive'],
      testId: 'status-button'
    }
  }

  const expanded = expandDynamicLocators(input)
  assert.deepEqual(expanded, {
    staticKey: 'static-id',
    activeButton: 'active-button',
    inactiveButton: 'inactive-button'
  })
})

test('dynamic-expansion: expandDynamicLocators multi-placeholder', () => {
  const input = {
    '{status}{type}Chart': {
      status: ['active', 'archived'],
      type: ['bar', 'line'],
      testId: 'status-type-chart'
    }
  }

  const expanded = expandDynamicLocators(input)
  assert.deepEqual(expanded, {
    activeBarChart: 'active-bar-chart',
    activeLineChart: 'active-line-chart',
    archivedBarChart: 'archived-bar-chart',
    archivedLineChart: 'archived-line-chart'
  })
})
