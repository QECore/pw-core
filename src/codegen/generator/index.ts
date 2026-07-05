import { codegenConfig } from '../config'
import { LocatorCandidate, DOMContext } from '../types'
import { checkUniqueness } from '../uniqueness'
import { getBaseScore, getSemanticScore, getContextScore, getPriorityScore, GOOD_WORDS } from '../scorer'
import { isRestrictedClass, exactUtilities, tailwindPrefixes, stateClasses, stylePatterns, decorativeList, PATTERNS } from './locator.restricted'

export function generateKeyFromText(text: string, role?: string): string {
  if (!text) return ''
  let clean = text.replace(/[^a-zA-Z0-9\s-_]/g, '').trim()
  if (!clean) return 'element'

  // Preserve original casing and replace spaces with hyphens
  let keyStr = clean.replace(/\s+/g, '-')

  if (role === 'button' && !keyStr.toLowerCase().endsWith('btn') && !keyStr.toLowerCase().endsWith('button')) {
    keyStr += 'Btn'
  }

  // Hard cap at 40 characters
  if (keyStr.length > 40) keyStr = keyStr.slice(0, 40)
  return keyStr
}

/**
 * Derive a camelCase key from a candidate's attribute/selector value.
 * E.g. data-parent-id="why-pw-core" → whyPwCore
 */
export function generateKeyFromCandidate(
  candidate: { strategy: string; selector: string; valueToScore?: string },
  role?: string
): string {
  const val = candidate.valueToScore || ''
  if (!val) return ''

  // For data-attribute, id, testId strategies — use the attribute value directly
  if (['dataAttribute', 'id', 'idAttribute', 'testId'].includes(candidate.strategy)) {
    return generateKeyFromText(val, role)
  }

  // For role/label/text — use the text value
  if (['role', 'label', 'text'].includes(candidate.strategy)) {
    return generateKeyFromText(val, role)
  }

  return ''
}

