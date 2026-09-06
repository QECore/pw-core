#!/usr/bin/env node
import * as fs from 'fs'
import * as path from 'path'
import { chromium, type BrowserContext, type Page } from '@playwright/test'

import {
  findRegistryFile,
  parseRegistry,
  writeRegistry,
  findPageKey,
  findElementKey,
  formatActionCall,
  generateSmartLocator,
  findPlaywrightConfig,
  extractNthFromSelector,
  getBaseUrl,
  getTestDir,
  getNextTestIndex,
  formatRecordingDate,
  toWorkerKey,
  processRecordedAction,
  isOwnPanelSelector,
  type MatchResult,
  type RecordedAction,
  type RegistryRoot
} from './codegen'
import { FloatingPanelManager } from './codegen/floating-panel'
import { HoverTrackerManager } from './codegen/hover-tracker'

type RecorderAction = RecordedAction & { selector: string }
type RecorderActionEvent = { action: RecorderAction }
type RecorderOptions = { language: string; mode: string; recorderMode: string }
type RecorderEventSink = {
  actionAdded(page: Page, data: RecorderActionEvent): Promise<void>
  actionUpdated(page: Page, data: RecorderActionEvent): Promise<void>
  signalAdded(page: Page, data: unknown): void
}
type RecorderContext = BrowserContext & {
  _enableRecorder(options: RecorderOptions, eventSink: RecorderEventSink): Promise<void>
}

/**
 * Adds a newly discovered locator element into the page configuration inside registryObj.
 */
function registerNewElementInRegistry(
  registryObj: RegistryRoot,
  pageKey: string,
  elementKey: string,
  matchResult: MatchResult,
  fallbackUrl: string
): void {
  if (!registryObj[pageKey]) {
    registryObj[pageKey] = { url: fallbackUrl }
  }
  const pageConfig = registryObj[pageKey]!
  if (matchResult.type === 'testId') {
    if (pageConfig.testIds) {
      pageConfig.testIds[elementKey] = matchResult.val
    } else {
      if (!pageConfig.testId) pageConfig.testId = {}
      pageConfig.testId[elementKey] = matchResult.val
    }
  } else if (matchResult.type === 'selector') {
    if (pageConfig.selectors) {
      pageConfig.selectors[elementKey] = matchResult.val
    } else {
      if (!pageConfig.selector) pageConfig.selector = {}
      pageConfig.selector[elementKey] = matchResult.val
    }
  } else {
    const list = pageConfig[matchResult.type]
    if (Array.isArray(list)) {
      if (!list.includes(matchResult.val)) {
        list.push(matchResult.val)
      }
    } else {
      pageConfig[matchResult.type] = [matchResult.val]
    }
  }
}

function printHelp(): void {
  console.log(`
Usage: pw-core <command> [options]

Commands:
  codegen [url]         Start interactive Playwright test codegen with page registry

Options:
  -u, --url <url>       Target URL to record against
  -o, --output <file>   Output test file path (default: <index>.recorded.test.ts)
      --safe            Run in safe mode (append only, no existing key overrides)
  -h, --help            Show help
  -v, --version         Show version number
`)
}

function printVersion(): void {
  try {
    const pkgPath = path.resolve(__dirname, '../package.json')
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
      console.log(`pw-core v${pkg.version}`)
      return
    }
  } catch {}
  console.log('pw-core v1.3.1')
}

