import * as fs from 'fs'
import * as path from 'path'

export interface SelectorMatch {
  type: 'testId' | 'selector'
  val: string
}

export interface MatchResult {
  pageKey: string
  elementKey: string
  val: string
  type: 'testId' | 'selector'
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
      // Strip outer quotes if captured
      val = val.replace(/^["']|["']$/g, '')
      return { type: 'testId', val }
    }
  }

  // 2. Try to find ID selector
  const idRegexes = [/id=([a-zA-Z0-9_-]+)/, /#([a-zA-Z0-9_-]+)/]
  for (const regex of idRegexes) {
    const match = selector.match(regex)
    if (match) {
      return { type: 'selector', val: `#${match[1]}` }
    }
  }

  // 3. Try to find class selectors
  const classRegexes = [/\.([a-zA-Z0-9_-]+)/]
  for (const regex of classRegexes) {
    const match = selector.match(regex)
    if (match) {
      return { type: 'selector', val: `.${match[1]}` }
    }
  }

  // 4. Fallback to raw selector
  return { type: 'selector', val: selector }
}

export function findRegistryFile(dir: string): string | null {
  // 1. Search downward
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

  // 2. Search upward if not found downward
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
  // 1. Search downward
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

  // 2. Search upward if not found downward
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

    // Collect all codegen page keys: codegen_* prefix + legacy codegenPage
    const codegenKeys = Object.keys(registryObj).filter((k) => {
      const pageConfig = registryObj[k]
      const usedSet = usedPageKeys ? (usedPageKeys instanceof Set ? usedPageKeys : new Set(usedPageKeys)) : new Set<string>()
      const isUsed = usedSet.has(k)

      if (pageConfig && !isUsed) {
        const hasLocators = (pageConfig.testIds && Object.keys(pageConfig.testIds).length > 0) ||
                            (pageConfig.selectors && Object.keys(pageConfig.selectors).length > 0);
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

    // Automatically collapse similar static keys in each codegen page config before writing
    for (const codegenKey of codegenKeys) {
      const pageConfig = registryObj[codegenKey]
      if (pageConfig) {
        if (pageConfig.testIds) {
          pageConfig.testIds = collapsePageDict(pageConfig.testIds, true, keyReplacements)
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
        }
        if (keys.length === 0) return '{}'
        let res = '{\n'
        keys.forEach((key, index) => {
          const formattedKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : `'${key.replace(/'/g, "\\'")}'`
          const nextIsTestIdsOrSelectors = isTestIdsOrSelectors || key === 'testIds' || key === 'selectors'
          res += `${spaces}  ${formattedKey}: ${serialize(obj[key], indent + 2, nextIsTestIdsOrSelectors)}${index < keys.length - 1 ? ',\n' : '\n'}`
        })
        res += `${spaces}}`
        return res
      }
      return 'undefined'
    }

    // Process each codegen key: update existing entry in-place, or append as new
    for (const codegenKey of codegenKeys) {
      const escapedKey = codegenKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const keyPattern = new RegExp(`(['"\`]?${escapedKey}['"\`]?\\s*:\\s*\\{)`)
      const match = content.match(keyPattern)

      if (match && match.index !== undefined) {
        // Key exists in file — find its object bounds and update in-place
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
        // Key is new — append before the closing brace of createPageRegistry(...)
        const bounds = findRegistryCallBounds(content)
        if (bounds) {
          const lastBraceIdx = content.lastIndexOf('}', bounds.endIdx)
          if (lastBraceIdx !== -1) {
            const formattedKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(codegenKey)
              ? codegenKey
              : `'${codegenKey}'`
            const serializedPage = `  ${formattedKey}: ${serialize(registryObj[codegenKey], 2)}`

            // Find the last non-whitespace character inside the registry call to insert the comma correctly
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

    // Refactor key references in test files
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
    // Handle hash-based SPA routing: only treat it as a route if it starts with '#/'
    if (u.hash && u.hash.startsWith('#/')) {
      hashPath = u.hash.slice(1) // Keep the leading '/' (e.g., '/pw-core')
    }
  } catch (e) {
    pathname = url || ''
  }

  // Strip query parameters and hash/fragment IDs from both pathnames
  const cleanPath = (p: string) => {
    let result = p.split('?')[0].split('#')[0]
    if (result.startsWith('/')) result = result.substring(1)
    if (result.endsWith('/')) result = result.slice(0, -1)
    return result
  }

  const effectivePath = (hashPath && hashPath !== '/' && hashPath !== '') 
    ? cleanPath(hashPath) 
    : cleanPath(pathname)

  // Return the key of an existing hand-written registry entry if the URL matches exactly.
  // For root URL (effectivePath is ''), skip codegen_* entries to allow title-based
  // page disambiguation — otherwise everything on root-URL SPAs would accumulate into one entry.
  for (const key of Object.keys(registryObj)) {
    const pageConfig = registryObj[key]
    if (pageConfig && pageConfig.url) {
      let configUrl = pageConfig.url
      if (configUrl.startsWith('/')) configUrl = configUrl.substring(1)
      if (configUrl.endsWith('/')) configUrl = configUrl.slice(0, -1)
      if (configUrl === effectivePath) {
        const isCodegen = key.startsWith('codegen_') || key === 'codegenPage'
        
        // In default mode, do not match/reuse hand-written (non-codegen) pages
        if (!overrideMode && !isCodegen) continue
        
        // At root (''), don't auto-match existing codegen entries; fall through to title key
        if (!effectivePath && isCodegen) continue
        return key
      }
    }
  }

  // Derive a camelCase key from the effective path segments.
  // Hyphens and underscores within a segment are treated as word separators
  // so that e.g. /pw-core => pwCore and /k6-core => k6Core.
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
  // When URL gives no path (root-URL SPA), use the page title to create a distinct key.
  // Take the first meaningful segment before common separators: "Login | QECore" → "login"
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

  // Prefix with codegen_ to distinguish auto-generated entries from hand-written page objects
  if (overrideMode) {
    return keyBase
  }
  return `codegen_${keyBase}`
}

function toCamelCase(str: string): string {
  const structuralWords = [
    'option',
    'title',
    'button',
    'btn',
    'link',
    'input',
    'checkbox',
    'label',
    'value',
    'text',
    'wrapper',
    'container',
    'card',
    'item'
  ]
  let clean = str
  for (const word of structuralWords) {
    const regex = new RegExp(`(^|[^a-zA-Z0-9])${word}([^a-zA-Z0-9]|$)`, 'gi')
    clean = clean.replace(regex, '$1$2')
  }
  const hasSpaces = str.includes(' ')
  const words = clean.split(/[^a-zA-Z0-9]/).filter(Boolean)
  if (words.length === 0) return 'element'
  if (hasSpaces) {
    const joined = words.join('')
    const cleaned = joined.replace(/^\d+/, '').replace(/\d+$/, '')
    return cleaned || 'element'
  }
  const camel = words
    .map((word, idx) => {
      const lower = word.toLowerCase()
      if (idx === 0) return lower
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join('')

  const cleaned = camel.replace(/^\d+/, '').replace(/\d+$/, '')
  return cleaned || 'element'
}

function normalizePageKey(key: string): string {
  if (key.startsWith('worker') && key.length > 6) {
    return key.slice(6).charAt(0).toLowerCase() + key.slice(7)
  }
  return key
}

function findMatchInDict(
  val: string,
  isTestId: boolean,
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

  // 1. Search in the target page first
  let targetPageKey = pageKey
  for (const k of Object.keys(registryObj)) {
    if (normalizePageKey(k) === normalizePageKey(pageKey)) {
      targetPageKey = k
      break
    }
  }
  const pageConfig = registryObj[targetPageKey] || {}
  const targetDict = isTestId ? pageConfig.testIds || {} : pageConfig.selectors || {}

  for (const k of Object.keys(targetDict)) {
    const entry = targetDict[k]
    if (typeof entry === 'object' && entry !== null) {
      const { matches, matchedValue, placeholderName } = matchDynamicEntry(val, entry, isTestId)
      if (matches && matchedValue && placeholderName) {
        const arr = entry[placeholderName] || []
        if (!arr.includes(matchedValue)) {
          entry[placeholderName] = [...arr, matchedValue]
        }
        const expandedKey = getExpandedKey(k, placeholderName, matchedValue)
        return { pageKey: targetPageKey, elementKey: expandedKey, val, type: isTestId ? 'testId' : 'selector', isNew: false }
      }
    } else if (entry === val) {
      return { pageKey: targetPageKey, elementKey: k, val, type: isTestId ? 'testId' : 'selector', isNew: false }
    }
  }

  // 2. Search in all other pages
  for (const pk of Object.keys(registryObj)) {
    if (normalizePageKey(pk) === normalizePageKey(pageKey)) continue

    const isCurrentCodegen = pageKey.startsWith('codegen_') || pageKey === 'codegenPage'
    const isOtherCodegen = pk.startsWith('codegen_') || pk === 'codegenPage'
    if (isCurrentCodegen && isOtherCodegen) continue



    const config = registryObj[pk] || {}
    const dict = isTestId ? config.testIds || {} : config.selectors || {}
    for (const k of Object.keys(dict)) {
      const entry = dict[k]
      if (typeof entry === 'object' && entry !== null) {
        const { matches, matchedValue, placeholderName } = matchDynamicEntry(val, entry, isTestId)
        if (matches && matchedValue && placeholderName) {
          const arr = entry[placeholderName] || []
          const valueExists = arr.includes(matchedValue)
          
          if (!overrideMode && !valueExists && !isOtherCodegen) {
            continue
          }

          if (!valueExists) {
            entry[placeholderName] = [...arr, matchedValue]
          }
          const expandedKey = getExpandedKey(k, placeholderName, matchedValue)
          return {
            pageKey: pk,
            elementKey: expandedKey,
            val,
            type: isTestId ? 'testId' : 'selector',
            isNew: false
          }
        }
      } else if (entry === val) {
        return { pageKey: pk, elementKey: k, val, type: isTestId ? 'testId' : 'selector', isNew: false }
      }
    }
  }

  return null
}

export function findElementKey(
  selector: string,
  pageKey: string,
  registryObj: any,
  overrideMode?: boolean,
  extra?: { targetTestId?: string; targetId?: string; targetParentId?: string }
): MatchResult {
  const { type, val } = getSelectorValue(selector)
  const isTestId = type === 'testId'

  // 1. Try matching with the selector itself first
  const selectorMatch = findMatchInDict(val, isTestId, pageKey, registryObj, overrideMode)
  if (selectorMatch) return selectorMatch

  // 2. Try matching targetTestId (if any) against testIds in registry
  if (extra?.targetTestId) {
    const testIdMatch = findMatchInDict(extra.targetTestId, true, pageKey, registryObj, overrideMode)
    if (testIdMatch) return testIdMatch
  }

  // 3. Try matching targetId (if any) against selectors/testIds
  if (extra?.targetId) {
    const idSelectorMatch = findMatchInDict(extra.targetId, false, pageKey, registryObj, overrideMode)
    if (idSelectorMatch) return idSelectorMatch
    const idTestIdMatch = findMatchInDict(extra.targetId, true, pageKey, registryObj, overrideMode)
    if (idTestIdMatch) return idTestIdMatch
  }

  // 4. Try matching targetParentId (if any) against selectors/testIds
  if (extra?.targetParentId) {
    const pIdSelectorMatch = findMatchInDict(extra.targetParentId, false, pageKey, registryObj, overrideMode)
    if (pIdSelectorMatch) return pIdSelectorMatch
  }

  const pageConfig = registryObj[pageKey] || {}

  // Generate a new key name using toCamelCase
  let baseKey = ''
  if (isTestId) {
    baseKey = toCamelCase(val)
    const testIds = pageConfig.testIds || {}
    if (testIds[baseKey]) {
      return { pageKey, elementKey: baseKey, val, type, isNew: false }
    }
  } else {
    if (val.startsWith('#') || val.startsWith('.')) {
      baseKey = toCamelCase(val.substring(1))
    } else {
      const nameMatch = selector.match(/name="([^"]+)"/i) || selector.match(/name='([^']+)'/i)
      if (nameMatch) {
        baseKey = toCamelCase(nameMatch[1])
      } else {
        const textMatch =
          selector.match(/text=([^"\s]+)/i) ||
          selector.match(/text="([^"]+)"/i) ||
          selector.match(/text='([^']+)'/i) ||
          selector.match(/has-text\("([^"]+)"\)/i) ||
          selector.match(/has-text\('([^']+)'\)/i) ||
          selector.match(/has-text\=\/\^([^\$]+)\$\//i) ||
          selector.match(/has-text\=\/([^\/]+)\//i)
        if (textMatch) {
          baseKey = toCamelCase(textMatch[1])
        } else {
          baseKey = 'element'
        }
      }
    }
    const selectors = pageConfig.selectors || {}
    if (selectors[baseKey]) {
      return { pageKey, elementKey: baseKey, val, type, isNew: false }
    }
  }

  if (!baseKey) baseKey = 'element'

  let finalKey = baseKey
  let counter = 1
  const existingKeys = new Set([...Object.keys(pageConfig.testIds || {}), ...Object.keys(pageConfig.selectors || {})])
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
      return `  await ${pageKey}.${method}('${elementKey}'${optsStr});`
    }
    case 'hover': {
      const locatorExpr = getLocatorExpression()
      if (locatorExpr) {
        return `  await ${locatorExpr}.hover();`
      }
      const optsStr = action.nth !== undefined && action.nth !== 0 ? `, { nth: ${action.nth} }` : ''
      return `  await ${pageKey}.hover('${elementKey}'${optsStr});`
    }
    case 'check': {
      const locatorExpr = getLocatorExpression()
      if (locatorExpr) {
        return `  await ${locatorExpr}.check();`
      }
      const optsStr = action.nth !== undefined && action.nth !== 0 ? `, { nth: ${action.nth} }` : ''
      return `  await ${pageKey}.check('${elementKey}'${optsStr});`
    }
    case 'uncheck': {
      const locatorExpr = getLocatorExpression()
      if (locatorExpr) {
        return `  await ${locatorExpr}.uncheck();`
      }
      const optsStr = action.nth !== undefined && action.nth !== 0 ? `, { nth: ${action.nth} }` : ''
      return `  await ${pageKey}.uncheck('${elementKey}'${optsStr});`
    }
    case 'fill': {
      const locatorExpr = getLocatorExpression()
      if (locatorExpr) {
        return `  await ${locatorExpr}.fill('${action.text.replace(/'/g, "\\'")}');`
      }
      const optsStr = action.nth !== undefined && action.nth !== 0 ? `, { nth: ${action.nth} }` : ''
      return `  await ${pageKey}.fill('${elementKey}', '${action.text.replace(/'/g, "\\'")}'${optsStr});`
    }
    case 'setInputFiles': {
      const locatorExpr = getLocatorExpression()
      if (locatorExpr) {
        return `  await ${locatorExpr}.setInputFiles(${JSON.stringify(action.files)});`
      }
      const optsStr = action.nth !== undefined && action.nth !== 0 ? `, { nth: ${action.nth} }` : ''
      return `  await ${pageKey}.setInputFiles('${elementKey}', ${JSON.stringify(action.files)}${optsStr});`
    }
    case 'press': {
      const modifiers = Array.isArray(action.modifiers) ? action.modifiers : []
      const shortcut = [...modifiers, action.key].join('+')
      const locatorExpr = getLocatorExpression()
      if (locatorExpr) {
        return `  await ${locatorExpr}.press('${shortcut}');`
      }
      const optsStr = action.nth !== undefined && action.nth !== 0 ? `, { nth: ${action.nth} }` : ''
      return `  await ${pageKey}.press('${elementKey}', '${shortcut}'${optsStr});`
    }
    case 'navigate':
      return `  await ${pageKey}.goto();`
    case 'select': {
      const locatorExpr = getLocatorExpression()
      if (locatorExpr) {
        return `  await ${locatorExpr}.selectOption(${JSON.stringify(action.options)});`
      }
      const optsStr = action.nth !== undefined && action.nth !== 0 ? `, { nth: ${action.nth} }` : ''
      return `  await ${pageKey}.selectOption('${elementKey}', ${JSON.stringify(action.options)}${optsStr});`
    }
    case 'assertText': {
      const locatorExpr = getLocatorExpression()
      if (locatorExpr) {
        return `  await expect(${locatorExpr}).${action.substring ? 'toContainText' : 'toHaveText'}('${action.text.replace(/'/g, "\\'")}');`
      }
      const opts = []
      if (action.nth !== undefined && action.nth !== 0) opts.push(`nth: ${action.nth}`)
      const optsStr = opts.length ? `, { ${opts.join(', ')} }` : ''
      return `  await ${pageKey}.verify('${elementKey}'${optsStr}).${action.substring ? 'toContainText' : 'toHaveText'}('${action.text.replace(/'/g, "\\'")}');`
    }
    case 'assertChecked': {
      const locatorExpr = getLocatorExpression()
      if (locatorExpr) {
        return `  await expect(${locatorExpr})${action.checked ? '' : '.not'}.toBeChecked();`
      }
      const opts = []
      if (action.nth !== undefined && action.nth !== 0) opts.push(`nth: ${action.nth}`)
      const optsStr = opts.length ? `, { ${opts.join(', ')} }` : ''
      return `  await ${pageKey}.verify('${elementKey}'${optsStr})${action.checked ? '' : '.not'}.toBeChecked();`
    }
    case 'assertVisible': {
      const locatorExpr = getLocatorExpression()
      if (locatorExpr) {
        return `  await expect(${locatorExpr}).toBeVisible();`
      }
      const opts = []
      if (action.nth !== undefined && action.nth !== 0) opts.push(`nth: ${action.nth}`)
      const optsStr = opts.length ? `, { ${opts.join(', ')} }` : ''
      return `  await ${pageKey}.verify('${elementKey}'${optsStr});`
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
      return `  await ${pageKey}.verify('${elementKey}'${optsStr}).${assertion};`
    }
    case 'assertSnapshot': {
      const locatorExpr = getLocatorExpression()
      if (locatorExpr) {
        return `  await expect(${locatorExpr}).toMatchAriaSnapshot(\`\n${action.ariaSnapshot}\`);`
      }
      const opts = []
      if (action.nth !== undefined && action.nth !== 0) opts.push(`nth: ${action.nth}`)
      const optsStr = opts.length ? `, { ${opts.join(', ')} }` : ''
      return `  await ${pageKey}.verify('${elementKey}'${optsStr}).toMatchAriaSnapshot(\`\n${action.ariaSnapshot}\`);`
    }
    default:
      return `  // Unsupported action: ${action.name} on ${elementKey}`
  }
}

export * from './config'
export * from './generator/index'
export * from './types'
export * from './scorer'
