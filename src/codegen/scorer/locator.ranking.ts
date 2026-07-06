export interface RankingRule {
  strategy: string
  source?: 'target' | 'child' | 'sibling' | 'parent' | 'ancestor'
  attrName?: string | RegExp
  roleVal?: string
  score: number
}

export const priorityRankingRules: RankingRule[] = [
  { strategy: 'testId', source: 'target', score: 1000 },
  { strategy: 'testId', source: 'sibling', score: 980 },
  { strategy: 'testId', source: 'parent', score: 970 },
  { strategy: 'testId', source: 'ancestor', score: 960 },

  { strategy: 'dataAttribute', attrName: /data-test-id|data-testid|datatestid/i, source: 'target', score: 980 },
  { strategy: 'dataAttribute', attrName: /data-test-id|data-testid|datatestid/i, source: 'sibling', score: 960 },
  { strategy: 'dataAttribute', attrName: /data-test-id|data-testid|datatestid/i, source: 'parent', score: 950 },
  { strategy: 'dataAttribute', attrName: /data-test-id|data-testid|datatestid/i, source: 'ancestor', score: 940 },

  { strategy: 'id', source: 'target', score: 960 },
  { strategy: 'id', source: 'sibling', score: 940 },
  { strategy: 'id', source: 'parent', score: 930 },
  { strategy: 'id', source: 'ancestor', score: 920 },

  { strategy: 'dataAttribute', attrName: 'data-parent-id', source: 'target', score: 940 },
  { strategy: 'dataAttribute', attrName: 'data-parent-id', source: 'sibling', score: 925 },
  { strategy: 'dataAttribute', attrName: 'data-parent-id', source: 'parent', score: 915 },
  { strategy: 'dataAttribute', attrName: 'data-parent-id', source: 'ancestor', score: 905 },

  { strategy: 'dataAttribute', attrName: /data-.*id$/i, source: 'target', score: 920 },
  { strategy: 'dataAttribute', attrName: /data-.*id$/i, source: 'sibling', score: 875 },
  { strategy: 'dataAttribute', attrName: /data-.*id$/i, source: 'parent', score: 825 },
  { strategy: 'dataAttribute', attrName: /data-.*id$/i, source: 'ancestor', score: 775 },

  { strategy: 'dataAttribute', attrName: /id/i, source: 'target', score: 900 },
  { strategy: 'dataAttribute', attrName: /id/i, source: 'sibling', score: 860 },
  { strategy: 'dataAttribute', attrName: /id/i, source: 'parent', score: 810 },
  { strategy: 'dataAttribute', attrName: /id/i, source: 'ancestor', score: 760 },

  { strategy: 'role', roleVal: 'link', source: 'target', score: 880 },
  { strategy: 'role', roleVal: 'link', source: 'sibling', score: 840 },
  { strategy: 'role', roleVal: 'link', source: 'parent', score: 790 },
  { strategy: 'role', roleVal: 'link', source: 'ancestor', score: 740 },

  { strategy: 'role', roleVal: 'button', source: 'target', score: 870 },
  { strategy: 'role', roleVal: 'button', source: 'sibling', score: 830 },
  { strategy: 'role', roleVal: 'button', source: 'parent', score: 780 },
  { strategy: 'role', roleVal: 'button', source: 'ancestor', score: 730 },

  { strategy: 'text', source: 'target', score: 550 },
  { strategy: 'text', source: 'sibling', score: 500 },
  { strategy: 'text', source: 'parent', score: 450 },
  { strategy: 'text', source: 'ancestor', score: 400 },

  { strategy: 'role', source: 'target', score: 750 },
  { strategy: 'role', source: 'sibling', score: 710 },
  { strategy: 'role', source: 'parent', score: 660 },
  { strategy: 'role', source: 'ancestor', score: 610 },

  { strategy: 'dataAttribute', attrName: 'data-section', score: 625 },
  { strategy: 'dataAttribute', attrName: 'data-page', score: 620 },
  { strategy: 'dataAttribute', attrName: 'data-component', score: 615 },
  { strategy: 'dataAttribute', score: 600 },

  { strategy: 'label', attrName: 'aria-labelledby', score: 575 },
  { strategy: 'label', attrName: 'title', score: 550 },
  { strategy: 'label', score: 570 },
  { strategy: 'placeholder', score: 565 },
  { strategy: 'altText', score: 563 },
  { strategy: 'title', score: 562 },

  { strategy: 'class', score: 500 },
  { strategy: 'css', score: 400 },
  { strategy: 'xpath', score: 300 }
]

export function getPriorityScore(c: { strategy: string; source: string; depth: number; attrName?: string; roleVal?: string }): number {
  const isIdAttr = c.attrName && /id/i.test(c.attrName)

  for (const rule of priorityRankingRules) {
    if (rule.strategy !== c.strategy) continue
    if (rule.source && rule.source !== c.source) continue
    if (rule.roleVal && rule.roleVal !== c.roleVal) continue
    if (rule.attrName) {
      if (typeof rule.attrName === 'string') {
        if (rule.attrName !== c.attrName) continue
      } else {
        const nameToTest = isIdAttr ? 'id' : (c.attrName || '')
        if (!rule.attrName.test(nameToTest)) continue
      }
    }
    return rule.score
  }
  return 100 // default CSS
}
