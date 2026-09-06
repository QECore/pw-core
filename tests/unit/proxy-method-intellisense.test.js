const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const ts = require('typescript')

const root = path.resolve(__dirname, '../..')
const fixturePath = path.join(root, 'proxy-method-intellisense.fixture.ts')

function getCompletions(call) {
  const marker = '/* cursor */'
  const source = `
import type { TypedPage } from './dist/page/index.js'

type Config = {
  testId: { field: string }
}

declare const page: TypedPage<Config>
${call.replace(marker, '')}
`
  const position =
    source.indexOf(marker) === -1
      ? source.indexOf(call.replace(marker, '')) + call.indexOf(marker)
      : source.indexOf(marker)
  const options = {
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    strict: true,
    target: ts.ScriptTarget.ES2022
  }
  const host = {
    fileExists: fs.existsSync,
    getCompilationSettings: () => options,
    getCurrentDirectory: () => root,
    getDefaultLibFileName: ts.getDefaultLibFilePath,
    getScriptFileNames: () => [fixturePath],
    getScriptSnapshot(fileName) {
      if (path.normalize(fileName) === path.normalize(fixturePath)) {
        return ts.ScriptSnapshot.fromString(source)
      }
      if (!fs.existsSync(fileName)) return undefined
      return ts.ScriptSnapshot.fromString(fs.readFileSync(fileName, 'utf8'))
    },
    getScriptVersion: () => '0',
    readDirectory: ts.sys.readDirectory,
    readFile: ts.sys.readFile
  }
  const service = ts.createLanguageService(host)
  return service.getCompletionsAtPosition(fixturePath, position, {})?.entries.map(({ name }) => name) ?? []
}

const methodsWithOptions = [
  ["page.click('field', { /* cursor */ })", 'button'],
  ["page.dblclick('field', { /* cursor */ })", 'button'],
  ["page.hover('field', { /* cursor */ })", 'position'],
  ["page.focus('field', { /* cursor */ })", 'timeout'],
  ["page.blur('field', { /* cursor */ })", 'timeout'],
  ["page.check('field', { /* cursor */ })", 'force'],
  ["page.uncheck('field', { /* cursor */ })", 'force'],
  ["page.clear('field', { /* cursor */ })", 'force'],
  ["page.waitFor('field', { /* cursor */ })", 'state'],
  ["page.isChecked('field', { /* cursor */ })", 'timeout'],
  ["page.isDisabled('field', { /* cursor */ })", 'timeout'],
  ["page.isVisible('field', { /* cursor */ })", 'timeout'],
  ["page.textContent('field', { /* cursor */ })", 'timeout'],
  ["page.innerText('field', { /* cursor */ })", 'timeout'],
  ["page.scrollIntoViewIfNeeded('field', { /* cursor */ })", 'timeout'],
  ["page.press('field', 'Enter', { /* cursor */ })", 'delay'],
  ["page.pressSequentially('field', 'text', { /* cursor */ })", 'delay'],
  ["page.selectOption('field', 'value', { /* cursor */ })", 'timeout'],
  ["page.setInputFiles('field', 'file.txt', { /* cursor */ })", 'timeout'],
  ["page.getAttribute('field', 'name', { /* cursor */ })", 'timeout'],
  ["page.fill('field', 'text', { /* cursor */ })", 'mask'],
  ["page.dragTo('field', 'field', { /* cursor */ })", 'force']
]

for (const [call, expectedOption] of methodsWithOptions) {
  test(`${call.slice(5, call.indexOf('('))} exposes typed options`, () => {
    const completions = getCompletions(call)
    assert.ok(completions.includes(expectedOption), `Expected ${expectedOption}; received ${completions.join(', ')}`)
  })
}
