const test = require('node:test')
const assert = require('node:assert/strict')
const { getFloatingPanelHtml, FLOATING_PANEL_STYLE } = require('../../dist/codegen/floating-panel/template')
const { FloatingPanelManager } = require('../../dist/codegen/floating-panel/manager')
const { clientInjectFloatingPanel } = require('../../dist/codegen/floating-panel/client')

test('floating-panel: template generation with titles and disabled status', () => {
  const html = getFloatingPanelHtml('1', 'login.test.ts', 'Start New Test', 'Add Serial Test', ' disabled')
  assert.ok(html.includes('#1'))
  assert.ok(html.includes('login.test.ts'))
  assert.ok(html.includes('Start New Test'))
  assert.ok(html.includes('Add Serial Test'))
  assert.ok(html.includes('disabled'))
})

test('floating-panel: manager evaluate payload contract', async () => {
  let evaluatedFn = null
  let evaluatedPayload = null

  const mockPage = {
    url: () => 'http://localhost:3000',
    evaluate: async (fn, payload) => {
      evaluatedFn = fn
      evaluatedPayload = payload
      return Promise.resolve()
    }
  }

  const manager = new FloatingPanelManager(
    {
      exposeFunction: async () => {},
      on: () => {},
      pages: () => [mockPage]
    },
    {
      getDisplayTestIndex: () => '2.1',
      getOutputFileName: () => 'dashboard.test.ts',
      hasSteps: () => true,
      onStartNewTest: async () => {},
      onStartNewSerialTest: async () => {}
    }
  )

  await manager.inject(mockPage)

  assert.equal(typeof evaluatedFn, 'function')
  assert.ok(
    clientInjectFloatingPanel.toString().includes('function safeSessionStorage'),
    'clientInjectFloatingPanel must enclose safeSessionStorage within its body for browser serialization'
  )
  assert.deepEqual(evaluatedPayload, {
    idx: '2.1',
    fileName: 'dashboard.test.ts',
    hasSteps: true,
    cssStyle: FLOATING_PANEL_STYLE,
    htmlContent: getFloatingPanelHtml(
      '2.1',
      'dashboard.test.ts',
      'Start new test recording (new page/file)',
      'Add serial test (continues on same page)',
      ''
    )
  })
})
