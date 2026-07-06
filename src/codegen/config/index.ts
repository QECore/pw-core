import { LOCATOR_WEIGHTS } from './weights'
import { CONTEXT_WEIGHTS } from './context-weights'
import { STRATEGY_ORDER } from './strategy-order'
import { IGNORED_VALUES } from './ignored-values'
import { IGNORED_ATTRIBUTES } from './ignored-attributes'
import { IGNORED_CLASS_PATTERNS } from './ignored-classes'

export const codegenConfig = {
  weights: LOCATOR_WEIGHTS,
  contextWeights: CONTEXT_WEIGHTS,
  ignoredValues: IGNORED_VALUES,
  ignoredAttributes: IGNORED_ATTRIBUTES,
  ignoredClasses: IGNORED_CLASS_PATTERNS,
  strategyOrder: STRATEGY_ORDER
}