export async function generateSmartLocator(page: any, selector: string): Promise<LocatorCandidate | null> {
  if (!selector) return null

  const locator = page.locator(selector)
  const count = await locator.count().catch(() => 0)
  if (count === 0) return null

  // Evaluate candidate collection and DOM context extraction inside the browser page
  const result = await locator
    .first()
    .evaluate((element: any, data: any) => {
      const collected: any[] = []
      const seen = new Set<Element>()

      const getElementAttributes = (el: Element): Record<string, string> => {
        const attrs: Record<string, string> = {}
        const names = el.getAttributeNames()
        for (const name of names) {
          attrs[name] = el.getAttribute(name) || ''
        }
        return attrs
      }

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
        const textContent = (el.textContent || '').trim().replace(/\s+/g, ' ')
        return (ariaLabel || alt || title || textContent || '').trim()
      }

      // Target information for context mapping
      const targetTagName = element.tagName.toLowerCase()
      const targetRole = getRoleAttr(element)
      const targetAccessibleName = getAccessibleName(element)
      const targetText = (element.textContent || '').trim().replace(/\s+/g, ' ')
      const targetType = element.getAttribute('type') || ''
      const targetName = element.getAttribute('name') || ''

      const targetTestId = element.getAttribute('data-testid') || element.getAttribute('data-test-id') || element.getAttribute('testid') || ''
      const targetId = element.id || ''
      const targetParentId = element.getAttribute('data-parent-id') || ''

      // Candidate Collection for all elements in scope
      for (const item of scopeElements) {
        const el = item.el
        const source = item.source
        const depth = item.depth
        const tagName = el.tagName.toLowerCase()

        // Phase 1 Action Validation: Reject if multi-action container
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
        const alt = el.getAttribute('alt')
        const title = el.getAttribute('title')
        const ariaLabelledBy = el.getAttribute('aria-labelledby')
        let labelText: string | null = ariaLabel || alt || title || ariaLabelledBy
        let labelAttr = 'aria-label'
        if (ariaLabelledBy) labelAttr = 'aria-labelledby'
        else if (title) labelAttr = 'title'
        else if (alt) labelAttr = 'alt'

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

        // 6. text candidate
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

        // 7. class candidates
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
            // Exclude translate-x*, translate-y*, general styling classes, and capitalized class names (which are usually component names or typos)
            if (
              cls.startsWith('translate-x') ||
              cls.startsWith('translate-y') ||
              isStyleClass(cls) ||
              /^[A-Z]/.test(cls)
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

        // 8. tag / css candidate
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

        // 9. xpath candidate
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
    }, { exactUtilities, tailwindPrefixes, stateClasses, stylePatterns }, { timeout: 1000 })
    .catch(() => null)

  if (!result || !result.candidates || result.candidates.length === 0) return null



  const normalize = (value: string): string => {
    return value
      .toLowerCase()
      .replace(/[-_\s]/g, '')
      .replace(/[^\w]/g, '')
  }

  const targetNormalized = normalize(result.targetText || result.targetAccessibleName || '')

  // Filter and Score Candidates on Node.js side
  const candidates: LocatorCandidate[] = []

  for (const c of result.candidates) {
    const val = c.valueToScore || ''
    const valLower = val.toLowerCase()

    // Reject unstable text
    if (c.strategy === 'text') {
      if (
        Object.values(PATTERNS.restrictedTexts).some((keyword) => valLower.includes(keyword)) ||
        val.length > 40
      ) {
        continue
      }
    }

    // Calculate priority (Phase 2)
    const priorityScore = getPriorityScore(c)

    // Calculate Proximity Bonus (Phase 3)
    let proximityScore = 0
    if (c.source === 'target') proximityScore = 300
    else if (c.source === 'child') proximityScore = 250
    else if (c.source === 'sibling') proximityScore = 250
    else if (c.source === 'parent') proximityScore = 200
    else if (c.source === 'ancestor') {
      if (c.depth === 1)
        proximityScore = 150 // Grandparent
      else proximityScore = 100 // Ancestor depth 3
    }

    // Calculate Similarity Bonus (Phase 4)
    const candidateNormalized = normalize(val)
    const similarityScore = targetNormalized && targetNormalized === candidateNormalized ? 200 : 0

    // Calculate Semantic Bonus (Phase 5)
    let semanticScore = 0
    if (/[a-zA-Z]/.test(valLower)) {
      const hasHyphen = valLower.includes('-')
      const hasUnderscore = valLower.includes('_')
      const hasCamelCase = /[a-z][A-Z]/.test(val)
      const wordsCount = valLower.split(/[-_\s]+/).filter(Boolean).length
      const hasGoodWord = GOOD_WORDS.some((word) => valLower.includes(word))
      if (hasHyphen || hasUnderscore || hasCamelCase || wordsCount > 1 || hasGoodWord) {
        semanticScore = 100
      }
    }

    // Calculate Accessibility Bonus (Phase 6)
    const accessibilityBonus = c.strategy === 'label' || c.strategy === 'ariaLabel' ? 150 : 0

    // Calculate Stability Bonus (Phase 7)
    const isStable =
      c.strategy === 'testId' ||
      c.strategy === 'id' ||
      (c.strategy === 'dataAttribute' &&
        (c.attrName === 'data-page' ||
          c.attrName === 'data-section' ||
          c.attrName === 'data-parent-id' ||
          c.attrName === 'data-test-id' ||
          c.attrName === 'data-testid' ||
          c.attrName === 'datatestid'))
    const stabilityBonus = isStable ? 100 : 0

    // Calculate Penalties
    let penalties = 0
    if (c.strategy === 'class') {
      if (isRestrictedClass(val)) penalties += 1000
      if (stateClasses.includes(valLower)) penalties += 1000
      if (/^[A-Z]/.test(val)) penalties += 1000
    }
    const hasDecorative = decorativeList.some(
      (item) => valLower.includes(item) || c.selector.toLowerCase().includes(item)
    )
    if (hasDecorative) {
      penalties += 500
    }
    if (['true', 'false', '0', '1'].includes(valLower)) {
      penalties += 500
    }
    const isUuid =
      new RegExp(PATTERNS.unstableIdentifiers.uuidPattern, 'i').test(valLower) ||
      new RegExp(PATTERNS.unstableIdentifiers.numericPattern).test(valLower) ||
      new RegExp(PATTERNS.unstableIdentifiers.hexHashPattern, 'i').test(valLower) ||
      new RegExp(PATTERNS.unstableIdentifiers.longAlphaNumPattern, 'i').test(valLower)
    if (isUuid) {
      penalties += 500
    }

    candidates.push({
      selector: c.selector,
      locator: c.locator,
      source: c.source,
      strategy: c.strategy,
      depth: c.depth,
      baseScore: priorityScore, // mapping baseScore to priorityScore
      semanticScore: semanticScore,
      proximityScore: proximityScore,
      similarityScore: similarityScore,
      uniquenessScore: 0,
      contextScore: proximityScore,
      totalScore: 0,
      unique: false,
      valueToScore: c.valueToScore,
      attrName: (c as any).attrName,
      // Extra fields for bonuses/penalties bookkeeping
      accessibilityBonus,
      stabilityBonus,
      penalties
    } as any)
  }

  // Verify uniqueness and assign final score
  for (const c of candidates) {
    try {
      const count = await page.locator(c.selector).count()
      c.unique = count === 1
    } catch (e) {
      c.unique = false
    }
    c.uniquenessScore = c.unique ? 0 : -500

    // final score calculation
    const extra = c as any
    c.totalScore =
      c.baseScore +
      c.proximityScore +
      c.semanticScore +
      c.similarityScore +
      (extra.accessibilityBonus || 0) +
      (extra.stabilityBonus || 0) +
      c.uniquenessScore -
      (extra.penalties || 0)

    // Generate key for registry
    let generatedKey = ''
    const isInputEl = ['input', 'textarea', 'select'].includes(result.targetTagName)
    if (isInputEl) {
      // Find the testId candidate for this element
      const testIdCand = candidates.find(cand => cand.strategy === 'testId') as any
      if (testIdCand && testIdCand.valueToScore) {
        generatedKey = generateKeyFromText(testIdCand.valueToScore, result.targetRole)
      } else if (result.targetName) {
        generatedKey = generateKeyFromText(result.targetName, result.targetRole)
      } else if (result.targetType) {
        generatedKey = generateKeyFromText(result.targetType + 'Input', result.targetRole)
      } else {
        generatedKey = result.targetTagName + 'Input'
      }
    } else {
      const visibleText = result.targetAccessibleName || result.targetText || ''
      if (visibleText && visibleText.trim().length > 0 && visibleText.length <= 50) {
        generatedKey = generateKeyFromText(visibleText.trim(), result.targetRole)
      } else {
        generatedKey = generateKeyFromCandidate(c, result.targetRole)
      }
    }
    c.generatedKey = generatedKey
    c.nearbyText = result.targetText
    c.accessibleName = result.targetAccessibleName
  }

  // If a stable unique candidate exists, heavily penalize unstable candidates to prioritize the stable ones
  const hasStableUnique = candidates.some(
    (c) =>
      c.unique &&
      (c.strategy === 'testId' ||
        c.strategy === 'id' ||
        (c.strategy === 'dataAttribute' &&
          ((c as any).attrName === 'data-parent-id' ||
            (c as any).attrName === 'data-test-id' ||
            (c as any).attrName === 'data-testid' ||
            (c as any).attrName === 'datatestid')))
  )

  if (hasStableUnique) {
    for (const c of candidates) {
      const isCandidateStable =
        c.strategy === 'testId' ||
        c.strategy === 'id' ||
        (c.strategy === 'dataAttribute' &&
          ((c as any).attrName === 'data-parent-id' ||
            (c as any).attrName === 'data-test-id' ||
            (c as any).attrName === 'data-testid' ||
            (c as any).attrName === 'datatestid'))
      if (!isCandidateStable) {
        c.totalScore -= 600
      }
    }
  }

  const sorted = candidates.sort((a, b) => b.totalScore - a.totalScore)

  const assignExtraAttrs = (c: any) => {
    if (c) {
      c.targetTestId = result.targetTestId
      c.targetId = result.targetId
      c.targetParentId = result.targetParentId
    }
    return c
  }

  // Check if there is a unique locator in ranked order
  const uniqueCandidate = sorted.find((c) => c.unique)
  if (uniqueCandidate) {
    return assignExtraAttrs(uniqueCandidate)
  }

  // If every ranked locator has multiple items, choose the 1st ranked locator with indexing
  const best = sorted[0]
  if (best) {
    best.selector = `${best.selector} >> nth=0`
    best.locator = `${best.locator}.first()`
    return assignExtraAttrs(best)
  }

  return null as any
}
