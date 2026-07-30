import type { PlatformAdapter } from '../../adapters/adapter.types'
import type { PersonaScenario } from '../../personas/persona.types'
import type { QaRunError, QaViolation } from '../../reports/report.types'
import { scoreFriction } from './friction-scoring'
import type { ExperienceAgentResult } from './experience.types'

export async function runExperienceAgent(input: {
  runId: string
  adapter: PlatformAdapter
  personaScenarios: PersonaScenario[]
}): Promise<ExperienceAgentResult & { errors: QaRunError[] }> {
  const scores: ExperienceAgentResult['scores'] = []
  const violations: QaViolation[] = []
  const errors: QaRunError[] = []

  if (!input.adapter.capabilities.experienceEvidence) {
    violations.push({
      id: `${input.runId}-experience-adapter-unsupported`,
      runId: input.runId,
      agent: 'experience',
      severity: 'medium',
      area: input.adapter.name,
      title: 'Experience evidence unsupported by adapter',
      description: 'The active adapter does not expose finite experience evidence.',
      expected: 'Adapter supports experienceEvidence',
      actual: input.adapter.capabilities,
      timestamp: new Date().toISOString(),
    })

    return { runId: input.runId, scores, violations, errors }
  }

  for (const item of input.personaScenarios) {
    try {
      const outcome = await input.adapter.getScenarioOutcome(item.scenario, item.persona)

      if (!outcome.experienceEvidence) {
        throw new Error('Adapter returned no experience evidence.')
      }

      const score = scoreFriction({
        runId: input.runId,
        persona: item.persona,
        scenario: item.scenario,
        evidence: outcome.experienceEvidence,
      })
      scores.push(score)
      violations.push(...score.violations)
    } catch (error) {
      errors.push({
        scenarioId: item.scenario.id,
        personaId: item.persona.id,
        agent: 'experience',
        message: error instanceof Error ? error.message : 'Unknown experience agent error.',
        timestamp: new Date().toISOString(),
      })
    }
  }

  return { runId: input.runId, scores, violations, errors }
}
