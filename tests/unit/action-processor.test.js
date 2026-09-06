const test = require('node:test')
const assert = require('node:assert/strict')
const { isOwnPanelSelector } = require('../../dist/codegen/action-processor')

test('action-processor: isOwnPanelSelector string checks', async () => {
  const dummyPage = {}
  assert.equal(await isOwnPanelSelector(dummyPage, '#pw-core-codegen-panel'), true)
  assert.equal(await isOwnPanelSelector(dummyPage, 'button.pwcore-btn'), true)
  assert.equal(await isOwnPanelSelector(dummyPage, 'text=New Test'), true)
  assert.equal(await isOwnPanelSelector(dummyPage, 'text=Add Serial'), true)
  assert.equal(await isOwnPanelSelector(dummyPage, 'button#submit-form'), false)
  assert.equal(await isOwnPanelSelector(dummyPage, undefined), false)
})
