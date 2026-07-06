import { codegenConfig } from '../config'

export function getBaseScore(strategyName: string): number {
  return (codegenConfig.weights as Record<string, number>)[strategyName] ?? 0
}
