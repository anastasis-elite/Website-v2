import type { RuleEvaluationResult } from '../../constitution/constitution.types'
import type { SyntheticPersona, SyntheticScenario } from '../../personas/persona.types'
import type { QaViolation } from '../../reports/report.types'

export type ExpectedOutcome = {
  scenarioId: string
  personaId: string
  ruleResults: Array<{
    ruleId: string
    domain: string
    severity: string
    result: RuleEvaluationResult
  }>
}

export type LogicComparisonResult = {
  scenarioId: string
  personaId: string
  passed: boolean
  violations: QaViolation[]
}

export type LogicAgentScenarioInput = {
  runId: string
  persona: SyntheticPersona
  scenario: SyntheticScenario
}

export type LogicAgentResult = {
  runId: string
  scenarioResults: LogicComparisonResult[]
  violations: QaViolation[]
}
