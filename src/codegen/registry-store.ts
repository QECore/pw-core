import * as fs from 'fs'
import * as path from 'path'
import { toRegistryKey } from './key-utils'

export type DynamicRegistryEntry = {
  testId?: string
  selector?: string
  [key: string]: string | string[] | undefined
}

export type RegistryLocatorDictionary = Record<string, string | DynamicRegistryEntry>

export interface RegistryPageConfig {
  url?: string
  testId?: RegistryLocatorDictionary
  testIds?: RegistryLocatorDictionary
  selector?: RegistryLocatorDictionary
  selectors?: RegistryLocatorDictionary
  [key: string]: unknown
}

export type RegistryRoot = Record<string, RegistryPageConfig>

/**
 * Finds the character bounds `(startIdx, endIdx)` of the argument inside `createPageRegistry(...)`.
 * Robustly ignores parentheses inside strings, template literals, and comments.
 */
export function findRegistryCallBounds(content: string): { startIdx: number; endIdx: number } | null {
  const matchIndex = content.indexOf('createPageRegistry(')
  if (matchIndex === -1) return null
  const startIdx = matchIndex + 'createPageRegistry('.length
  let parenDepth = 0
  let inSingleQuote = false
  let inDoubleQuote = false
  let inTemplateLiteral = false
  let inLineComment = false
  let inBlockComment = false
  let isEscaped = false

  for (let i = startIdx; i < content.length; i++) {
    const char = content[i]
    const prevChar = i > 0 ? content[i - 1] : ''

    if (inLineComment) {
      if (char === '\n') inLineComment = false
      continue
    }

    if (inBlockComment) {
      if (prevChar === '*' && char === '/') inBlockComment = false
      continue
    }

    if (inSingleQuote) {
      if (char === "'" && !isEscaped) inSingleQuote = false
      isEscaped = char === '\\' && !isEscaped
      continue
    }

    if (inDoubleQuote) {
      if (char === '"' && !isEscaped) inDoubleQuote = false
      isEscaped = char === '\\' && !isEscaped
      continue
    }

    if (inTemplateLiteral) {
      if (char === '`' && !isEscaped) inTemplateLiteral = false
      isEscaped = char === '\\' && !isEscaped
      continue
    }

    isEscaped = false

    // Check for comment starts
    if (char === '/' && i + 1 < content.length) {
      const nextChar = content[i + 1]
      if (nextChar === '/') {
        inLineComment = true
        i++
        continue
      }
      if (nextChar === '*') {
        inBlockComment = true
        i++
        continue
      }
    }

    // Check for string starts
    if (char === "'") {
      inSingleQuote = true
      continue
    }
    if (char === '"') {
      inDoubleQuote = true
      continue
    }
    if (char === '`') {
      inTemplateLiteral = true
      continue
    }

    // Check parentheses
    if (char === '(') {
      parenDepth++
    } else if (char === ')') {
      if (parenDepth === 0) {
        return { startIdx, endIdx: i }
      }
      parenDepth--
    }
  }

  return null
}

/**
 * Parses a `registry.ts` file by evaluating the object literal passed to `createPageRegistry`.
 * Returns an empty object if the file does not exist yet.
 */
export function parseRegistry(filePath: string): RegistryRoot {
  if (!fs.existsSync(filePath)) {
    return {}
  }

  const content = fs.readFileSync(filePath, 'utf8')
  const bounds = findRegistryCallBounds(content)
  if (!bounds) {
    throw new Error(`[pw-core] Failed to parse registry in ${filePath}: "createPageRegistry" call not found.`)
  }
  const objectLiteralText = content.substring(bounds.startIdx, bounds.endIdx).trim()
  try {
    return new Function(`return (${objectLiteralText})`)() as RegistryRoot
  } catch (e) {
    throw new Error(`[pw-core] Error evaluating registry configuration in ${filePath}: ${(e as Error).message}`)
  }
}

/**
 * Checks if a string value matches a dynamic registry entry pattern.
 */
export function matchDynamicEntry(
  val: string,
  entry: DynamicRegistryEntry,
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
  } catch {
    // Ignore invalid dynamic regex pattern compilation
  }

  return { matches: false }
}

/**
 * Finds the common prefix between hyphen/underscore delimited string values.
 */
