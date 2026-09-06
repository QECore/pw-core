const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const {
  findRegistryCallBounds,
  parseRegistry,
  writeRegistry,
  matchDynamicEntry,
  collapsePageDict,
  findCommonPrefix,
  serializeRegistryObject
} = require('../../dist/codegen/registry-store')

test('registry-store: findRegistryCallBounds', () => {
  const sample = `
import { createPageRegistry } from 'pw-core/page';
export const registry = createPageRegistry({
  login: {
    url: '/login',
    selectors: {
      userProfile: 'text="User Profile (Admin View)"',
      item: \`div[data-name="test (bracket)"]\`,
      // comment with a parenthesis )
      /* multi-line comment ) */
      btn: '.submit-btn'
    }
  }
});
`
  const bounds = findRegistryCallBounds(sample)
  assert.ok(bounds !== null)
  const extracted = sample.substring(bounds.startIdx, bounds.endIdx).trim()
  assert.ok(extracted.startsWith('{\n  login: {'))
  assert.ok(extracted.endsWith('}'))
})

test('registry-store: parseRegistry non-existent file handling', () => {
  const missingPath = path.join(os.tmpdir(), 'non-existent-reg-file-12345.ts')
  const result = parseRegistry(missingPath)
  assert.deepEqual(result, {})
})

test('registry-store: parseRegistry throws on malformed existing file or missing call', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-core-reg-err-'))
  try {
    const noCallFile = path.join(tempDir, 'no-call.ts')
    fs.writeFileSync(noCallFile, 'export const x = 1;', 'utf8')
    assert.throws(() => parseRegistry(noCallFile), /"createPageRegistry" call not found/)

    const malformedFile = path.join(tempDir, 'malformed.ts')
    fs.writeFileSync(malformedFile, 'export const r = createPageRegistry({ login: { url: /broken } });', 'utf8')
    assert.throws(() => parseRegistry(malformedFile), /Error evaluating registry configuration/)
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
})

test('registry-store: writeRegistry propagates failure on missing target file', () => {
  const nonExistentPath = path.join(os.tmpdir(), 'non-existent-dir-999', 'registry.ts')
  assert.throws(() => writeRegistry(nonExistentPath, {}), /ENOENT/)
})

test('registry-store: matchDynamicEntry', () => {
  const testIdEntry = {
    testId: 'status-id-chart',
    id: ['line', 'bar']
  }
  const res1 = matchDynamicEntry('status-line-chart', testIdEntry, true)
  assert.equal(res1.matches, true)
  assert.equal(res1.matchedValue, 'line')
  assert.equal(res1.placeholderName, 'id')

  const res2 = matchDynamicEntry('status-pie-chart', testIdEntry, true)
  assert.equal(res2.matches, true)
  assert.equal(res2.matchedValue, 'pie')

  const res3 = matchDynamicEntry('unrelated-button', testIdEntry, true)
  assert.equal(res3.matches, false)
})

test('registry-store: findCommonPrefix', () => {
  assert.equal(findCommonPrefix(['filter-active', 'filter-inactive']), 'filter')
  assert.equal(findCommonPrefix(['btn-save', 'btn-cancel']), 'btn')
  assert.equal(findCommonPrefix(['single']), '')
  assert.equal(findCommonPrefix([]), '')
})

test('registry-store: collapsePageDict', () => {
  const dict = {
    filterActive: '[data-filter="filter-active"]',
    filterInactive: '[data-filter="filter-inactive"]'
  }
  const keyReplacements = {}
  const collapsed = collapsePageDict(dict, false, keyReplacements)
  assert.ok(collapsed['filter{btn}'] || collapsed['filter{item}'])
})

test('registry-store: serialization and writing', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-core-reg-test-'))
  const regPath = path.join(tempDir, 'registry.ts')
  try {
    const initialSource = `import { createPageRegistry } from 'pw-core/page';

export const registry = createPageRegistry({
  samplePage: {
    url: '/sample',
    testIds: {
      submit: 'submit-btn'
    }
  }
});
`
    fs.writeFileSync(regPath, initialSource, 'utf8')

    const parsed = parseRegistry(regPath)
    assert.equal(parsed.samplePage.url, '/sample')
    assert.equal(parsed.samplePage.testIds.submit, 'submit-btn')

    parsed.samplePage.testIds.cancel = 'cancel-btn'
    writeRegistry(regPath, parsed, true, new Set(['samplePage']))

    const updatedSource = fs.readFileSync(regPath, 'utf8')
    assert.match(updatedSource, /cancel: 'cancel-btn'/)
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
})
