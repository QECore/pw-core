import type { StrategyType } from '../types/strategies'

export type {
  DynamicRegistryEntry,
  RegistryLocatorDictionary,
  RegistryPageConfig,
  RegistryRoot
} from './registry-store'

export interface DOMContext {
  parentText?: string
  siblingText?: string
  nearbyHeading?: string
  accessibleName?: string
  parentAttributes?: Record<string, string>
  siblingAttributes?: Record<string, string>
}

export type SelectorStrategyType =
  | StrategyType
  | 'role'
  | 'ariaLabel'
  | 'selector'
  | 'id'
  | 'class'
  | 'css'
  | 'xpath'
  | 'dataAttribute'

export interface Candidate {
  selector: string
  source: 'target' | 'child' | 'sibling' | 'parent' | 'ancestor'
  strategy: SelectorStrategyType
  depth: number
  baseScore: number
  semanticScore: number
  proximityScore: number
  similarityScore: number
  uniquenessScore: number
  totalScore: number
  unique: boolean
  valueToScore?: string
  /** Attribute used to derive a data-attribute candidate. */
  attrName?: string
  /** ARIA role used to derive a role candidate. */
  roleVal?: string
  /** Additional score awarded for accessibility-oriented locators. */
  accessibilityBonus?: number
  /** Additional score awarded for stable locator values. */
  stabilityBonus?: number
  /** Penalties applied to unstable or non-semantic locator values. */
  penalties?: number
}

export interface LocatorCandidate extends Candidate {
  locator: string
  contextScore: number
  nearbyText?: string
  parentText?: string
  accessibleName?: string
  generatedKey?: string
  /** Stable target metadata consumed by registry matching. */
  targetTestId?: string
  targetId?: string
  targetParentId?: string
}

export interface LocatorStrategy {
  name: string
  matches(element: Element): boolean
  build(element: Element): LocatorCandidate | null
}
