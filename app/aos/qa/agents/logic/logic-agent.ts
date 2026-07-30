import type { PlatformAdapter } from '../../adapters/adapter.types'
import type { PersonaScenario } from '../../personas/persona.types'
import type { QaRunError } from '../../reports/report.types'
import { compareExpectedToActual } from './comparison-engine'
import type { LogicAgentResult } from './logic.types'

export async function runLogicAgent(input: {
  runId: string
  adapter: PlatformAdapter
  personaScenarios: PersonaScenario[]
}): Promise<LogicAgentResult & { errors: QaRunError[] }> {
  const scenarioResults: LogicAgentResult['scenarioResults'] = []
  const errors: QaRunError[] = []

  for (const item of input.personaScenarios) {
    try {
      const actualOutcome = await input.adapter.getScenarioOutcome(item.scenario, item.persona)
      scenarioResults.push(
        compareExpectedToActual({
          runId: input.runId,
          persona: item.persona,
          scenario: item.scenario,
          actualOutcome,
        }),
      )
    } catch (error) {
      errors.push({
        scenarioId: item.scenario.id,
        personaId: item.persona.id,
        agent: 'logic',
        message: error instanceof Error ? error.message : 'Unknown logic agent error.',
        timestamp: new Date().toISOString(),
      })
    }
  }

  return {
    runId: input.runId,
    scenarioResults,
    violations: scenarioResults.flatMap((result) => result.violations),
    errors,
  }
}