async function main() {
  const rawArgs = process.argv.slice(2)

  if (rawArgs.includes('-v') || rawArgs.includes('--version')) {
    printVersion()
    return
  }

  if (rawArgs.includes('-h') || rawArgs.includes('--help')) {
    printHelp()
    return
  }

  const command = rawArgs.find((arg) => !arg.startsWith('-'))

  if (command !== 'codegen') {
    if (command) {
      console.error(`Unknown command: "${command}"\n`)
    }
    printHelp()
    process.exit(command ? 1 : 0)
  }

  const args = rawArgs.filter((arg) => arg !== 'codegen')
  let url = ''
  let output = ''
  const overrideMode = !args.includes('--safe')
  const cleanArgs = args.filter((arg) => arg !== '--safe')
  for (let i = 0; i < cleanArgs.length; i++) {
    if (cleanArgs[i] === '--url' || cleanArgs[i] === '-u') {
      url = cleanArgs[++i]
    } else if (cleanArgs[i] === '--output' || cleanArgs[i] === '-o') {
      output = cleanArgs[++i]
    } else if (!cleanArgs[i].startsWith('-') && !url) {
      url = cleanArgs[i]
    }
  }

  let registryFilePath = findRegistryFile(process.cwd())
  if (!registryFilePath) {
    const isTS = fs.existsSync(path.join(process.cwd(), 'tsconfig.json'))
    const ext = isTS ? 'ts' : 'js'
    let targetDir = process.cwd()
    if (fs.existsSync(path.join(process.cwd(), 'src'))) {
      targetDir = path.join(process.cwd(), 'src', 'pages')
    } else if (fs.existsSync(path.join(process.cwd(), 'pages'))) {
      targetDir = path.join(process.cwd(), 'pages')
    }
    fs.mkdirSync(targetDir, { recursive: true })
    registryFilePath = path.join(targetDir, `registry.${ext}`)
    const templateContent = `import { createPageRegistry } from 'pw-core/page';

export const registry = createPageRegistry({
});
`
    fs.writeFileSync(registryFilePath, templateContent, 'utf8')
    console.log(`Created registry file at: ${registryFilePath}`)
  } else {
    console.log(`Found registry at: ${registryFilePath}`)
  }

  if (!url) {
    const configPath = findPlaywrightConfig(process.cwd())
    if (configPath) {
      url = getBaseUrl(path.dirname(configPath))
    } else {
      let configDir = process.cwd()
      let current = path.dirname(registryFilePath)
      while (current !== path.parse(current).root) {
        if (
          fs.existsSync(path.join(current, 'playwright.config.ts')) ||
          fs.existsSync(path.join(current, 'playwright.config.js'))
        ) {
          configDir = current
          break
        }
        current = path.dirname(current)
      }
      url = getBaseUrl(configDir)
    }
  }

  const registryObj = parseRegistry(registryFilePath)

  const testDir = path.join(getTestDir(process.cwd()), 'codegen')
  fs.mkdirSync(testDir, { recursive: true })
  let currentTestIndex = getNextTestIndex(testDir)
  const activeOutput = output || `${currentTestIndex}.recorded.test.ts`
  let outputFilePath = path.resolve(testDir, activeOutput)
  console.log(`Live spec output will be written to: ${outputFilePath}`)

  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext()

  let testStartedAt = new Date()
  let isSerialSuite = false
  const testsInCurrentFile: { name: string; steps: { pageKey: string; code: string }[]; usedKeys: Set<string> }[] = []

  const recordedSteps: { pageKey: string; code: string }[] = []
  const usedPageKeys = new Set<string>()

  const actionQueue: (() => Promise<void>)[] = []
  let processing = false

  const waitForActionQueue = async (intervalMs: number): Promise<void> => {
    while (actionQueue.length > 0 || processing) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
    }
  }

  const enqueueAction = (task: () => Promise<void>) => {
    actionQueue.push(task)
    processQueue()
  }

  const processQueue = async () => {
    if (processing) return
    processing = true
    while (actionQueue.length > 0) {
      const task = actionQueue.shift()
      if (task) {
        try {
          await task()
        } catch (err) {
          console.error('Error processing action queue task:', err)
        }
      }
    }
    processing = false
  }

  const panelManager = new FloatingPanelManager(context, {
    getDisplayTestIndex: () => {
      if (isSerialSuite) {
        return `${currentTestIndex}.${testsInCurrentFile.length + 1}`
      }
      return `${currentTestIndex}`
    },
    getOutputFileName: () => {
      return path.basename(outputFilePath)
    },
    hasSteps: () => recordedSteps.length > 0,
    onStartNewTest: async () => {
      await waitForActionQueue(20)

      const keyReplacements = writeRegistry(registryFilePath, registryObj, overrideMode, usedPageKeys)
      applyReplacements(keyReplacements)
      updateSpecFile()

      isSerialSuite = false
      testsInCurrentFile.length = 0

      currentTestIndex++
      testStartedAt = new Date()
      const extension = path.extname(output || '1.recorded.test.ts') || '.ts'
      const baseName = path.basename(output || '1.recorded.test.ts', extension)
      let newOutputName = `${currentTestIndex}.recorded.test.ts`
      if (output && output !== '1.recorded.test.ts' && output !== 'recorded.spec.ts') {
        newOutputName = `${baseName}_${currentTestIndex}${extension}`
      }
      outputFilePath = path.resolve(testDir, newOutputName)
      console.log(`\n>>> STARTING NEW TEST: ${outputFilePath} <<<\n`)

      recordedSteps.length = 0
      usedPageKeys.clear()

      await panelManager.injectAll()
    },
    onStartNewSerialTest: async () => {
      await waitForActionQueue(20)

      isSerialSuite = true

      const testName = `${currentTestIndex}.${testsInCurrentFile.length + 1}. Recorded Test`
      testsInCurrentFile.push({
        name: testName,
        steps: [...recordedSteps],
        usedKeys: new Set(usedPageKeys)
      })

      recordedSteps.length = 0
      usedPageKeys.clear()

      updateSpecFile()
      await panelManager.injectAll()
    }
  })

  await panelManager.initialize()

  const updateSpecFile = () => {
    let importPath = path.relative(path.dirname(outputFilePath), registryFilePath).replace(/\\/g, '/')
    if (!importPath.startsWith('.')) {
      importPath = './' + importPath
    }
    importPath = importPath.replace(/\.(ts|js)$/, '')

    const dateStr = formatRecordingDate(testStartedAt)

    let fileContent = ''
    if (isSerialSuite) {
      const cases: string[] = []

      for (const tc of testsInCurrentFile) {
        if (tc.steps.length === 0) continue
        const pageListStr = Array.from(tc.usedKeys).map(toWorkerKey).join(', ')
        const tcSteps = tc.steps.map((s) => {
          let code = s.code
          for (const pk of Array.from(tc.usedKeys)) {
            code = code.replace(new RegExp(`\\b${pk}\\.`, 'g'), `${toWorkerKey(pk)}.`)
          }
          return code.split('\n').map((line) => '    ' + line.trim()).join('\n')
        }).join('\n')
        
        cases.push(`  scenario('${tc.name}', async ({ ${pageListStr || 'workerPage'} }) => {
${tcSteps}
  });`)
      }

      if (recordedSteps.length > 0) {
        const currentName = `${currentTestIndex}.${testsInCurrentFile.length + 1}. Recorded Test`
        const pageListStr = Array.from(usedPageKeys).map(toWorkerKey).join(', ')
        const currentSteps = recordedSteps.map((s) => {
          let code = s.code
          for (const pk of Array.from(usedPageKeys)) {
            code = code.replace(new RegExp(`\\b${pk}\\.`, 'g'), `${toWorkerKey(pk)}.`)
          }
          return code.split('\n').map((line) => '    ' + line.trim()).join('\n')
        }).join('\n')

        cases.push(`  scenario('${currentName}', async ({ ${pageListStr || 'workerPage'} }) => {
${currentSteps}
  });`)
      }

      fileContent = `import { expect } from '@playwright/test';
import { registry as scenario } from '${importPath}';

// Recorded on ${dateStr}
scenario.describe.serial('Recorded Serial Suite', () => {
${cases.join('\n\n')}
});
`
    } else {
      const pageListStr = Array.from(usedPageKeys).join(', ')
      fileContent = `import { expect } from '@playwright/test';
import { registry as scenario } from '${importPath}';

// Recorded on ${dateStr}
scenario('${currentTestIndex}. Recorded Test', async ({ ${pageListStr || 'codegenPage'} }) => {
${recordedSteps.map((s) => s.code).join('\n')}
});
`
    }

    fs.writeFileSync(outputFilePath, fileContent, 'utf8')
  }

  const applyReplacements = (keyReplacements: Record<string, string>) => {
    if (!keyReplacements || Object.keys(keyReplacements).length === 0) return
    for (const step of recordedSteps) {
      for (const oldKey of Object.keys(keyReplacements)) {
        const newKey = keyReplacements[oldKey]
        const regex = new RegExp(`(['"\`])${oldKey}(['"\`])`, 'g')
        step.code = step.code.replace(regex, `$1${newKey}$2`)
      }
    }
  }

  const finalize = async () => {
    await waitForActionQueue(50)
    const keyReplacements = writeRegistry(registryFilePath, registryObj, overrideMode, usedPageKeys)
    applyReplacements(keyReplacements)
    updateSpecFile()
  }

  updateSpecFile()

  let lastActionSignature = ''
  let lastActionTime = 0

  let currentUrl = url || ''
  let currentTitle = ''

  const eventSink = {
    actionAdded: async (page: Page, data: RecorderActionEvent) => {
      enqueueAction(async () => {
        const processed = await processRecordedAction(page, data.action, currentUrl, currentTitle, registryObj, overrideMode)
        if (!processed) return

        const { pageKey, elementKey, action, matchResult } = processed

        const actionSignature = `${pageKey}.${elementKey}.${action.name}.${action.text || action.key || action.value || ''}.${action.nth ?? ''}`
        const now = Date.now()
        const threshold = action.name === 'click' ? 1200 : 500
        if (actionSignature === lastActionSignature && now - lastActionTime < threshold) {
          return
        }
        lastActionSignature = actionSignature
        lastActionTime = now

        usedPageKeys.add(pageKey)
        const generatedCode = formatActionCall(pageKey, elementKey, action)
        recordedSteps.push({ pageKey, code: generatedCode })

        if (matchResult && matchResult.isNew) {
          let pathname = '/'
          try {
            const u = new URL(page.url())
            pathname = u.pathname
          } catch { }
          registerNewElementInRegistry(registryObj, pageKey, elementKey, matchResult, pathname)
          const keyReplacements = writeRegistry(registryFilePath, registryObj, overrideMode, usedPageKeys)
          applyReplacements(keyReplacements)
        }

        updateSpecFile()
        await panelManager.injectAll()
      })
    },
    actionUpdated: async (page: Page, data: RecorderActionEvent) => {
      enqueueAction(async () => {
        const processed = await processRecordedAction(page, data.action, currentUrl, currentTitle, registryObj, overrideMode)
        if (!processed) return

        const { pageKey, elementKey, action } = processed

        usedPageKeys.add(pageKey)
        const generatedCode = formatActionCall(pageKey, elementKey, action)

        lastActionSignature = `${pageKey}.${elementKey}.${action.name}.${action.text || action.key || action.value || ''}.${action.nth ?? ''}`
        lastActionTime = Date.now()

        if (recordedSteps.length > 0) {
          recordedSteps[recordedSteps.length - 1] = {
            pageKey,
            code: generatedCode
          }
        } else {
          recordedSteps.push({ pageKey, code: generatedCode })
        }
        updateSpecFile()
        await panelManager.injectAll()
      })
    },
    signalAdded: (_page: Page, _data: unknown) => {}
  }

  const hoverTracker = new HoverTrackerManager(context, {
    onRecordHover: async (selector: string) => {
      if (selector && (selector.includes('pw-core') || selector.includes('pwCore') || selector.includes('New Test'))) return
      enqueueAction(async () => {
        const pages = context.pages()
        const activePage = pages[pages.length - 1] || page
        if (!activePage) return

        const smartLocator = await generateSmartLocator(activePage, selector)
        if (!smartLocator) return

        let pageKey = findPageKey(activePage.url(), await activePage.title(), registryObj, overrideMode)
        let elementKey = 'codegenPage'
        let selectorToUse = smartLocator.selector
        const parsed = extractNthFromSelector(selectorToUse)
        selectorToUse = parsed.baseSelector
        const hoverAction: RecordedAction = { name: 'hover' }
        if (parsed.nth !== undefined) {
          hoverAction.nth = parsed.nth
        }

        const matchResult = findElementKey(selectorToUse, pageKey, registryObj, overrideMode)
        pageKey = matchResult.pageKey
        elementKey = matchResult.elementKey

        const generatedCode = formatActionCall(pageKey, elementKey, hoverAction)

        const actionSignature = `${pageKey}.${elementKey}.hover..${hoverAction.nth ?? ''}`
        const now = Date.now()
        if (actionSignature === lastActionSignature && now - lastActionTime < 800) {
          return
        }
        lastActionSignature = actionSignature
        lastActionTime = now

        usedPageKeys.add(pageKey)
        recordedSteps.push({ pageKey, code: generatedCode })

        if (matchResult && matchResult.isNew) {
          let pathname = '/'
          try {
            const u = new URL(page.url())
            pathname = u.pathname
          } catch {
            // Fall back to '/' if page URL cannot be parsed
          }
          registerNewElementInRegistry(registryObj, pageKey, elementKey, matchResult, pathname)
          const keyReplacements = writeRegistry(registryFilePath, registryObj, overrideMode, usedPageKeys)
          applyReplacements(keyReplacements)
        }

        updateSpecFile()
        await panelManager.injectAll()
      })
    }
  })

  await hoverTracker.initialize()

  const page = await context.newPage()
  await panelManager.inject(page)

  page.on('close', async () => {
    console.log('Page closed. Closing browser...')
    await finalize()
    await browser.close().catch(() => { })
    process.exit(0)
  })

  page.on('framenavigated', async (frame) => {
    if (frame === page.mainFrame()) {
      currentUrl = page.url()
      try {
        currentTitle = await page.title()
      } catch {
        // Ignore title fetch error if page context is actively transitioning
      }
    }
  })

  if (url && typeof url === 'string') {
    await page.goto(url.startsWith('http') ? url : `http://${url}`)
    await panelManager.inject(page)
  }

  await (context as RecorderContext)._enableRecorder(
    { language: 'javascript', mode: 'recording', recorderMode: 'api' },
    eventSink
  )

  browser.on('disconnected', async () => {
    console.log('Browser closed. Codegen complete!')
    await finalize()
    process.exit(0)
  })
}

main().catch(console.error)
