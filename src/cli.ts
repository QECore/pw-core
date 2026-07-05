#!/usr/bin/env node
import * as fs from 'fs'
import * as path from 'path'
import { chromium } from '@playwright/test'

import {
  findRegistryFile,
  parseRegistry,
  writeRegistry,
  findPageKey,
  findElementKey,
  formatActionCall,
  generateSmartLocator,
  findPlaywrightConfig
} from './codegen'
import { FloatingPanelManager } from './codegen/floating-panel'
import { HoverTrackerManager } from './codegen/hover-tracker'

function extractNthFromSelector(selector: string): {
  baseSelector: string
  nth?: number
} {
  const nthMatch = selector.match(/\s*>>\s*nth=(\d+)/i)
  if (nthMatch) {
    const baseSelector = selector.replace(/\s*>>\s*nth=\d+/i, '').trim()
    return { baseSelector, nth: parseInt(nthMatch[1], 10) }
  }
  if (selector.endsWith(' >> first()')) {
    const baseSelector = selector.substring(0, selector.length - ' >> first()'.length).trim()
    return { baseSelector, nth: 0 }
  }
  return { baseSelector: selector }
}

function parseDotEnv(cwd: string): Record<string, string> {
  const env: Record<string, string> = {}
  const envPath = path.join(cwd, '.env')
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf8')
      const lines = content.split(/\r?\n/)
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const index = trimmed.indexOf('=')
        if (index > 0) {
          const key = trimmed.slice(0, index).trim()
          let val = trimmed.slice(index + 1).trim()
          if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
            val = val.slice(1, -1)
          }
          env[key] = val
        }
      }
    } catch (e) { }
  }
  return env
}

