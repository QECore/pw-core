import type { SelectorStrategyType } from '../types'
import {
  exactUtilities,
  tailwindPrefixes,
  stateClasses,
  stylePatterns
} from './locator.restricted'

export interface RawCandidate {
  selector: string
  locator: string
  source: 'target' | 'child' | 'sibling' | 'parent' | 'ancestor'
  strategy: SelectorStrategyType
  depth: number
  valueToScore?: string
  attrName?: string
  roleVal?: string
}

export interface DomScanResult {
  candidates: RawCandidate[]
  targetText: string
  targetAccessibleName: string
  targetRole: string
  targetType: string
  targetName: string
  targetTagName: string
  targetTestId: string
  targetId: string
  targetParentId: string
}

export interface DomScannerPayload {
  exactUtilities: readonly string[]
  tailwindPrefixes: readonly string[]
  stateClasses: readonly string[]
  stylePatterns: readonly string[]
}

/**
 * In-browser evaluation function to scan the DOM search scope of a target element and collect raw locator candidates.
 */
export function scanElementInBrowser(element: Element, data: DomScannerPayload): DomScanResult {
  const collected: RawCandidate[] = []
  const seen = new Set<Element>()

  // Helper to check if a container contains multiple actions
  const isMultiActionContainer = (container: Element, target: Element): boolean => {
    if (container === target) return false

    const tag = container.tagName.toLowerCase()
    if (['button', 'a', 'input', 'select', 'option'].includes(tag)) return false

    const actions = container.querySelectorAll('button, a, input, select, [role="button"], [role="link"]')
    if (actions.length > 1) {
      return true
    }

    const containerText = (container.textContent || '').trim().replace(/\s+/g, ' ')
    const targetText = (target.textContent || '').trim().replace(/\s+/g, ' ')

    if (containerText && targetText && containerText !== targetText) {
      let textChildrenCount = 0
      for (let i = 0; i < container.children.length; i++) {
        const childText = (container.children[i].textContent || '').trim()
        if (childText.length > 0) {
          textChildrenCount++
        }
      }
      if (textChildrenCount > 1) {
        return true
      }
    }

    return false
  }

  // Collect elements in DOM Search Scope
  const scopeElements: {
    el: Element
    source: 'target' | 'child' | 'sibling' | 'parent' | 'ancestor'
    depth: number
  }[] = []

  const addElement = (
    el: Element | null,
    source: 'target' | 'child' | 'sibling' | 'parent' | 'ancestor',
    depth: number
  ) => {
    if (!el || seen.has(el)) return
    seen.add(el)
    scopeElements.push({ el, source, depth })
  }

  // 1. Target Element
  addElement(element, 'target', 0)

  // 2. Children (depth 1)
  for (let i = 0; i < element.children.length; i++) {
    addElement(element.children[i], 'child', 1)
  }

  // 3. Parent
  const parentEl = element.parentElement
  addElement(parentEl, 'parent', 1)

  // 4. Grandparent
  const grandparentEl = parentEl ? parentEl.parentElement : null
  addElement(grandparentEl, 'ancestor', 1) // Grandparent is ancestor at depth 1

  // 5. Ancestors (max depth 3)
  let currAncestor = grandparentEl ? grandparentEl.parentElement : null
  let ancDepth = 2
  while (currAncestor && ancDepth <= 3) {
    addElement(currAncestor, 'ancestor', ancDepth)
    currAncestor = currAncestor.parentElement
    ancDepth++
  }

  // 6. Previous siblings (3)
  let prev = element.previousElementSibling
  let sCount = 0
  while (prev && sCount < 3) {
    addElement(prev, 'sibling', 1)
    prev = prev.previousElementSibling
    sCount++
  }

  // 7. Next siblings (3)
  let next = element.nextElementSibling
  sCount = 0
  while (next && sCount < 3) {
    addElement(next, 'sibling', 1)
    next = next.nextElementSibling
    sCount++
  }

  // 8. Parent children
  if (parentEl) {
    for (let i = 0; i < parentEl.children.length; i++) {
      addElement(parentEl.children[i], 'sibling', 1)
    }
  }

  // 9. Closest heading
  const headings = Array.from(element.ownerDocument.querySelectorAll('h1, h2, h3, h4, h5, h6')) as Element[]
  let closestHeading: Element | null = null
  let minHDist = Infinity
  for (const h of headings) {
    const pos = h.compareDocumentPosition(element)
    if (pos & Node.DOCUMENT_POSITION_FOLLOWING) {
      let dist = 0
      let curr: Element | null = h
      while (curr && curr !== element) {
        curr = (curr.nextElementSibling || curr.parentElement) as Element | null
        dist++
        if (dist > 50) break
      }
      if (dist < minHDist) {
        minHDist = dist
        closestHeading = h
      }
    }
  }
  if (closestHeading) {
    addElement(closestHeading, 'ancestor', 3)
  }

  // 10. Closest label
  let closestLabel: Element | null = null
  if (element.id) {
    closestLabel = element.ownerDocument.querySelector(`label[for="${element.id}"]`)
  }
  if (!closestLabel) {
    let curr = element.parentElement
    while (curr) {
      if (curr.tagName.toLowerCase() === 'label') {
        closestLabel = curr
        break
      }
      curr = curr.parentElement
    }
  }
  if (closestLabel) {
    addElement(closestLabel, 'parent', 1)
  }

  // 11. Closest accessible element
  let currAcc = element.parentElement
  while (currAcc) {
    const hasRole =
      currAcc.getAttribute('role') ||
      ['button', 'a', 'input', 'select', 'textarea'].includes(currAcc.tagName.toLowerCase())
    const hasAccName = currAcc.getAttribute('aria-label') || currAcc.getAttribute('title')
    if (hasRole || hasAccName) {
      addElement(currAcc, 'ancestor', 2)
      break
    }
    currAcc = currAcc.parentElement
  }

  // Helper: getRole
  const getRoleAttr = (el: Element): string => {
    let roleAttr = el.getAttribute('role')?.trim() || null
    const tagName = el.tagName.toLowerCase()
    if (!roleAttr) {
      if (tagName === 'button') roleAttr = 'button'
      else if (tagName === 'a') roleAttr = 'link'
      else if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) roleAttr = 'heading'
      else if (tagName === 'input') {
        const type = el.getAttribute('type') || 'text'
        if (type === 'checkbox') roleAttr = 'checkbox'
        else if (type === 'radio') roleAttr = 'radio'
        else if (['text', 'email', 'url', 'search', 'tel', 'password'].includes(type)) roleAttr = 'textbox'
        else if (['button', 'submit', 'reset'].includes(type)) roleAttr = 'button'
      } else if (tagName === 'textarea') roleAttr = 'textbox'
      else if (tagName === 'select') roleAttr = 'combobox'
      else if (tagName === 'img') roleAttr = 'img'
    }
    return roleAttr || ''
  }

  // Helper: getAccessibleName
  const getAccessibleName = (el: Element): string => {
    const ariaLabel = el.getAttribute('aria-label')
    const alt = el.getAttribute('alt')
    const title = el.getAttribute('title')
    let textContent = ''
    if (el.tagName.toLowerCase() === 'select') {
      const firstOpt = el.querySelector('option')
      textContent = firstOpt ? firstOpt.textContent || '' : ''
    } else {
      textContent = el.textContent || ''
    }
    textContent = textContent.trim().replace(/\s+/g, ' ')
    return (ariaLabel || alt || title || textContent || '').trim()
  }

  // Target information for context mapping
  const targetTagName = element.tagName.toLowerCase()
  const targetRole = getRoleAttr(element)
  const targetAccessibleName = getAccessibleName(element)
  const targetText =
    targetTagName === 'select'
      ? (element.querySelector('option')?.textContent || '').trim().replace(/\s+/g, ' ')
      : (element.textContent || '').trim().replace(/\s+/g, ' ')
  const targetType = element.getAttribute('type') || ''
  const targetName = element.getAttribute('name') || ''

  const targetTestId =
    element.getAttribute('data-testid') ||
    element.getAttribute('data-test-id') ||
    element.getAttribute('testid') ||
    ''
  const targetId = element.id || ''
  const targetParentId = element.getAttribute('data-parent-id') || ''

  // Candidate Collection for all elements in scope
  for (const item of scopeElements) {
    const el = item.el
    const source = item.source
    const depth = item.depth
    const tagName = el.tagName.toLowerCase()

    // Action Validation: Reject if multi-action container
    if (isMultiActionContainer(el, element)) {
      continue
    }

    // 1. testId candidate
    const testIdVal =
      el.getAttribute('data-testid') ?? el.getAttribute('data-test-id') ?? el.getAttribute('data-testId')
    if (testIdVal) {
      collected.push({
        selector: `[data-testid="${testIdVal}"]`,
        locator: `codegenPage.getByTestId('${testIdVal}')`,
        source,
        strategy: 'testId',
        depth,
        valueToScore: testIdVal
      })
    }

    // 2. id candidate
    const idVal = el.getAttribute('id')
    if (idVal) {
      collected.push({
        selector: `#${idVal}`,
        locator: `codegenPage.locator('#${idVal}')`,
        source,
        strategy: 'id',
        depth,
        valueToScore: idVal
      })
    }

    // 3. dataAttribute candidates
    const allAttrs = el.getAttributeNames()
    const validDataAttrs = allAttrs.filter(
      (attr: string) =>
        attr.startsWith('data-') && !['data-testid', 'data-test-id', 'data-testid'].includes(attr.toLowerCase())
    )
    for (const dataAttr of validDataAttrs) {
      const val = el.getAttribute(dataAttr)
      if (val) {
        collected.push({
          selector: `[${dataAttr}="${val}"]`,
          locator: `codegenPage.locator('[${dataAttr}="${val}"]')`,
          source,
          strategy: 'dataAttribute',
          depth,
          valueToScore: val,
          attrName: dataAttr
        })
      }
    }

    // 4. role candidate
    const roleVal = getRoleAttr(el)
    if (roleVal) {
      const accName = getAccessibleName(el)
      const escapedName = accName.replace(/'/g, "\\'")
      collected.push({
        selector: accName ? `internal:role=${roleVal}[name="${accName.replace(/"/g, '\\"')}"i]` : `role=${roleVal}`,
        locator: accName
          ? `codegenPage.getByRole('${roleVal}', { name: '${escapedName}' })`
          : `codegenPage.getByRole('${roleVal}')`,
        source,
        strategy: 'role',
        depth,
        valueToScore: accName || roleVal,
        roleVal
      })
    }

    // 5. label candidate
    const ariaLabel = el.getAttribute('aria-label')
    const ariaLabelledBy = el.getAttribute('aria-labelledby')
    let labelText: string | null = ariaLabel || ariaLabelledBy
    let labelAttr = 'aria-label'
    if (ariaLabelledBy) labelAttr = 'aria-labelledby'

    if (!labelText && el.getAttribute('id')) {
      const labelEl = el.ownerDocument.querySelector(`label[for="${el.getAttribute('id')}"]`)
      if (labelEl && labelEl.textContent) {
        labelText = labelEl.textContent.trim()
        labelAttr = 'label'
      }
    }
    if (labelText) {
      collected.push({
        selector: `internal:label="${labelText.replace(/"/g, '\\"')}"i`,
        locator: `codegenPage.getByLabel('${labelText.replace(/'/g, "\\'")}')`,
        source,
        strategy: 'label',
        depth,
        valueToScore: labelText,
        attrName: labelAttr
      })
    }

    // 6. placeholder candidate
    const placeholderVal = el.getAttribute('placeholder')
    if (placeholderVal) {
      collected.push({
        selector: `internal:attr=[placeholder="${placeholderVal.replace(/"/g, '\\"')}"i]`,
        locator: `codegenPage.getByPlaceholder('${placeholderVal.replace(/'/g, "\\'")}')`,
        source,
        strategy: 'placeholder',
        depth,
        valueToScore: placeholderVal
      })
    }

    // 7. altText candidate
    const altVal = el.getAttribute('alt')
    if (altVal) {
      collected.push({
        selector: `internal:attr=[alt="${altVal.replace(/"/g, '\\"')}"i]`,
        locator: `codegenPage.getByAltText('${altVal.replace(/'/g, "\\'")}')`,
        source,
        strategy: 'altText',
        depth,
        valueToScore: altVal
      })
    }

    // 8. title candidate
    const titleVal = el.getAttribute('title')
    if (titleVal) {
      collected.push({
        selector: `internal:attr=[title="${titleVal.replace(/"/g, '\\"')}"i]`,
        locator: `codegenPage.getByTitle('${titleVal.replace(/'/g, "\\'")}')`,
        source,
        strategy: 'title',
        depth,
        valueToScore: titleVal
      })
    }

    // 9. text candidate
    const textVal = (el.textContent || '').trim().replace(/\s+/g, ' ')
    if (textVal) {
      const cleanedText = textVal.replace(/^\d+[\s\.\-_]*/, '').trim()
      if (cleanedText && !/\d/.test(cleanedText)) {
        const escapedText = cleanedText.replace(/"/g, '\\"')
        const textSelector = cleanedText.includes(' ') ? `text="${escapedText}"` : `text=${escapedText}`
        collected.push({
          selector: textSelector,
          locator: `codegenPage.getByText('${cleanedText.replace(/'/g, "\\'")}')`,
          source,
          strategy: 'text',
          depth,
          valueToScore: cleanedText
        })
      }
    }

    // 10. class candidates
    const className = el.getAttribute('class')
    if (className) {
      const classes = className.split(/\s+/).filter(Boolean)

      const isStyleClass = (cName: string): boolean => {
        if (cName.includes('[') && cName.includes(']')) return true
        if (cName.includes(':')) return true

        if (data.exactUtilities.includes(cName)) return true
        if (data.stateClasses.includes(cName.toLowerCase())) return true
        if (data.tailwindPrefixes.some((prefix: string) => cName.startsWith(prefix))) return true

        return data.stylePatterns.some((pat: string) => new RegExp(pat).test(cName))
      }

      for (const cls of classes) {
        if (
          cls.startsWith('translate-x') ||
          cls.startsWith('translate-y') ||
          isStyleClass(cls) ||
          /^[A-Z]/.test(cls) ||
          cls.toLowerCase().includes('border') ||
          cls.length > 50
        ) {
          continue
        }
        collected.push({
          selector: `.${cls}`,
          locator: `codegenPage.locator('.${cls}')`,
          source,
          strategy: 'class',
          depth,
          valueToScore: cls
        })
      }
    }

    // 11. tag / css candidate
    const semanticTags = ['button', 'a', 'input', 'select', 'textarea', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'form']
    if (semanticTags.includes(tagName)) {
      collected.push({
        selector: `${tagName}`,
        locator: `codegenPage.locator('${tagName}')`,
        source,
        strategy: 'css',
        depth,
        valueToScore: tagName
      })
    }

    // 12. xpath candidate
    if (semanticTags.includes(tagName)) {
      collected.push({
        selector: `xpath=//${tagName}`,
        locator: `codegenPage.locator('//${tagName}')`,
        source,
        strategy: 'xpath',
        depth,
        valueToScore: tagName
      })
    }
  }

  return {
    candidates: collected,
    targetText,
    targetAccessibleName,
    targetRole,
    targetType,
    targetName,
    targetTagName,
    targetTestId,
    targetId,
    targetParentId
  }
}

export const domScannerPayload = {
  exactUtilities,
  tailwindPrefixes,
  stateClasses,
  stylePatterns
}
