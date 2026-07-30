import { getEnabledConstitutionRules } from '../../constitution/constitution'
import type { PlatformOutcome } from '../../adapters/adapter.types'
import type { SyntheticPersona, SyntheticScenario } from '../../personas/persona.types'
import type { QaViolation } from '../../reports/report.types'
import { buildExpectedOutcome } from './expected-outcome'
import type { LogicComparisonResult } from './logic.types'

export function compareExpectedToActual(input: {
  runId: string
  persona: SyntheticPersona
  scenario: SyntheticScenario
  actualOutcome: PlatformOutcome
}): LogicComparisonResult {
  const expectedOutcome = buildExpectedOutcome(input)
  const rulesById = new Map(getEnabledConstitutionRules().map((rule) => [rule.id, rule]))
  const violations: QaViolation[] = []

  expectedOutcome.ruleResults.forEach((ruleResult, index) => {
    if (ruleResult.result.passed) return

    const rule = rulesById.get(ruleResult.ruleId)

    violations.push({
      id: `${input.runId}-logic-${input.scenario.id}-${String(index + 1).padStart(3, '0')}`,
      runId: input.runId,
      agent: 'logic',
      ruleId: ruleResult.ruleId,
      severity: rule?.severity ?? 'medium',
      area: rule?.domain ?? 'logic',
      title: rule?.title ?? `Rule failed: ${ruleResult.ruleId}`,
      description: ruleResult.result.message,
      expected: ruleResult.result.expected,
      actual: ruleResult.result.actual,
      reproductionSteps: [
        `Generate persona ${input.persona.id}.`,
        `Run scenario ${input.scenario.id}.`,
        `Evaluate Constitution rule ${ruleResult.ruleId}.`,
      ],
      personaId: input.persona.id,
      scenarioId: input.scenario.id,
      timestamp: new Date().toISOString(),
    })
  })

  return {
    scenarioId: input.scenario.id,
    personaId: input.persona.id,
    passed: violations.length === 0,
    violations,
  }
}
