import { codegenConfig } from '../config'
import { DOMContext } from '../types'

export function getContextScore(context: DOMContext): number {
  let score = 0
  const cw = codegenConfig.contextWeights as Record<string, number>

  if (context.accessibleName) {
    score += cw.accessibleName || 0
  }
  if (context.siblingText) {
    score += cw.siblingText || 0
  }
  if (context.parentText) {
    score += cw.parentText || 0
  }
  if (context.nearbyHeading) {
    score += cw.heading || 0
  }

  if (context.parentAttributes) {
    const hasSemanticParent = Object.keys(context.parentAttributes).some(
      (attr) => attr.startsWith('data-') || attr === 'id' || attr === 'role'
    )
    if (hasSemanticParent) {
      score += cw.semanticParent || 0
    }
  }

  return score
}
