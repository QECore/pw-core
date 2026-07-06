export interface DOMContext {
  parentText?: string
  siblingText?: string
  nearbyHeading?: string
  accessibleName?: string
  parentAttributes?: Record<string, string>
  siblingAttributes?: Record<string, string>
}

export interface Candidate {
  selector: string
  source: 'target' | 'child' | 'sibling' | 'parent' | 'ancestor'
  strategy: string
  depth: number
  baseScore: number
  semanticScore: number
  proximityScore: number
  similarityScore: number
  uniquenessScore: number
  totalScore: number
  unique: boolean
  valueToScore?: string
}

export interface LocatorCandidate extends Candidate {
  locator: string
  contextScore: number
  nearbyText?: string
  parentText?: string
  accessibleName?: string
  generatedKey?: string
}

export interface LocatorStrategy {
  name: string
  matches(element: Element): boolean
  build(element: Element): LocatorCandidate | null
}