export function findCommonPrefix(values: string[]): string {
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

/**
 * Collapses similar static entries into dynamic parameterized entries in a locator dictionary.
 */
export function collapsePageDict(
  dict: RegistryLocatorDictionary,
  isTestId: boolean,
  keyReplacements: Record<string, string>
): RegistryLocatorDictionary {
  const result: RegistryLocatorDictionary = {}
  const dynamicEntries: Record<string, DynamicRegistryEntry> = {}
  const staticEntries: Record<string, string> = {}

  for (const k of Object.keys(dict)) {
    const item = dict[k]
    if (typeof item === 'object' && item !== null) {
      dynamicEntries[k] = item as DynamicRegistryEntry
    } else if (typeof item === 'string') {
      staticEntries[k] = item
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
        const placeholderValues = entry[placeholder] as string[]
        if (!placeholderValues.includes(matchRes.matchedValue)) {
          placeholderValues.push(matchRes.matchedValue)
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
      let entry: DynamicRegistryEntry = {}

      if (group.suffixPattern === 'testId') {
        dynamicKey = toRegistryKey(group.prefix) + `{${placeholder}}`
        entry = {
          [placeholder]: group.values,
          testId: group.prefix + '-' + placeholder
        }
      } else if (group.suffixPattern === 'idSelector') {
        dynamicKey = toRegistryKey(group.prefix) + `{${placeholder}}`
        entry = {
          [placeholder]: group.values,
          selector: `#${group.prefix}-{${placeholder}}`
        }
      } else if (group.suffixPattern === 'classSelector') {
        dynamicKey = toRegistryKey(group.prefix) + `{${placeholder}}`
        entry = {
          [placeholder]: group.values,
          selector: `.${group.prefix}-{${placeholder}}`
        }
      } else if (group.suffixPattern === 'attr') {
        const commonPrefix = findCommonPrefix(group.values)
        if (commonPrefix) {
          dynamicKey = toRegistryKey(commonPrefix) + `{${placeholder}}`
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
        const rolePlaceholder = group.prefix === 'button' ? 'btn' : 'item'
        dynamicKey = `{${rolePlaceholder}}`
        entry = {
          [rolePlaceholder]: group.values,
          selector: `internal:role=${group.prefix}[name="{${rolePlaceholder}}"i]`
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
          const generatedValues = entry[placeholder]
          const val = Array.isArray(generatedValues) ? generatedValues[idx] : group.values[idx]
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

/**
 * Serializes a JavaScript value into formatted TypeScript source text for registry files.
 */
export function serializeRegistryObject(obj: unknown, indent = 2, isTestIdsOrSelectors = false): string {
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
    return '[' + obj.map((x) => serializeRegistryObject(x, indent, false)).join(', ') + ']'
  }
  if (typeof obj === 'object') {
    const record = obj as Record<string, unknown>
    let keys = Object.keys(record)
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
      const nextIsTestIdsOrSelectors =
        isTestIdsOrSelectors || key === 'testId' || key === 'testIds' || key === 'selector' || key === 'selectors'
      res += `${spaces}  ${formattedKey}: ${serializeRegistryObject(record[key], indent + 2, nextIsTestIdsOrSelectors)}${index < keys.length - 1 ? ',\n' : '\n'}`
    })
    res += `${spaces}}`
    return res
  }
  return 'undefined'
}

/**
 * Updates or appends page object definitions inside a `registry.ts` file and updates any referencing test specs.
 */
export function writeRegistry(
  filePath: string,
  registryObj: RegistryRoot,
  overrideMode?: boolean,
  usedPageKeys?: Set<string> | string[]
): Record<string, string> {
  try {
    const keyReplacements: Record<string, string> = {}
    const usedSet = usedPageKeys instanceof Set ? usedPageKeys : new Set(usedPageKeys ?? [])

    const codegenKeys = Object.keys(registryObj).filter((k) => {
      const pageConfig = registryObj[k]
      const isUsed = usedSet.has(k)

      if (pageConfig && !isUsed) {
        let hasLocators = false
        for (const sk of Object.keys(pageConfig)) {
          const val = (pageConfig as Record<string, unknown>)[sk]
          if (sk !== 'url' && val && typeof val === 'object' && Object.keys(val).length > 0) {
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
          const updatedObjectText = serializeRegistryObject(registryObj[codegenKey], 2)
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
            const serializedPage = `  ${formattedKey}: ${serializeRegistryObject(registryObj[codegenKey], 2)}`

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
    console.error(`[pw-core] Error writing registry configuration to ${filePath}:`, e)
    throw e
  }
}
