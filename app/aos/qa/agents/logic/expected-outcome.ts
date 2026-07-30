import { getEnabledConstitutionRules } from '../../constitution/constitution'
import type { PlatformOutcome } from '../../adapters/adapter.types'
import type { SyntheticPersona, SyntheticScenario } from '../../personas/persona.types'
import type { ExpectedOutcome } from './logic.types'

export function buildExpectedOutcome(input: {
  persona: SyntheticPersona
  scenario: SyntheticScenario
  actualOutcome?: PlatformOutcome
}): ExpectedOutcome {
  return {
    scenarioId: input.scenario.id,
    personaId: input.persona.id,
    ruleResults: getEnabledConstitutionRules().map((rule) => ({
      ruleId: rule.id,
      domain: rule.domain,
      severity: rule.severity,
      result: rule.evaluate({
        persona: input.persona,
        scenario: input.scenario,
        actualOutcome: input.actualOutcome,
      }),
    })),
  }
}
