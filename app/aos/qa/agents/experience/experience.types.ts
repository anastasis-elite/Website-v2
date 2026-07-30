import type { ExperienceEvidence } from '../../adapters/adapter.types'
import type { QaViolation } from '../../reports/report.types'

export type ExperienceDimension =
  | 'decision-load'
  | 'action-load'
  | 'clarity'
  | 'confirmation'
  | 'continuity'
  | 'form-density'
  | 'workflow-interruption'

export type ExperienceDimensionScore = {
  dimension: ExperienceDimension
  score: number
  evidence: unknown
}

export type ExperienceScore = {
  overallFrictionScore: number
  dimensionScores: ExperienceDimensionScore[]
  violations: QaViolation[]
  recommendations: string[]
  evidence: ExperienceEvidence
}

export type ExperienceAgentResult = {
  runId: string
  scores: ExperienceScore[]
  violations: QaViolation[]
}
