const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const {
  findElementKey,
  findPageKey,
  parseRegistry,
  writeRegistry
} = require('../dist/codegen')

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-core-codegen-'))
const registryPath = path.join(temporaryDirectory, 'registry.ts')

const registrySource = `import { createPageRegistry } from 'pw-core/page';

export const registry = createPageRegistry({
  codegenPage: {
    url: '/',
    testIds: {
      existing: 'existing-id'
    },
    selectors: {
      staticSelector: '.static-selector'
    }
  }
});
`

try {
  fs.writeFileSync(registryPath, registrySource, 'utf8')

  const registry = parseRegistry(registryPath)
  assert.equal(registry.codegenPage.url, '/')

  const existing = findElementKey('data-testid="existing-id"', 'codegenPage', registry, true)
  assert.deepEqual(existing, {
    pageKey: 'codegenPage',
    elementKey: 'existing',
    val: 'existing-id',
    type: 'testId',
    isNew: false
  })

  const missing = findElementKey('data-testid="new-id"', 'codegenPage', registry, true)
  assert.deepEqual(missing, {
    pageKey: 'codegenPage',
    elementKey: 'newId',
    val: 'new-id',
    type: 'testId',
    isNew: true
  })

  registry.codegenPage.testIds.newId = 'new-id'
  writeRegistry(registryPath, registry, true, new Set(['codegenPage']))

  const serializedRegistry = fs.readFileSync(registryPath, 'utf8')
  assert.match(serializedRegistry, /newId: 'new-id'/)
  assert.equal(findPageKey('https://example.test/', '', registry, true), 'home')

  console.log('Codegen registry verification passed.')
} finally {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true })
}
