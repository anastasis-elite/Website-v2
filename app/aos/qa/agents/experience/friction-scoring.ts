import type { ExperienceEvidence } from '../../adapters/adapter.types'
import type { QaViolation } from '../../reports/report.types'
import type { SyntheticPersona, SyntheticScenario } from '../../personas/persona.types'
import { scoreExperienceDimensions } from './heuristics'
import type { ExperienceScore } from './experience.types'

export function scoreFriction(input: {
  runId: string
  persona: SyntheticPersona
  scenario: SyntheticScenario
  evidence: ExperienceEvidence
}): ExperienceScore {
  const dimensionScores = scoreExperienceDimensions(input.evidence)
  const overallFrictionScore = Math.round(
    dimensionScores.reduce((sum, item) => sum + item.score, 0) / dimensionScores.length,
  )
  const violations: QaViolation[] = []

  dimensionScores.forEach((dimension, index) => {
    if (dimension.score < 50) return

    violations.push({
      id: `${input.runId}-experience-${input.scenario.id}-${String(index + 1).padStart(3, '0')}`,
      runId: input.runId,
      agent: 'experience',
      severity: dimension.score >= 85 ? 'high' : 'medium',
      area: dimension.dimension,
      title: `High friction: ${dimension.dimension}`,
      description: `Experience heuristic scored ${dimension.score}/100 for ${dimension.dimension}.`,
      expected: 'Dimension score below 50',
      actual: dimension,
      reproductionSteps: [
        `Generate persona ${input.persona.id}.`,
        `Run scenario ${input.scenario.id}.`,
        'Inspect adapter experience evidence.',
      ],
      personaId: input.persona.id,
      scenarioId: input.scenario.id,
      timestamp: new Date().toISOString(),
    })
  })

  return {
    overallFrictionScore,
    dimensionScores,
    violations,
    recommendations: buildRecommendations(dimensionScores),
    evidence: input.evidence,
  }
}

function buildRecommendations(dimensionScores: ExperienceScore['dimensionScores']): string[] {
  return dimensionScores
    .filter((dimension) => dimension.score >= 50)
    .map((dimension) => {
      switch (dimension.dimension) {
        case 'decision-load':
          return 'Reduce competing choices and identify one primary next decision.'
        case 'action-load':
          return 'Compress the workflow into fewer required actions.'
        case 'clarity':
          return 'Clarify labels and explain why the recommendation was selected.'
        case 'confirmation':
          return 'Add visible confirmation after completion.'
        case 'continuity':
          return 'Provide a valid next action and remove contradictory instructions.'
        case 'form-density':
          return 'Split dense forms or remove repeated data requests.'
        case 'workflow-interruption':
          return 'Avoid interrupting an active workflow unless the interruption is critical.'
      }
    })
}
