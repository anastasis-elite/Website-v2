import type { ExperienceEvidence } from '../../adapters/adapter.types'
import type { ExperienceDimensionScore } from './experience.types'

export function scoreExperienceDimensions(evidence: ExperienceEvidence): ExperienceDimensionScore[] {
  const scores: ExperienceDimensionScore[] = [
    {
      dimension: 'decision-load',
      score: boundedScore(evidence.requiredDecisions, 2, 6),
      evidence: { requiredDecisions: evidence.requiredDecisions },
    },
    {
      dimension: 'action-load',
      score: boundedScore(evidence.requiredActions, 3, 8),
      evidence: { requiredActions: evidence.requiredActions },
    },
    {
      dimension: 'clarity',
      score: Math.min(100, evidence.unclearLabels.length * 20 + evidence.missingExplanations.length * 15),
      evidence: {
        unclearLabels: evidence.unclearLabels,
        missingExplanations: evidence.missingExplanations,
      },
    },
    {
      dimension: 'confirmation',
      score: evidence.hasConfirmation ? 0 : 45,
      evidence: { hasConfirmation: evidence.hasConfirmation },
    },
    {
      dimension: 'continuity',
      score: Math.min(
        100,
        evidence.deadEnds.length * 50 +
          evidence.contradictoryInstructions.length * 35 +
          evidence.unavailableNextActions.length * 30,
      ),
      evidence: {
        deadEnds: evidence.deadEnds,
        contradictoryInstructions: evidence.contradictoryInstructions,
        unavailableNextActions: evidence.unavailableNextActions,
      },
    },
    {
      dimension: 'form-density',
      score:
        boundedScore(evidence.fieldsInLargestForm, 6, 14) +
        Math.min(30, evidence.repeatedDataRequests.length * 15),
      evidence: {
        fieldsInLargestForm: evidence.fieldsInLargestForm,
        repeatedDataRequests: evidence.repeatedDataRequests,
      },
    },
    {
      dimension: 'workflow-interruption',
      score: evidence.interruptsActiveWorkflow ? 50 : 0,
      evidence: { interruptsActiveWorkflow: evidence.interruptsActiveWorkflow },
    },
  ]

  return scores.map((score) => ({ ...score, score: Math.min(100, Math.round(score.score)) }))
}

function boundedScore(value: number, comfortable: number, severe: number): number {
  if (value <= comfortable) return 0
  if (value >= severe) return 100
  return ((value - comfortable) / (severe - comfortable)) * 100
}
