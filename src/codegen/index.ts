import * as fs from 'fs'
import * as path from 'path'
import { toRegistryKey } from './key-utils'

export interface SelectorMatch {
  type: string
  val: string
}

export interface MatchResult {
  pageKey: string
  elementKey: string
  val: string
  type: string
  isNew: boolean
}

export function getSelectorValue(selector: string): SelectorMatch {
  // 1. Try to find data-testid first
  const testIdRegexes = [
    /internal:testid=\[data-testid="([^"]+)"[si]?\]/,
    /data-testid="([^"]+)"[si]?/,
    /\[data-testid="([^"]+)"[si]?\]/,
    /data-testid=([^\[\]\s]+)/
  ]
  for (const regex of testIdRegexes) {
    const match = selector.match(regex)
    if (match) {
      let val = match[1]
      val = val.replace(/^["']|["']$/g, '')
      return { type: 'testId', val }
    }
  }

  // 2. Playwright getByRole
  const roleRegex = /internal:role=([a-zA-Z0-9_-]+)\[name="([^"]+)"i?\]/
  const roleMatch = selector.match(roleRegex)
  if (roleMatch) {
    let type = roleMatch[1]
    if (type === 'img') type = 'altText'
    return { type, val: roleMatch[2] }
  }

  const roleSimpleRegex = /role=([a-zA-Z0-9_-]+)/
  const roleSimpleMatch = selector.match(roleSimpleRegex)
  if (roleSimpleMatch) {
    return { type: roleSimpleMatch[1], val: roleSimpleMatch[1] }
  }

  // 3. Playwright getByLabel
  const labelRegex = /internal:label="([^"]+)"i?/
  const labelMatch = selector.match(labelRegex)
  if (labelMatch) {
    return { type: 'label', val: labelMatch[1] }
  }

  // 4. Playwright getByPlaceholder
  const placeholderRegexes = [
    /internal:placeholder="([^"]+)"i?/,
    /internal:attr=\[placeholder="([^"]+)"[si]?\]/
  ]
  for (const regex of placeholderRegexes) {
    const placeholderMatch = selector.match(regex)
    if (placeholderMatch) {
      return { type: 'placeholder', val: placeholderMatch[1] }
    }
  }

  // 5. Playwright getByAltText
  const altRegexes = [
    /internal:alt="([^"]+)"i?/,
    /internal:attr=\[alt="([^"]+)"[si]?\]/
  ]
  for (const regex of altRegexes) {
    const altMatch = selector.match(regex)
    if (altMatch) {
      return { type: 'altText', val: altMatch[1] }
    }
  }

  // 6. Playwright getByTitle
  const titleRegexes = [
    /internal:title="([^"]+)"i?/,
    /internal:attr=\[title="([^"]+)"[si]?\]/
  ]
  for (const regex of titleRegexes) {
    const titleMatch = selector.match(regex)
    if (titleMatch) {
      return { type: 'title', val: titleMatch[1] }
    }
  }

  // 7. Playwright getByText
  const textRegex = /(?:internal:text|text)="([^"]+)"i?/
  const textMatch = selector.match(textRegex)
  if (textMatch) {
    return { type: 'text', val: textMatch[1] }
  }

  const textSimpleRegex = /(?:internal:text|text)=([^"\s]+)/
  const textSimpleMatch = selector.match(textSimpleRegex)
  if (textSimpleMatch) {
    return { type: 'text', val: textSimpleMatch[1] }
  }

  // 8. Try to find ID selector
  const idRegexes = [/id=([a-zA-Z0-9_-]+)/, /#([a-zA-Z0-9_-]+)/]
  for (const regex of idRegexes) {
    const match = selector.match(regex)
    if (match) {
      return { type: 'selector', val: `#${match[1]}` }
    }
  }

  // 9. Try to find class selectors
  const classRegexes = [/\.([a-zA-Z0-9_-]+)/]
  for (const regex of classRegexes) {
    const match = selector.match(regex)
    if (match) {
      return { type: 'selector', val: `.${match[1]}` }
    }
  }

  // 10. Fallback to raw selector
  return { type: 'selector', val: selector }
}

export function findRegistryFile(dir: string): string | null {
  const queue = [dir]
  while (queue.length > 0) {
    const current = queue.shift()!
    try {
      const files = fs.readdirSync(current)
      for (const file of files) {
        const fullPath = path.join(current, file)
        if (file === 'node_modules' || file === '.git' || file === 'dist') continue
        const stat = fs.statSync(fullPath)
        if (stat.isDirectory()) {
          queue.push(fullPath)
        } else if (file === 'registry.ts' || file === 'registry.js') {
          try {
            const content = fs.readFileSync(fullPath, 'utf8')
            if (content.includes('createPageRegistry(')) {
              return fullPath
            }
          } catch (e) { }
        }
      }
    } catch (e) { }
  }

  let parent = path.dirname(dir)
  while (parent !== dir) {
    const checkPath = path.join(parent, 'registry.ts')
    if (fs.existsSync(checkPath)) {
      try {
        const content = fs.readFileSync(checkPath, 'utf8')
        if (content.includes('createPageRegistry(')) return checkPath
      } catch (e) { }
    }

    const checkPathSrc = path.join(parent, 'src', 'pages', 'registry.ts')
    if (fs.existsSync(checkPathSrc)) {
      try {
        const content = fs.readFileSync(checkPathSrc, 'utf8')
        if (content.includes('createPageRegistry(')) return checkPathSrc
      } catch (e) { }
    }

    dir = parent
    parent = path.dirname(dir)
  }

  return null
}

export function findPlaywrightConfig(dir: string): string | null {
  const queue = [dir]
  while (queue.length > 0) {
    const current = queue.shift()!
    try {
      const files = fs.readdirSync(current)
      for (const file of files) {
        if (file === 'node_modules' || file === '.git' || file === 'dist') continue
        const fullPath = path.join(current, file)
        const stat = fs.statSync(fullPath)
        if (stat.isDirectory()) {
          queue.push(fullPath)
        } else if (file === 'playwright.config.ts' || file === 'playwright.config.js') {
          return fullPath
        }
      }
    } catch (e) { }
  }

  let parent = path.dirname(dir)
  while (parent !== dir) {
    const tsPath = path.join(parent, 'playwright.config.ts')
    const jsPath = path.join(parent, 'playwright.config.js')
    if (fs.existsSync(tsPath)) return tsPath
    if (fs.existsSync(jsPath)) return jsPath
    dir = parent
    parent = path.dirname(dir)
  }

  return null
}

function findRegistryCallBounds(content: string): { startIdx: number; endIdx: number } | null {
  const matchIndex = content.indexOf('createPageRegistry(')
  if (matchIndex === -1) return null
  const startIdx = matchIndex + 'createPageRegistry('.length
  let braceCount = 0
  for (let i = startIdx; i < content.length; i++) {
    const char = content[i]
    if (char === '(') braceCount++
    else if (char === ')') {
      if (braceCount === 0) {
        return { startIdx, endIdx: i }
      }
      braceCount--
    }
  }
  return null
}

export function parseRegistry(filePath: string): any {
  try {
    const content = fs.readFileSync(filePath, 'utf8')
    const bounds = findRegistryCallBounds(content)
    if (bounds) {
      const objectLiteralText = content.substring(bounds.startIdx, bounds.endIdx).trim()
      return new Function(`return (${objectLiteralText})`)()
    }
  } catch (e) {
    console.error('Error parsing registry.ts:', e)
  }
  return {}
}

export function matchDynamicEntry(
  val: string,
  entry: any,
  isTestId: boolean
): { matches: boolean; matchedValue?: string; placeholderName?: string } {
  const pattern = isTestId ? entry.testId : entry.selector
  if (typeof pattern !== 'string') return { matches: false }

  const placeholders = Object.keys(entry).filter((k) => k !== 'testId' && k !== 'selector')
  if (placeholders.length === 0) return { matches: false }

  const placeholder = placeholders[0]
  let placeholderPattern = `{${placeholder}}`
  if (!pattern.includes(placeholderPattern)) {
    placeholderPattern = placeholder
  }

  const token = '__PLACEHOLDER_REGEX__'
  const tempPattern = pattern.replace(placeholderPattern, token)
  const escaped = tempPattern.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
  const regexStr = '^' + escaped.replace(token, '([a-zA-Z0-9_ -]+)') + '$'
  try {
    const regex = new RegExp(regexStr)
    const match = val.match(regex)
    if (match) {
      return {
        matches: true,
        matchedValue: match[1],
        placeholderName: placeholder
      }
    }
  } catch (e) { }

  return { matches: false }
}

function findCommonPrefix(values: string[]): string {
  if (values.length === 0) return ''
  const first = values[0]
  const parts = first.split(/[-_]/)
  let common = ''
  for (let i = 0; i < parts.length; i++) {
    const candidate = parts.slice(0, i + 1).join('-')
    const matchesAll = values.every((v) => v.startsWith(candidate + '-') || v.startsWith(candidate + '_'))
    if (matchesAll) {
      common = candidate
    } else {
      break
    }
  }
  return common
}

function collapsePageDict(
  dict: Record<string, any>,
  isTestId: boolean,
  keyReplacements: Record<string, string>
): Record<string, any> {
  const result: Record<string, any> = {}
  const dynamicEntries: Record<string, any> = {}
  const staticEntries: Record<string, string> = {}

  for (const k of Object.keys(dict)) {
    if (typeof dict[k] === 'object' && dict[k] !== null) {
      dynamicEntries[k] = dict[k]
    } else if (typeof dict[k] === 'string') {
      staticEntries[k] = dict[k]
    }
  }

  const collapsedKeys = new Set<string>()

  // 1. Try to merge static entries into existing dynamic entries first
  for (const dk of Object.keys(dynamicEntries)) {
    const entry = dynamicEntries[dk]
    const placeholders = Object.keys(entry).filter((pk) => pk !== 'testId' && pk !== 'selector')
    if (placeholders.length === 0) continue
    const placeholder = placeholders[0]

    for (const k of Object.keys(staticEntries)) {
      const val = staticEntries[k]
      const matchRes = matchDynamicEntry(val, entry, isTestId)
      if (matchRes.matches && matchRes.matchedValue) {
        if (!entry[placeholder].includes(matchRes.matchedValue)) {
          entry[placeholder].push(matchRes.matchedValue)
        }
        collapsedKeys.add(k)

        const capValue = matchRes.matchedValue.charAt(0).toUpperCase() + matchRes.matchedValue.slice(1)
        let newKey = dk.replace(`{${placeholder}}`, capValue)
        newKey = newKey.charAt(0).toLowerCase() + newKey.slice(1)
        keyReplacements[k] = newKey
      }
    }
  }

  const groups: Record<string, { keys: string[]; values: string[]; prefix: string; suffixPattern: string }> = {}
  const staticKeys = Object.keys(staticEntries)
  for (const k of staticKeys) {
    if (collapsedKeys.has(k)) continue
    const val = staticEntries[k]
    const isCssOrSpecial =
      val.includes('[') ||
      val.includes(']') ||
      val.includes('=') ||
      val.includes(':') ||
      val.includes('.') ||
      val.includes('#')
    const idSelectorMatch = val.match(/^#([a-zA-Z0-9_-]+)[-_]([a-zA-Z0-9_-]+)$/)
    const classSelectorMatch = val.match(/^\.([a-zA-Z0-9_-]+)[-_]([a-zA-Z0-9_-]+)$/)
    const testIdMatch = !isCssOrSpecial ? val.match(/^(.*?)[-_]([^-]+)$/) : null
    const attrMatch = val.match(/^\[([a-zA-Z0-9_-]+)="([^"]+)"\]$/)
    const roleMatch = val.match(/^internal:role=([a-zA-Z0-9_-]+)\[name="([^"]+)"i\]$/)
    const textMatch = val.match(/^(?:text|internal:text)=["']?([^"']+)["']?i?$/)

    if (idSelectorMatch) {
      const prefix = idSelectorMatch[1]
      const suffix = idSelectorMatch[2]
      const groupKey = `idSelector:${prefix}`
      if (!groups[groupKey]) {
        groups[groupKey] = {
          keys: [],
          values: [],
          prefix,
          suffixPattern: 'idSelector'
        }
      }
      groups[groupKey].keys.push(k)
      groups[groupKey].values.push(suffix)
    } else if (classSelectorMatch) {
      const prefix = classSelectorMatch[1]
      const suffix = classSelectorMatch[2]
      const groupKey = `classSelector:${prefix}`
      if (!groups[groupKey]) {
        groups[groupKey] = {
          keys: [],
          values: [],
          prefix,
          suffixPattern: 'classSelector'
        }
      }
      groups[groupKey].keys.push(k)
      groups[groupKey].values.push(suffix)
    } else if (testIdMatch) {
      const prefix = testIdMatch[1]
      const suffix = testIdMatch[2]
      const groupKey = `testId:${prefix}`
      if (!groups[groupKey]) {
        groups[groupKey] = {
          keys: [],
          values: [],
          prefix,
          suffixPattern: 'testId'
        }
      }
      groups[groupKey].keys.push(k)
      groups[groupKey].values.push(suffix)
    } else if (attrMatch) {
      const attrName = attrMatch[1]
      const attrValue = attrMatch[2]
      const groupKey = `attr:${attrName}`
      if (!groups[groupKey]) {
        groups[groupKey] = {
          keys: [],
          values: [],
          prefix: attrName,
          suffixPattern: 'attr'
        }
      }
      groups[groupKey].keys.push(k)
      groups[groupKey].values.push(attrValue)
    } else if (roleMatch) {
      const roleVal = roleMatch[1]
      const nameVal = roleMatch[2]
      const groupKey = `role:${roleVal}`
      if (!groups[groupKey]) {
        groups[groupKey] = {
          keys: [],
          values: [],
          prefix: roleVal,
          suffixPattern: 'role'
        }
      }
      groups[groupKey].keys.push(k)
      groups[groupKey].values.push(nameVal)
    } else if (textMatch) {
      const textValue = textMatch[1]
      const groupKey = `text:text`
      if (!groups[groupKey]) {
        groups[groupKey] = {
          keys: [],
          values: [],
          prefix: 'text',
          suffixPattern: 'text'
        }
      }
      groups[groupKey].keys.push(k)
      groups[groupKey].values.push(textValue)
    }
  }

  for (const gk of Object.keys(groups)) {
    const group = groups[gk]
    if (group.keys.length >= 2 || (group.keys.length === 1 && group.values.every((v) => /^\d+$/.test(v)))) {
      let placeholder = 'item'
      if (group.values.every((v) => /^\d+$/.test(v))) {
        placeholder = 'id'
      } else if (
        group.prefix.toLowerCase().includes('filter') ||
        group.prefix.toLowerCase().includes('button') ||
        group.prefix.toLowerCase().includes('btn')
      ) {
        placeholder = 'btn'
      }

      let dynamicKey = ''
      let entry: any = {}

      if (group.suffixPattern === 'testId') {
        dynamicKey = toCamelCase(group.prefix) + `{${placeholder}}`
        entry = {
          [placeholder]: group.values,
          testId: group.prefix + '-' + placeholder
        }
      } else if (group.suffixPattern === 'idSelector') {
        dynamicKey = toCamelCase(group.prefix) + `{${placeholder}}`
        entry = {
          [placeholder]: group.values,
          selector: `#${group.prefix}-{${placeholder}}`
        }
      } else if (group.suffixPattern === 'classSelector') {
        dynamicKey = toCamelCase(group.prefix) + `{${placeholder}}`
        entry = {
          [placeholder]: group.values,
          selector: `.${group.prefix}-{${placeholder}}`
        }
      } else if (group.suffixPattern === 'attr') {
        const commonPrefix = findCommonPrefix(group.values)
        if (commonPrefix) {
          dynamicKey = toCamelCase(commonPrefix) + `{${placeholder}}`
          entry = {
            [placeholder]: group.values.map((v) => v.substring(commonPrefix.length + 1)),
            selector: `[${group.prefix}="${commonPrefix}-{${placeholder}}"]`
          }
        } else {
          dynamicKey = `{${placeholder}}`
          entry = {
            [placeholder]: group.values,
            selector: `[${group.prefix}="{${placeholder}}"]`
          }
        }
      } else if (group.suffixPattern === 'role') {
        const placeholder = group.prefix === 'button' ? 'btn' : 'item'
        dynamicKey = `{${placeholder}}`
        entry = {
          [placeholder]: group.values,
          selector: `internal:role=${group.prefix}[name="{${placeholder}}"i]`
        }
      } else if (group.suffixPattern === 'text') {
        dynamicKey = `{${placeholder}}`
        entry = {
          [placeholder]: group.values,
          selector: `text="{${placeholder}}"`
        }
      }

      if (dynamicKey) {
        dynamicEntries[dynamicKey] = entry
        group.keys.forEach((oldKey, idx) => {
          collapsedKeys.add(oldKey)
          const val = (entry[placeholder] ? entry[placeholder][idx] : group.values[idx]) as string
          let newKey = ''
          if (dynamicKey === `{${placeholder}}`) {
            newKey = val
          } else {
            const capValue = val.charAt(0).toUpperCase() + val.slice(1)
            newKey = dynamicKey.replace(`{${placeholder}}`, capValue)
            newKey = newKey.charAt(0).toLowerCase() + newKey.slice(1)
          }
          keyReplacements[oldKey] = newKey
        })
      }
    }
  }

  for (const k of Object.keys(dict)) {
    if (collapsedKeys.has(k)) continue
    if (dynamicEntries[k]) {
      result[k] = dynamicEntries[k]
    } else {
      result[k] = dict[k]
    }
  }

  for (const k of Object.keys(dynamicEntries)) {
    if (!result[k]) {
      result[k] = dynamicEntries[k]
    }
  }

  return result
}

export function writeRegistry(filePath: string, registryObj: any, overrideMode?: boolean, usedPageKeys?: Set<string> | string[]) {
  try {
    const keyReplacements: Record<string, string> = {}

    const codegenKeys = Object.keys(registryObj).filter((k) => {
      const pageConfig = registryObj[k]
      const usedSet = usedPageKeys ? (usedPageKeys instanceof Set ? usedPageKeys : new Set(usedPageKeys)) : new Set<string>()
      const isUsed = usedSet.has(k)

      if (pageConfig && !isUsed) {
        let hasLocators = false
        for (const sk of Object.keys(pageConfig)) {
          if (sk !== 'url' && pageConfig[sk] && Object.keys(pageConfig[sk]).length > 0) {
            hasLocators = true
            break
          }
        }
        if (!hasLocators) return false
      }
      const isDefaultCodegen = k.startsWith('codegen_') || k === 'codegenPage'
      if (isUsed) {
        return true
      }
      if (overrideMode) {
        return true
      }
      return isDefaultCodegen
    })

    for (const codegenKey of codegenKeys) {
      const pageConfig = registryObj[codegenKey]
      if (pageConfig) {
        if (pageConfig.testId) {
          pageConfig.testId = collapsePageDict(pageConfig.testId, true, keyReplacements)
        }
        if (pageConfig.testIds) {
          pageConfig.testIds = collapsePageDict(pageConfig.testIds, true, keyReplacements)
        }
        if (pageConfig.selector) {
          pageConfig.selector = collapsePageDict(pageConfig.selector, false, keyReplacements)
        }
        if (pageConfig.selectors) {
          pageConfig.selectors = collapsePageDict(pageConfig.selectors, false, keyReplacements)
        }
      }
    }

    let content = fs.readFileSync(filePath, 'utf8')

    const serialize = (obj: any, indent = 2, isTestIdsOrSelectors = false): string => {
      const spaces = ' '.repeat(indent)
      if (obj === null) return 'null'
      if (obj === undefined) return 'undefined'
      if (typeof obj === 'string') {
        return `'${obj.replace(/'/g, "\\'")}'`
      }
      if (typeof obj === 'number' || typeof obj === 'boolean') {
        return String(obj)
      }
      if (Array.isArray(obj)) {
        return '[' + obj.map((x) => serialize(x, indent, false)).join(', ') + ']'
      }
      if (typeof obj === 'object') {
        let keys = Object.keys(obj)
        if (isTestIdsOrSelectors) {
          keys = keys.sort((a, b) => a.localeCompare(b))
        } else if (indent === 4) {
          const order = [
            'url', 'testId', 'testIds', 'selector', 'selectors',
            'text', 'label', 'title', 'placeholder', 'altText',
            'button', 'checkbox', 'radio', 'heading', 'link', 'dialog',
            'textbox', 'searchbox', 'combobox', 'list', 'listbox',
            'menu', 'menuitem', 'option', 'row', 'cell', 'grid', 'gridcell',
            'tab', 'tabpanel', 'switch', 'progressbar', 'status', 'tooltip',
            'tree', 'treeitem', 'banner', 'navigation', 'article', 'main', 'form', 'region'
          ]
          keys = keys.sort((a, b) => {
            const idxA = order.indexOf(a)
            const idxB = order.indexOf(b)
            if (idxA !== -1 && idxB !== -1) return idxA - idxB
            if (idxA !== -1) return -1
            if (idxB !== -1) return 1
            return a.localeCompare(b)
          })
        }
        if (keys.length === 0) return '{}'
        let res = '{\n'
        keys.forEach((key, index) => {
          const formattedKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : `'${key.replace(/'/g, "\\'")}'`
          const nextIsTestIdsOrSelectors = isTestIdsOrSelectors || key === 'testId' || key === 'testIds' || key === 'selector' || key === 'selectors'
          res += `${spaces}  ${formattedKey}: ${serialize(obj[key], indent + 2, nextIsTestIdsOrSelectors)}${index < keys.length - 1 ? ',\n' : '\n'}`
        })
        res += `${spaces}}`
        return res
      }
      return 'undefined'
    }

    for (const codegenKey of codegenKeys) {
      const escapedKey = codegenKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const keyPattern = new RegExp(`(['"\`]?${escapedKey}['"\`]?\\s*:\\s*\\{)`)
      const match = content.match(keyPattern)

      if (match && match.index !== undefined) {
        const startIdx = match.index + match[0].length - 1
        let braceCount = 0
        let endIdx = -1
        for (let i = startIdx; i < content.length; i++) {
          if (content[i] === '{') braceCount++
          else if (content[i] === '}') {
            braceCount--
            if (braceCount === 0) {
              endIdx = i + 1
              break
            }
          }
        }
        if (endIdx !== -1) {
          const updatedObjectText = serialize(registryObj[codegenKey], 2)
          content = content.substring(0, startIdx) + updatedObjectText + content.substring(endIdx)
        }
      } else {
        const bounds = findRegistryCallBounds(content)
        if (bounds) {
          const lastBraceIdx = content.lastIndexOf('}', bounds.endIdx)
          if (lastBraceIdx !== -1) {
            const formattedKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(codegenKey)
              ? codegenKey
              : `'${codegenKey}'`
            const serializedPage = `  ${formattedKey}: ${serialize(registryObj[codegenKey], 2)}`

            let lastCharIdx = lastBraceIdx - 1
            while (lastCharIdx > bounds.startIdx && /\s/.test(content[lastCharIdx])) {
              lastCharIdx--
            }

            if (content[lastCharIdx] === '}' && content[lastCharIdx + 1] !== ',') {
              content = content.substring(0, lastCharIdx + 1) + ',\n' + serializedPage + '\n' + content.substring(lastBraceIdx)
            } else {
              const beforeBrace = content.substring(bounds.startIdx, lastBraceIdx).trim()
              const needsComma = beforeBrace.length > 0 && !beforeBrace.endsWith(',') && !beforeBrace.endsWith('{')
              const insertText = (needsComma ? ',\n' : '\n') + serializedPage + '\n'
              content = content.substring(0, lastBraceIdx) + insertText + content.substring(lastBraceIdx)
            }
          }
        }
      }
    }

    fs.writeFileSync(filePath, content, 'utf8')

    if (Object.keys(keyReplacements).length > 0) {
      const testsDir = path.join(path.dirname(filePath), '../tests')
      if (fs.existsSync(testsDir)) {
        const files = fs.readdirSync(testsDir)
        for (const file of files) {
          if (file.endsWith('.spec.ts') || file.endsWith('.test.ts')) {
            const specPath = path.join(testsDir, file)
            let specContent = fs.readFileSync(specPath, 'utf8')
            let modified = false
            for (const oldKey of Object.keys(keyReplacements)) {
              const newKey = keyReplacements[oldKey]
              const regex = new RegExp(`(['"\`])${oldKey}(['"\`])`, 'g')
              const before = specContent
              specContent = specContent.replace(regex, `$1${newKey}$2`)
              if (specContent !== before) modified = true
            }
            if (modified) {
              fs.writeFileSync(specPath, specContent, 'utf8')
            }
          }
        }
      }
    }

    return keyReplacements
  } catch (e) {
    console.error('Error writing registry.ts:', e)
  }
  return {}
}

export function findPageKey(url: string, title: string, registryObj: any, overrideMode?: boolean): string {
  let pathname = ''
  let hashPath = ''
  try {
    const u = new URL(url)
    pathname = u.pathname
    if (u.hash && u.hash.startsWith('#/')) {
      hashPath = u.hash.slice(1)
    }
  } catch (e) {
    pathname = url || ''
  }

  const cleanPath = (p: string) => {
    let result = p.split('?')[0].split('#')[0]
    if (result.startsWith('/')) result = result.substring(1)
    if (result.endsWith('/')) result = result.slice(0, -1)
    return result
  }

  const effectivePath = (hashPath && hashPath !== '/' && hashPath !== '') 
    ? cleanPath(hashPath) 
    : cleanPath(pathname)

  for (const key of Object.keys(registryObj)) {
    const pageConfig = registryObj[key]
    if (pageConfig && pageConfig.url) {
      let configUrl = pageConfig.url
      if (configUrl.startsWith('/')) configUrl = configUrl.substring(1)
      if (configUrl.endsWith('/')) configUrl = configUrl.slice(0, -1)
      if (configUrl === effectivePath) {
        const isCodegen = key.startsWith('codegen_') || key === 'codegenPage'
        if (!overrideMode && !isCodegen) continue
        if (!effectivePath && isCodegen) continue
        return key
      }
    }
  }

  let keyBase = ''
  if (effectivePath) {
    const segments = effectivePath.split('/').filter(Boolean)
    keyBase = segments
      .map((seg, idx) => {
        const parts = seg.split(/[^a-zA-Z0-9]+/).filter(Boolean)
        if (parts.length === 0) return ''
        return parts
          .map((part, partIdx) => {
            if (idx === 0 && partIdx === 0) {
              return part.charAt(0).toLowerCase() + part.slice(1)
            }
            return part.charAt(0).toUpperCase() + part.slice(1)
          })
          .join('')
      })
      .join('')
  }
  if (!keyBase && title) {
    const firstSegment = title.split(/[|\u2014\-:]/)[0].trim()
    const cleanTitle = (firstSegment || title).replace(/[^a-zA-Z0-9\s]/g, '').trim()
    const words = cleanTitle.split(/\s+/).filter(Boolean)
    keyBase = words
      .map((w, idx) => {
        const clean = w.replace(/[^a-zA-Z0-9]/g, '')
        if (idx === 0) return clean.charAt(0).toLowerCase() + clean.slice(1)
        return clean.charAt(0).toUpperCase() + clean.slice(1)
      })
      .join('')
  }
  if (!keyBase) {
    keyBase = 'home'
  }

  if (overrideMode) {
    return keyBase
  }
  return `codegen_${keyBase}`
}

export function toCamelCase(str: string): string {
  return toRegistryKey(str)
}

function normalizePageKey(key: string): string {
  if (key.startsWith('worker') && key.length > 6) {
    return key.slice(6).charAt(0).toLowerCase() + key.slice(7)
  }
  return key
}

export function findMatchInDict(
  val: string,
  strategyType: string,
  pageKey: string,
  registryObj: any,
  overrideMode?: boolean
): MatchResult | null {
  const getExpandedKey = (dynamicKey: string, placeholder: string, value: string) => {
    const isPurePlaceholder = dynamicKey === `{${placeholder}}`
    let capValue = ''
    if (isPurePlaceholder) {
      capValue = value
    } else {
      const words = value.split(/[^a-zA-Z0-9]/).filter(Boolean)
      capValue = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('')
    }
    return dynamicKey.replace(`{${placeholder}}`, capValue)
  }

  let targetPageKey = pageKey
  for (const k of Object.keys(registryObj)) {
    if (normalizePageKey(k) === normalizePageKey(pageKey)) {
      targetPageKey = k
      break
    }
  }
  const pageConfig = registryObj[targetPageKey] || {}

  const searchConfig = (config: any, pk: string): MatchResult | null => {
    if (strategyType === 'testId') {
      const dict = config.testId || config.testIds || {}
      for (const k of Object.keys(dict)) {
        const entry = dict[k]
        if (typeof entry === 'object' && entry !== null) {
          const { matches, matchedValue, placeholderName } = matchDynamicEntry(val, entry, true)
          if (matches && matchedValue && placeholderName) {
            const arr = entry[placeholderName] || []
            if (!arr.includes(matchedValue)) {
              entry[placeholderName] = [...arr, matchedValue]
            }
            const expandedKey = getExpandedKey(k, placeholderName, matchedValue)
            return { pageKey: pk, elementKey: expandedKey, val, type: 'testId', isNew: false }
          }
        } else if (entry === val) {
          return { pageKey: pk, elementKey: k, val, type: 'testId', isNew: false }
        }
      }
    } else if (strategyType === 'selector') {
      const dict = config.selector || config.selectors || {}
      for (const k of Object.keys(dict)) {
        const entry = dict[k]
        if (typeof entry === 'object' && entry !== null) {
          const { matches, matchedValue, placeholderName } = matchDynamicEntry(val, entry, false)
          if (matches && matchedValue && placeholderName) {
            const arr = entry[placeholderName] || []
            if (!arr.includes(matchedValue)) {
              entry[placeholderName] = [...arr, matchedValue]
            }
            const expandedKey = getExpandedKey(k, placeholderName, matchedValue)
            return { pageKey: pk, elementKey: expandedKey, val, type: 'selector', isNew: false }
          }
        } else if (entry === val) {
          return { pageKey: pk, elementKey: k, val, type: 'selector', isNew: false }
        }
      }
    } else {
      const arr = config[strategyType]
      if (Array.isArray(arr)) {
        if (arr.includes(val)) {
          const elementKey = val
          return { pageKey: pk, elementKey, val, type: strategyType, isNew: false }
        }
      }
    }
    return null
  }

  const targetMatch = searchConfig(pageConfig, targetPageKey)
  if (targetMatch) return targetMatch

  for (const pk of Object.keys(registryObj)) {
    if (normalizePageKey(pk) === normalizePageKey(pageKey)) continue

    const isCurrentCodegen = pageKey.startsWith('codegen_') || pageKey === 'codegenPage'
    const isOtherCodegen = pk.startsWith('codegen_') || pk === 'codegenPage'
    if (isCurrentCodegen && isOtherCodegen) continue

    const config = registryObj[pk] || {}
    const match = searchConfig(config, pk)
    if (match) return match
  }

  return null
}

export function findElementKey(
  selector: string,
  pageKey: string,
  registryObj: any,
  overrideMode?: boolean,
  extra?: { targetTestId?: string; targetId?: string; targetParentId?: string; overrideType?: string }
): MatchResult {
  let { type, val } = getSelectorValue(selector)
  if (extra?.overrideType) {
    type = extra.overrideType
  }

  // 1. Try matching with the selector itself first
  const selectorMatch = findMatchInDict(val, type, pageKey, registryObj, overrideMode)
  if (selectorMatch) return selectorMatch

  // 1.5. Check if the value exists in ANY other strategy array/object under the page config to avoid duplicates and recreation
  const pageConfig = registryObj[pageKey] || {}
  for (const k of Object.keys(pageConfig)) {
    if (k === 'url') continue
    const match = findMatchInDict(val, k, pageKey, registryObj, overrideMode)
    if (match) {
      return match
    }
  }

  // 2. Try matching targetTestId (if any) against testIds in registry
  if (extra?.targetTestId) {
    const testIdMatch = findMatchInDict(extra.targetTestId, 'testId', pageKey, registryObj, overrideMode)
    if (testIdMatch) return testIdMatch
  }

  // 3. Try matching targetId (if any) against selectors/testIds
  if (extra?.targetId) {
    const idSelectorMatch = findMatchInDict(extra.targetId, 'selector', pageKey, registryObj, overrideMode)
    if (idSelectorMatch) return idSelectorMatch
    const idTestIdMatch = findMatchInDict(extra.targetId, 'testId', pageKey, registryObj, overrideMode)
    if (idTestIdMatch) return idTestIdMatch
  }

  // 4. Try matching targetParentId (if any) against selectors/testIds
  if (extra?.targetParentId) {
    const pIdSelectorMatch = findMatchInDict(extra.targetParentId, 'selector', pageKey, registryObj, overrideMode)
    if (pIdSelectorMatch) return pIdSelectorMatch
  }

  // Already declared above: pageConfig

  let baseKey = (type === 'testId' || type === 'selector') ? toCamelCase(val) : val
  if (!baseKey) baseKey = 'element'

  let finalKey = baseKey
  let counter = 1
  const existingKeys = new Set<string>()
  for (const key of Object.keys(pageConfig)) {
    const entry = pageConfig[key]
    if (Array.isArray(entry)) {
      entry.forEach(v => existingKeys.add(v))
    } else if (typeof entry === 'object' && entry !== null) {
      Object.keys(entry).forEach(k => existingKeys.add(k))
    }
  }

  while (existingKeys.has(finalKey)) {
    finalKey = baseKey + counter
    counter++
  }

  return { pageKey, elementKey: finalKey, val, type, isNew: true }
}

export function formatActionCall(
  pageKey: string,
  elementKey: string,
  action: any,
  isTextSelector = false,
  textValue?: string
): string {
  const getLocatorExpression = () => {
    if (isTextSelector && textValue) {
      let expr = `${pageKey}.page.getByText('${textValue.replace(/'/g, "\\'")}')`
      if (action.nth !== undefined && action.nth !== 0) {
        expr += `.nth(${action.nth})`
      }
      return expr
    }
    return null
  }

  // Escape single quotes in elementKey so generated code like click('I\'m Feeling Lucky') is valid JS
  const safeKey = elementKey.replace(/'/g, "\\'")

  switch (action.name) {
    case 'click': {
      let method = 'click'
      if (action.clickCount === 2) method = 'dblclick'
      let opts = []
      if (action.modifiers && action.modifiers.length) {
        opts.push(`modifiers: [${action.modifiers.map((m: string) => `'${m}'`).join(', ')}]`)
      }

      const locatorExpr = getLocatorExpression()
      if (locatorExpr) {
        const optsStr = opts.length ? `{ ${opts.join(', ')} }` : ''
        return `  await ${locatorExpr}.${method}(${optsStr});`
      }

      if (action.nth !== undefined && action.nth !== 0) {
        opts.push(`nth: ${action.nth}`)
      }
      const optsStr = opts.length ? `, { ${opts.join(', ')} }` : ''
      return `  await ${pageKey}.${method}('${safeKey}'${optsStr});`
    }
    case 'hover': {
      const locatorExpr = getLocatorExpression()
      if (locatorExpr) {
        return `  await ${locatorExpr}.hover();`
      }
      const optsStr = action.nth !== undefined && action.nth !== 0 ? `, { nth: ${action.nth} }` : ''
      return `  await ${pageKey}.hover('${safeKey}'${optsStr});`
    }
    case 'check': {
      const locatorExpr = getLocatorExpression()
      if (locatorExpr) {
        return `  await ${locatorExpr}.check();`
      }
      const optsStr = action.nth !== undefined && action.nth !== 0 ? `, { nth: ${action.nth} }` : ''
      return `  await ${pageKey}.check('${safeKey}'${optsStr});`
    }
    case 'uncheck': {
      const locatorExpr = getLocatorExpression()
      if (locatorExpr) {
        return `  await ${locatorExpr}.uncheck();`
      }
      const optsStr = action.nth !== undefined && action.nth !== 0 ? `, { nth: ${action.nth} }` : ''
      return `  await ${pageKey}.uncheck('${safeKey}'${optsStr});`
    }
    case 'fill': {
      const locatorExpr = getLocatorExpression()
      if (locatorExpr) {
        return `  await ${locatorExpr}.fill('${action.text.replace(/'/g, "\\'")}');`
      }
      const optsStr = action.nth !== undefined && action.nth !== 0 ? `, { nth: ${action.nth} }` : ''
      return `  await ${pageKey}.fill('${safeKey}', '${action.text.replace(/'/g, "\\'")}'${optsStr});`
    }
    case 'setInputFiles': {
      const locatorExpr = getLocatorExpression()
      if (locatorExpr) {
        return `  await ${locatorExpr}.setInputFiles(${JSON.stringify(action.files)});`
      }
      const optsStr = action.nth !== undefined && action.nth !== 0 ? `, { nth: ${action.nth} }` : ''
      return `  await ${pageKey}.setInputFiles('${safeKey}', ${JSON.stringify(action.files)}${optsStr});`
    }
    case 'press': {
      const modifiers = Array.isArray(action.modifiers) ? action.modifiers : []
      const shortcut = [...modifiers, action.key].join('+')
      const locatorExpr = getLocatorExpression()
      if (locatorExpr) {
        return `  await ${locatorExpr}.press('${shortcut}');`
      }
      const optsStr = action.nth !== undefined && action.nth !== 0 ? `, { nth: ${action.nth} }` : ''
      return `  await ${pageKey}.press('${safeKey}', '${shortcut}'${optsStr});`
    }
    case 'navigate':
      return `  await ${pageKey}.goto();`
    case 'select': {
      const locatorExpr = getLocatorExpression()
      if (locatorExpr) {
        return `  await ${locatorExpr}.selectOption(${JSON.stringify(action.options)});`
      }
      const optsStr = action.nth !== undefined && action.nth !== 0 ? `, { nth: ${action.nth} }` : ''
      return `  await ${pageKey}.selectOption('${safeKey}', ${JSON.stringify(action.options)}${optsStr});`
    }
    case 'assertText': {
      const locatorExpr = getLocatorExpression()
      if (locatorExpr) {
        return `  await expect(${locatorExpr}).${action.substring ? 'toContainText' : 'toHaveText'}('${action.text.replace(/'/g, "\\'")}');`
      }
      const opts = []
      if (action.nth !== undefined && action.nth !== 0) opts.push(`nth: ${action.nth}`)
      const optsStr = opts.length ? `, { ${opts.join(', ')} }` : ''
      return `  await ${pageKey}.verify('${safeKey}'${optsStr}).${action.substring ? 'toContainText' : 'toHaveText'}('${action.text.replace(/'/g, "\\'")}');`
    }
    case 'assertChecked': {
      const locatorExpr = getLocatorExpression()
      if (locatorExpr) {
        return `  await expect(${locatorExpr})${action.checked ? '' : '.not'}.toBeChecked();`
      }
      const opts = []
      if (action.nth !== undefined && action.nth !== 0) opts.push(`nth: ${action.nth}`)
      const optsStr = opts.length ? `, { ${opts.join(', ')} }` : ''
      return `  await ${pageKey}.verify('${safeKey}'${optsStr})${action.checked ? '' : '.not'}.toBeChecked();`
    }
    case 'assertVisible': {
      const locatorExpr = getLocatorExpression()
      if (locatorExpr) {
        return `  await expect(${locatorExpr}).toBeVisible();`
      }
      const opts = []
      if (action.nth !== undefined && action.nth !== 0) opts.push(`nth: ${action.nth}`)
      const optsStr = opts.length ? `, { ${opts.join(', ')} }` : ''
      return `  await ${pageKey}.verify('${safeKey}'${optsStr});`
    }
    case 'assertValue': {
      const locatorExpr = getLocatorExpression()
      if (locatorExpr) {
        const assertion = action.value ? `toHaveValue('${action.value.replace(/'/g, "\\'")}')` : `toBeEmpty()`
        return `  await expect(${locatorExpr}).${assertion};`
      }
      const opts = []
      if (action.nth !== undefined && action.nth !== 0) opts.push(`nth: ${action.nth}`)
      const optsStr = opts.length ? `, { ${opts.join(', ')} }` : ''
      const assertion = action.value ? `toHaveValue('${action.value.replace(/'/g, "\\'")}')` : `toBeEmpty()`
      return `  await ${pageKey}.verify('${safeKey}'${optsStr}).${assertion};`
    }
    case 'assertSnapshot': {
      const locatorExpr = getLocatorExpression()
      if (locatorExpr) {
        return `  await expect(${locatorExpr}).toMatchAriaSnapshot(\`\n${action.ariaSnapshot}\`);`
      }
      const opts = []
      if (action.nth !== undefined && action.nth !== 0) opts.push(`nth: ${action.nth}`)
      const optsStr = opts.length ? `, { ${opts.join(', ')} }` : ''
      return `  await ${pageKey}.verify('${safeKey}'${optsStr}).toMatchAriaSnapshot(\`\n${action.ariaSnapshot}\`);`
    }
    default:
      return `  // Unsupported action: ${action.name} on ${elementKey}`
  }
}

export * from './config'
export * from './generator/index'
export * from './types'
export * from './scorer'
