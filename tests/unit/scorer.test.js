const test = require('node:test')
const assert = require('node:assert/strict')
const {
  getBaseScore,
  getContextScore,
  getSemanticScore,
  getPriorityScore
} = require('../../dist/codegen/scorer')
const { isStableId } = require('../../dist/codegen/generator/id-stability')

test('scorer: base score and ranking rules', () => {
  assert.equal(getBaseScore('testId'), 100)
  assert.equal(getBaseScore('nonExistent'), 0)

  const priority1 = getPriorityScore({ strategy: 'testId', source: 'target', depth: 0 })
  assert.equal(priority1, 1000)

  const priority2 = getPriorityScore({ strategy: 'role', roleVal: 'button', source: 'target', depth: 0 })
  assert.equal(priority2, 870)

  const priority3 = getPriorityScore({ strategy: 'class', source: 'target', depth: 0 })
  assert.equal(priority3, 500)
})

test('scorer: semantic and context score', () => {
  const semScore1 = getSemanticScore('user-profile-header')
  assert.ok(semScore1 > 0)

  const semScore2 = getSemanticScore('flex')
  assert.ok(semScore2 < 0)

  const ctxScore1 = getContextScore({ accessibleName: 'Submit Form', nearbyHeading: 'Login' })
  assert.ok(ctxScore1 > 0)
})

test('scorer: isStableId', () => {
  assert.equal(isStableId('submit-btn'), true)
  assert.equal(isStableId('userProfileHeader'), true)

  // Unstable framework/UUID IDs
  assert.equal(isStableId(':r1:'), false)
  assert.equal(isStableId('mui-1234'), false)
  assert.equal(isStableId('headlessui-dialog-12'), false)
  assert.equal(isStableId('123456'), false)
  assert.equal(isStableId('d3b07384-d113-469b-bb9b-98f58b0f8e91'), false)
})
