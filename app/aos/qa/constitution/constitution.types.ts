import type { SyntheticPersona, SyntheticScenario } from '../personas/persona.types'
import type { PlatformOutcome } from '../adapters/adapter.types'
import type { QaSeverity } from '../reports/severity'

export type ConstitutionDomain = 'workout' | 'recovery' | 'nutrition' | 'behavior' | 'experience'

export type RuleEvaluationContext = {
  persona: SyntheticPersona
  scenario: SyntheticScenario
  actualOutcome?: PlatformOutcome
}

export type RuleEvaluationPass = {
  passed: true
  expected: unknown
  actual: unknown
}

export type RuleEvaluationFailure = {
  passed: false
  expected: unknown
  actual: unknown
  message: string
}

export type RuleEvaluationResult = RuleEvaluationPass | RuleEvaluationFailure

export type ConstitutionRule = {
  id: string
  domain: ConstitutionDomain
  title: string
  description: string
  severity: QaSeverity
  enabled: boolean
  provisional: boolean
  inputs: string[]
  expectedBehavior: string
  rationale: string
  evaluate: (context: RuleEvaluationContext) => RuleEvaluationResult
}

export type Constitution = {
  version: string
  rules: ConstitutionRule[]
}