function getBaseUrl(cwd: string): string {
  const env = parseDotEnv(cwd)
  const envUrl = process.env.URL || env['URL']
  if (envUrl) {
    return envUrl
  }

  let configPath = path.join(cwd, 'playwright.config.ts')
  if (!fs.existsSync(configPath)) {
    configPath = path.join(cwd, 'playwright.config.js')
  }

  if (fs.existsSync(configPath)) {
    try {
      const content = fs.readFileSync(configPath, 'utf8')
      const stringMatch = content.match(/baseURL:\s*['"`](.*?)['"`]/)
      if (stringMatch && stringMatch[1]) {
        return stringMatch[1]
      }

      if (/baseURL:\s*(?:env|ENV)\.url/.test(content)) {
        let envFilePath = path.join(cwd, 'src', 'utils', 'env.ts')
        if (!fs.existsSync(envFilePath)) {
          envFilePath = path.join(cwd, 'src', 'utils', 'env.js')
        }
        if (fs.existsSync(envFilePath)) {
          const envContent = fs.readFileSync(envFilePath, 'utf8')
          const stringMatches = [...envContent.matchAll(/['"`](https?:\/\/.*?)['"`]/g)]
          if (stringMatches.length > 0) {
            return stringMatches[0][1]
          }
        }
      }
    } catch (e) { }
  }
  return ''
}

function getTestDir(cwd: string): string {
  let configPath = path.join(cwd, 'playwright.config.ts')
  if (!fs.existsSync(configPath)) {
    configPath = path.join(cwd, 'playwright.config.js')
  }

  if (fs.existsSync(configPath)) {
    try {
      const content = fs.readFileSync(configPath, 'utf8')
      const testDirMatch = content.match(/testDir:\s*['"`](.*?)['"`]/)
      if (testDirMatch && testDirMatch[1]) {
        return path.resolve(cwd, testDirMatch[1])
      }
    } catch (e) { }
  }

  return cwd
}

function getNextTestIndex(testDir: string): number {
  if (!fs.existsSync(testDir)) return 1
  try {
    const files = fs.readdirSync(testDir)
    let max = 0
    for (const file of files) {
      const match = file.match(/^(\d+)\.recorded\.test\.(ts|js)$/)
      if (match) {
        const num = parseInt(match[1], 10)
        if (num > max) {
          max = num
        }
      }
    }
    return max + 1
  } catch (e) {
    return 1
  }
}

function formatRecordingDate(date: Date): string {
  const day = date.getDate()
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const month = months[date.getMonth()]
  const year = date.getFullYear()

  let hours = date.getHours()
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12
  hours = hours ? hours : 12

  return `${day} ${month} ${year}, ${hours}:${minutes}:${seconds} ${ampm}`
}

function toWorkerKey(key: string): string {
  if (key.startsWith('worker')) return key
  return `worker${key.charAt(0).toUpperCase()}${key.slice(1)}`
}

async function main() {
  console.log('RESOLVED @playwright/test:', require.resolve('@playwright/test'))
  try {
    console.log('RESOLVED playwright-core:', require.resolve('playwright-core'))
  } catch (e) { }
  const args = process.argv.slice(2).filter((arg) => arg !== 'codegen')
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

  let registryObj = parseRegistry(registryFilePath)

  const testDir = path.join(getTestDir(process.cwd()), 'codegen')
  fs.mkdirSync(testDir, { recursive: true })
  let currentTestIndex = getNextTestIndex(testDir)
  let activeOutput = output || `${currentTestIndex}.recorded.test.ts`
  let outputFilePath = path.resolve(testDir, activeOutput)
  console.log(`Live spec output will be written to: ${outputFilePath}`)

  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext()

  let testStartedAt = new Date()
  let isSerialSuite = false
  const testsInCurrentFile: { name: string; steps: { pageKey: string; code: string }[]; usedKeys: Set<string> }[] = []

  const recordedSteps: { pageKey: string; code: string }[] = []
  const usedPageKeys = new Set<string>()

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
      console.log('DEBUG [cli]: onStartNewTest callback triggered on CLI host')
      // Wait for any pending page actions to be fully processed first so we don't lose the click that triggered the navigation/action
      while (actionQueue.length > 0 || processing) {
        await new Promise((resolve) => setTimeout(resolve, 20))
      }

      const keyReplacements = writeRegistry(registryFilePath, registryObj, overrideMode, usedPageKeys)
      applyReplacements(keyReplacements)
      updateSpecFile()

      // Reset serial state for new test file
      isSerialSuite = false
      testsInCurrentFile.length = 0

      // 2. Increment test index and update outputFilePath
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

      // 3. Clear steps and usedPageKeys for the new test session
      recordedSteps.length = 0
      usedPageKeys.clear()

      // 4. Re-inject panel on all open pages with the updated index
      await panelManager.injectAll()
    },
    onStartNewSerialTest: async () => {
      console.log('DEBUG [cli]: onStartNewSerialTest callback triggered on CLI host')
      // Wait for any pending page actions to be fully processed first so we don't lose the click that triggered the navigation/action
      while (actionQueue.length > 0 || processing) {
        await new Promise((resolve) => setTimeout(resolve, 20))
      }

      console.log(`DEBUG [cli]: __pwCoreStartNewSerialTest triggered. currentTestIndex=${currentTestIndex}, testsCount=${testsInCurrentFile.length}, activeSteps=${recordedSteps.length}`)
      isSerialSuite = true

      // Save current steps as a test case
      const testName = `${currentTestIndex}.${testsInCurrentFile.length + 1}. Recorded Test`
      testsInCurrentFile.push({
        name: testName,
        steps: [...recordedSteps],
        usedKeys: new Set(usedPageKeys)
      })

      // Clear active steps and usedPageKeys for the next serial test
      recordedSteps.length = 0
      usedPageKeys.clear()

      // Write the current state to the file
      updateSpecFile()

      // Re-inject/update panel on all open pages
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

      // Add previously completed test cases
      for (const tc of testsInCurrentFile) {
        if (tc.steps.length === 0) continue
        const pageListStr = Array.from(tc.usedKeys).map(toWorkerKey).join(', ')
        const tcSteps = tc.steps.map(s => {
          let code = s.code
          for (const pk of Array.from(tc.usedKeys)) {
            code = code.replace(new RegExp(`\\b${pk}\\.`, 'g'), `${toWorkerKey(pk)}.`)
          }
          return code.split('\n').map(line => '    ' + line.trim()).join('\n')
        }).join('\n')
        
        cases.push(`  scenario('${tc.name}', async ({ ${pageListStr || 'workerPage'} }) => {
${tcSteps}
  });`)
      }

      // Add the currently recording test case
      if (recordedSteps.length > 0) {
        const currentName = `${currentTestIndex}.${testsInCurrentFile.length + 1}. Recorded Test`
        const pageListStr = Array.from(usedPageKeys).map(toWorkerKey).join(', ')
        const currentSteps = recordedSteps.map(s => {
          let code = s.code
          for (const pk of Array.from(usedPageKeys)) {
            code = code.replace(new RegExp(`\\b${pk}\\.`, 'g'), `${toWorkerKey(pk)}.`)
          }
          return code.split('\n').map(line => '    ' + line.trim()).join('\n')
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
    while (actionQueue.length > 0 || processing) {
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
    const keyReplacements = writeRegistry(registryFilePath, registryObj, overrideMode, usedPageKeys)
    applyReplacements(keyReplacements)
    updateSpecFile()
  }

  // Initialize spec file immediately
  updateSpecFile()

  let lastActionSignature = ''
  let lastActionTime = 0

  const actionQueue: (() => Promise<void>)[] = []
  let processing = false
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

  // Track the current page URL and title as the user navigates.
  // data.frame.url / data.frame.title are always undefined in this Playwright build,
  // so we maintain our own state that is kept up-to-date via page navigation events.
  let currentUrl = url || ''
  let currentTitle = ''

  const eventSink = {
    actionAdded: async (page: any, data: any, code: any) => {
      enqueueAction(async () => {
        const action = data.action
        console.log('DEBUG [cli]: eventSink.actionAdded called for action:', action.name, 'selector:', action.selector)
        if (action.name === 'openPage' || action.name === 'closePage') return
        if (action.selector) {
          const lowerSel = action.selector.toLowerCase()
          if (
            lowerSel.includes('pw-core') ||
            lowerSel.includes('pwcore') ||
            lowerSel.includes('new test') ||
            lowerSel.includes('add serial') ||
            lowerSel.includes('new-serial') ||
            lowerSel.includes('new-test')
          ) {
            console.log(`DEBUG [cli]: Ignoring own panel action (string match) in actionAdded: selector="${action.selector}"`)
            return
          }
          try {
            const isOurPanel = await page.locator(action.selector).evaluate((el: any) => {
              return el.id === 'pw-core-codegen-panel' || el.closest('#pw-core-codegen-panel') !== null
            }, null, { timeout: 500 }).catch(() => false)
            if (isOurPanel) {
              console.log(`DEBUG [cli]: Ignoring own panel action in actionAdded: selector="${action.selector}"`)
              return
            }
          } catch (e) {}
        }

        let pageKey = findPageKey(currentUrl, currentTitle, registryObj, overrideMode)
        console.log(`DEBUG [cli]: url="${currentUrl}" title="${currentTitle}" → pageKey="${pageKey}"`)
        if (!registryObj[pageKey]) {
          let effectiveUrl = '/'
          try {
            const u = new URL(currentUrl)
            const hash = u.hash && u.hash.startsWith('#/') ? u.hash.slice(1) : ''
            const targetUrl = (hash && hash !== '/') ? hash : u.pathname
            // Strip any nested query params or nested hash IDs from targetUrl
            const clean = targetUrl.split('?')[0].split('#')[0]
            effectiveUrl = clean.startsWith('/') ? clean : '/' + clean
          } catch (e) { }
          registryObj[pageKey] = { url: effectiveUrl }
        }
        let elementKey = 'element'
        let actionNth: number | undefined = undefined
        let matchResult: any = null
        let isText = false
        let textVal = ''
        if (action.selector) {
          let selectorToUse = action.selector
          const smartLocator = await generateSmartLocator(page, action.selector)
          if (smartLocator) {
            console.log(
              `DEBUG [cli]: smart locator: ${smartLocator.locator} (strategy: ${smartLocator.strategy}, base: ${smartLocator.baseScore}, semantic: ${smartLocator.semanticScore}, context: ${smartLocator.contextScore}, total: ${smartLocator.totalScore})`
            )
            if (smartLocator.nearbyText) console.log(`DEBUG [cli]:   nearbyText: "${smartLocator.nearbyText}"`)
            if (smartLocator.accessibleName)
              console.log(`DEBUG [cli]:   accessibleName: "${smartLocator.accessibleName}"`)
            if (smartLocator.generatedKey) console.log(`DEBUG [cli]:   generatedKey: "${smartLocator.generatedKey}"`)
            selectorToUse = smartLocator.selector
          }

          const parsed = extractNthFromSelector(selectorToUse)
          selectorToUse = parsed.baseSelector
          actionNth = parsed.nth
          if (actionNth !== undefined) {
            action.nth = actionNth
          }

          const textMatch = selectorToUse.match(/^(?:text|internal:text)=["']?([^"']+)["']?i?$/)
          if (textMatch) {
            isText = true
            textVal = textMatch[1]
          }

          if (!isText) {
            matchResult = findElementKey(selectorToUse, pageKey, registryObj, overrideMode, {
              targetTestId: (smartLocator as any)?.targetTestId,
              targetId: (smartLocator as any)?.targetId,
              targetParentId: (smartLocator as any)?.targetParentId
            })
            pageKey = matchResult.pageKey
            elementKey = matchResult.elementKey

            // Use context-aware generatedKey if it produced a better name and the match is new
            if (matchResult.isNew && smartLocator?.generatedKey && smartLocator.generatedKey.length > 2) {
              const proposedKey = smartLocator.generatedKey
              const existingKeys = new Set([
                ...Object.keys(registryObj[pageKey]?.testIds || {}),
                ...Object.keys(registryObj[pageKey]?.selectors || {})
              ])
              if (!existingKeys.has(proposedKey)) {
                elementKey = proposedKey
              }
            }
          }
        }

        const actionSignature = `${pageKey}.${isText ? 'page.getByText(' + textVal + ')' : elementKey}.${action.name}.${action.text || action.key || action.value || ''}.${action.nth ?? ''}`
        const now = Date.now()
        const threshold = action.name === 'click' ? 1200 : 500
        if (actionSignature === lastActionSignature && now - lastActionTime < threshold) {
          console.log(`DEBUG [cli]: Deduplicated consecutive action: ${actionSignature}`)
          return
        }
        lastActionSignature = actionSignature
        lastActionTime = now

        usedPageKeys.add(pageKey)
        const generatedCode = formatActionCall(pageKey, elementKey, action, isText, textVal)
        console.log('DEBUG [cli]: generatedCode:', generatedCode)
        recordedSteps.push({ pageKey, code: generatedCode })

        if (matchResult && matchResult.isNew) {
          if (!registryObj[pageKey]) {
            let pathname = '/'
            try {
              const u = new URL(page.url())
              pathname = u.pathname
            } catch (e) { }
            registryObj[pageKey] = { url: pathname }
          }
          if (matchResult.type === 'testId') {
            if (!registryObj[pageKey].testIds) registryObj[pageKey].testIds = {}
            registryObj[pageKey].testIds[elementKey] = matchResult.val
          } else {
            if (!registryObj[pageKey].selectors) registryObj[pageKey].selectors = {}
            registryObj[pageKey].selectors[elementKey] = matchResult.val
          }
          const keyReplacements = writeRegistry(registryFilePath, registryObj, overrideMode, usedPageKeys)
          applyReplacements(keyReplacements)
        }

        updateSpecFile()
        await panelManager.injectAll()
      })
    },
    actionUpdated: async (page: any, data: any, code: any) => {
      enqueueAction(async () => {
        const action = data.action
        console.log(
          'DEBUG [cli]: eventSink.actionUpdated called for action:',
          action.name,
          'selector:',
          action.selector
        )
        if (action.name === 'openPage' || action.name === 'closePage') return
        if (action.selector) {
          const lowerSel = action.selector.toLowerCase()
          if (
            lowerSel.includes('pw-core') ||
            lowerSel.includes('pwcore') ||
            lowerSel.includes('new test') ||
            lowerSel.includes('add serial') ||
            lowerSel.includes('new-serial') ||
            lowerSel.includes('new-test')
          ) {
            console.log(`DEBUG [cli]: Ignoring own panel action (string match) in actionUpdated: selector="${action.selector}"`)
            return
          }
          try {
            const isOurPanel = await page.locator(action.selector).evaluate((el: any) => {
              return el.id === 'pw-core-codegen-panel' || el.closest('#pw-core-codegen-panel') !== null
            }, null, { timeout: 500 }).catch(() => false)
            if (isOurPanel) {
              console.log(`DEBUG [cli]: Ignoring own panel action in actionUpdated: selector="${action.selector}"`)
              return
            }
          } catch (e) {}
        }

        let pageKey = findPageKey(currentUrl, currentTitle, registryObj, overrideMode)
        if (!registryObj[pageKey]) {
          let effectiveUrl = '/'
          try {
            const u = new URL(currentUrl)
            const hash = u.hash && u.hash.startsWith('#/') ? u.hash.slice(1) : ''
            const targetUrl = (hash && hash !== '/') ? hash : u.pathname
            // Strip any nested query params or nested hash IDs from targetUrl
            const clean = targetUrl.split('?')[0].split('#')[0]
            effectiveUrl = clean.startsWith('/') ? clean : '/' + clean
          } catch (e) { }
          registryObj[pageKey] = { url: effectiveUrl }
        }
        let elementKey = 'element'
        let actionNth: number | undefined = undefined
        let isText = false
        let textVal = ''
        if (action.selector) {
          let selectorToUse = action.selector
          const smartLocator = await generateSmartLocator(page, action.selector)
          if (smartLocator) {
            selectorToUse = smartLocator.selector
          }

          const parsed = extractNthFromSelector(selectorToUse)
          selectorToUse = parsed.baseSelector
          actionNth = parsed.nth
          if (actionNth !== undefined) {
            action.nth = actionNth
          }

          const textMatch = selectorToUse.match(/^(?:text|internal:text)=["']?([^"']+)["']?i?$/)
          if (textMatch) {
            isText = true
            textVal = textMatch[1]
          }

          if (!isText) {
            const matchResult = findElementKey(selectorToUse, pageKey, registryObj, overrideMode, {
              targetTestId: (smartLocator as any)?.targetTestId,
              targetId: (smartLocator as any)?.targetId,
              targetParentId: (smartLocator as any)?.targetParentId
            })
            pageKey = matchResult.pageKey
            elementKey = matchResult.elementKey
          }
        }

        usedPageKeys.add(pageKey)
        const generatedCode = formatActionCall(pageKey, elementKey, action, isText, textVal)
        console.log('DEBUG [cli]: generatedCode updated:', generatedCode)

        lastActionSignature = `${pageKey}.${isText ? 'page.getByText(' + textVal + ')' : elementKey}.${action.name}.${action.text || action.key || action.value || ''}.${action.nth ?? ''}`
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
    signalAdded: (page: any, data: any) => {
      console.log('DEBUG [cli]: eventSink.signalAdded called')
    }
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
        const hoverAction: any = { name: 'hover' }
        if (parsed.nth !== undefined) {
          hoverAction.nth = parsed.nth
        }

        let isText = false
        let textVal = ''
        const textMatch = selectorToUse.match(/^(?:text|internal:text)=["']?([^"']+)["']?i?$/)
        if (textMatch) {
          isText = true
          textVal = textMatch[1]
        }

        let matchResult: any = null
        if (!isText) {
          matchResult = findElementKey(selectorToUse, pageKey, registryObj, overrideMode)
          pageKey = matchResult.pageKey
          elementKey = matchResult.elementKey
        }

        const generatedCode = formatActionCall(pageKey, elementKey, hoverAction, isText, textVal)

        const actionSignature = `${pageKey}.${isText ? 'page.getByText(' + textVal + ')' : elementKey}.hover..${hoverAction.nth ?? ''}`
        const now = Date.now()
        if (actionSignature === lastActionSignature && now - lastActionTime < 800) {
          return
        }
        lastActionSignature = actionSignature
        lastActionTime = now

        usedPageKeys.add(pageKey)
        console.log('DEBUG [cli]: Hover action recorded:', generatedCode)
        recordedSteps.push({ pageKey, code: generatedCode })

        if (matchResult && matchResult.isNew) {
          if (!registryObj[pageKey]) {
            let pathname = '/'
            try {
              const u = new URL(page.url())
              pathname = u.pathname
            } catch (e) { }
            registryObj[pageKey] = { url: pathname }
          }
          if (matchResult.type === 'testId') {
            if (!registryObj[pageKey].testIds) registryObj[pageKey].testIds = {}
            registryObj[pageKey].testIds[elementKey] = matchResult.val
          } else {
            if (!registryObj[pageKey].selectors) registryObj[pageKey].selectors = {}
            registryObj[pageKey].selectors[elementKey] = matchResult.val
          }
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

  page.on('close', async () => {
    console.log('Page closed. Closing browser...')
    await finalize()
    await browser.close().catch(() => { })
    process.exit(0)
  })

  // Track page URL and title on every navigation (real, hash, or pushState)
  page.on('framenavigated', async (frame) => {
    if (frame === page.mainFrame()) {
      currentUrl = page.url()
      try { currentTitle = await page.title() } catch (e) { }
      console.log(`DEBUG [cli]: navigated → url="${currentUrl}" title="${currentTitle}"`)
    }
  })

  if (url && typeof url === 'string') {
    await page.goto(url.startsWith('http') ? url : `http://${url}`)
  }

  await (context as any)._enableRecorder({ language: 'javascript', mode: 'recording', recorderMode: 'api' }, eventSink)

  browser.on('disconnected', async () => {
    console.log('Browser closed. Codegen complete!')
    await finalize()
    process.exit(0)
  })
}

main().catch(console.error)
