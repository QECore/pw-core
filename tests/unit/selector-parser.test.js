const test = require('node:test')
const assert = require('node:assert/strict')
const { getSelectorValue, extractNthFromSelector } = require('../../dist/codegen/selector-parser')

test('selector-parser: data-testid extraction', () => {
  assert.deepEqual(getSelectorValue('internal:testid=[data-testid="submit-btn"s]'), {
    type: 'testId',
    val: 'submit-btn'
  })
  assert.deepEqual(getSelectorValue('data-testid="login-input"'), {
    type: 'testId',
    val: 'login-input'
  })
  assert.deepEqual(getSelectorValue('[data-testid="item-row"]'), {
    type: 'testId',
    val: 'item-row'
  })
  assert.deepEqual(getSelectorValue('data-testid=simple-id'), {
    type: 'testId',
    val: 'simple-id'
  })
})

test('selector-parser: role and accessibility extraction', () => {
  assert.deepEqual(getSelectorValue('internal:role=button[name="Submit Form"i]'), {
    type: 'button',
    val: 'Submit Form'
  })
  assert.deepEqual(getSelectorValue('internal:role=img[name="Logo"i]'), {
    type: 'altText',
    val: 'Logo'
  })
  assert.deepEqual(getSelectorValue('role=combobox'), {
    type: 'combobox',
    val: 'combobox'
  })
  assert.deepEqual(getSelectorValue('internal:label="Username"i'), {
    type: 'label',
    val: 'Username'
  })
  assert.deepEqual(getSelectorValue('internal:placeholder="Search..."i'), {
    type: 'placeholder',
    val: 'Search...'
  })
  assert.deepEqual(getSelectorValue('internal:title="Close Modal"i'), {
    type: 'title',
    val: 'Close Modal'
  })
  assert.deepEqual(getSelectorValue('internal:alt="Profile Picture"i'), {
    type: 'altText',
    val: 'Profile Picture'
  })
  assert.deepEqual(getSelectorValue('internal:text="Welcome back"i'), {
    type: 'text',
    val: 'Welcome back'
  })
})

test('selector-parser: CSS fallback, IDs, and classes', () => {
  assert.deepEqual(getSelectorValue('#main-header'), {
    type: 'selector',
    val: '#main-header'
  })
  assert.deepEqual(getSelectorValue('.nav-item'), {
    type: 'selector',
    val: '.nav-item'
  })
  assert.deepEqual(getSelectorValue('div.custom'), {
    type: 'selector',
    val: '.custom'
  })
})

test('selector-parser: extractNthFromSelector', () => {
  assert.deepEqual(extractNthFromSelector('.item >> nth=2'), {
    baseSelector: '.item',
    nth: 2
  })
  assert.deepEqual(extractNthFromSelector('button >> first()'), {
    baseSelector: 'button',
    nth: 0
  })
  assert.deepEqual(extractNthFromSelector('button.submit'), {
    baseSelector: 'button.submit'
  })
})
