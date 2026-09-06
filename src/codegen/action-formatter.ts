/** Normalized subset of a Playwright recorder action used for spec generation. */
export interface RecordedAction {
  name: string
  nth?: number
  clickCount?: number
  modifiers?: string[]
  text?: string
  files?: unknown
  key?: string
  options?: unknown
  substring?: boolean
  checked?: boolean
  value?: string
  ariaSnapshot?: string
}

/**
 * Formats a recorded user action into executable Playwright test code using typed page methods.
 */
export function formatActionCall(
  pageKey: string,
  elementKey: string,
  action: RecordedAction,
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
      const opts: string[] = []
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
        return `  await ${locatorExpr}.fill('${(action.text as string).replace(/'/g, "\\'")}');`
      }
      const optsStr = action.nth !== undefined && action.nth !== 0 ? `, { nth: ${action.nth} }` : ''
      return `  await ${pageKey}.fill('${safeKey}', '${(action.text as string).replace(/'/g, "\\'")}'${optsStr});`
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
        return `  await expect(${locatorExpr}).${action.substring ? 'toContainText' : 'toHaveText'}('${(action.text as string).replace(/'/g, "\\'")}');`
      }
      const opts: string[] = []
      if (action.nth !== undefined && action.nth !== 0) opts.push(`nth: ${action.nth}`)
      const optsStr = opts.length ? `, { ${opts.join(', ')} }` : ''
      return `  await ${pageKey}.verify('${safeKey}'${optsStr}).${action.substring ? 'toContainText' : 'toHaveText'}('${(action.text as string).replace(/'/g, "\\'")}');`
    }
    case 'assertChecked': {
      const locatorExpr = getLocatorExpression()
      if (locatorExpr) {
        return `  await expect(${locatorExpr})${action.checked ? '' : '.not'}.toBeChecked();`
      }
      const opts: string[] = []
      if (action.nth !== undefined && action.nth !== 0) opts.push(`nth: ${action.nth}`)
      const optsStr = opts.length ? `, { ${opts.join(', ')} }` : ''
      return `  await ${pageKey}.verify('${safeKey}'${optsStr})${action.checked ? '' : '.not'}.toBeChecked();`
    }
    case 'assertVisible': {
      const locatorExpr = getLocatorExpression()
      if (locatorExpr) {
        return `  await expect(${locatorExpr}).toBeVisible();`
      }
      const opts: string[] = []
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
      const opts: string[] = []
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
      const opts: string[] = []
      if (action.nth !== undefined && action.nth !== 0) opts.push(`nth: ${action.nth}`)
      const optsStr = opts.length ? `, { ${opts.join(', ')} }` : ''
      return `  await ${pageKey}.verify('${safeKey}'${optsStr}).toMatchAriaSnapshot(\`\n${action.ariaSnapshot}\`);`
    }
    default:
      return `  // Unsupported action: ${action.name} on ${elementKey}`
  }
}
