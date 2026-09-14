export const PHYSIOLOGY_PATTERN_VERSION = 'physiology_pattern_engine_v1.0.0'
export const NO_ENDOCRINE_PATTERN_FROM_SINGLE_DOMAIN = true

export type PhysiologyPatternKind =
  | 'estrogen_associated'
  | 'progesterone_associated'
  | 'androgen_associated'
  | 'insulin_metabolic_associated'
  | 'stress_recovery_associated'

export type EvidenceDomain =
  | 'regional_body_composition'
  | 'menstrual_reproductive'
  | 'symptoms'
  | 'recovery'
  | 'nutrition'
  | 'medication_hrt_supplements'
  | 'posture_musculoskeletal'
  | 'longitudinal_response'
  | 'clinician_lab'

export type EvidenceDirection = 'supporting' | 'conflicting'

export type PatternEvidenceInput = {
  pattern: PhysiologyPatternKind
  domain: EvidenceDomain
  direction: EvidenceDirection
  strength: 'low' | 'moderate' | 'high'
  observation: string
  observedAt?: string | null
}

export type PhysiologyPatternFlag = {
  pattern: PhysiologyPatternKind
  algorithmVersion: string
  confidence: number
  contributingDomains: EvidenceDomain[]
  supportingEvidence: PatternEvidenceInput[]
  conflictingEvidence: PatternEvidenceInput[]
  longitudinalConsistency: 'not_established' | 'emerging' | 'recurring' | 'consistent'
  dateFirstObserved: string | null
  dateLastEvaluated: string
  recommendationEffects: string[]
  clinicalEscalationStatus: 'none' | 'watch' | 'consider_follow_up'
  classification: 'algorithmic_wellness_observation_non_diagnostic'
  suppressedReason?: string | null
}

const domainWeights: Record<EvidenceDomain, number> = {
  posture_musculoskeletal: 0.05,
  regional_body_composition: 0.18,
  symptoms: 0.16,
  menstrual_reproductive: 0.2,
  recovery: 0.18,
  nutrition: 0.12,
  medication_hrt_supplements: 0.12,
  longitudinal_response: 0.18,
  clinician_lab: 0.28,
}

const strengthMultiplier = {
  low: 0.55,
  moderate: 1,
  high: 1.35,
}

function round(value: number, places = 2) {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}

function uniq<T>(values: T[]) {
  return Array.from(new Set(values))
}

function evaluatedDate(evidence: PatternEvidenceInput[]) {
  const dates = evidence
    .map((item) => item.observedAt)
    .filter((value): value is string => Boolean(value))
    .sort()

  return dates[dates.length - 1] || new Date().toISOString()
}

function firstObservedDate(evidence: PatternEvidenceInput[]) {
  const dates = evidence
    .map((item) => item.observedAt)
    .filter((value): value is string => Boolean(value))
    .sort()

  return dates[0] || null
}

function weightedScore(evidence: PatternEvidenceInput[]) {
  return evidence.reduce((sum, item) => {
    return sum + domainWeights[item.domain] * strengthMultiplier[item.strength]
  }, 0)
}

function consistencyFrom(evidence: PatternEvidenceInput[]) {
  const dates = uniq(
    evidence
      .map((item) => item.observedAt?.split('T')[0])
      .filter((value): value is string => Boolean(value)),
  )

  if (dates.length >= 6) return 'consistent'
  if (dates.length >= 3) return 'recurring'
  if (dates.length >= 2) return 'emerging'
  return 'not_established'
}

function effectsForPattern(pattern: PhysiologyPatternKind, confidence: number) {
  if (confidence < 0.35) return []

  if (pattern === 'stress_recovery_associated') {
    return ['recovery_support_priority', 'training_readiness_conservative']
  }

  if (pattern === 'insulin_metabolic_associated') {
    return ['protein_fiber_meal_structure_priority', 'stable_energy_timing']
  }

  return ['food_priority_context', 'recovery_context']
}

export function evaluatePhysiologyPatterns({
  evidence,
  priorFlags,
  evaluatedAt,
}: {
  evidence: PatternEvidenceInput[]
  priorFlags?: Array<{ pattern: PhysiologyPatternKind; confidence?: number | null }>
  evaluatedAt?: string
}): PhysiologyPatternFlag[] {
  const now = evaluatedAt || evaluatedDate(evidence)
  const patterns = uniq(evidence.map((item) => item.pattern))

  return patterns.map((pattern) => {
    const patternEvidence = evidence.filter((item) => item.pattern === pattern)
    const supportingEvidence = patternEvidence.filter((item) => item.direction === 'supporting')
    const conflictingEvidence = patternEvidence.filter((item) => item.direction === 'conflicting')
    const supportingDomains = uniq(supportingEvidence.map((item) => item.domain))
    const nonPostureSupportingDomains = supportingDomains.filter((domain) => domain !== 'posture_musculoskeletal')
    const previousConfidence = priorFlags?.find((item) => item.pattern === pattern)?.confidence

    let suppressedReason: string | null = null

    if (nonPostureSupportingDomains.length < 2) {
      suppressedReason = 'No endocrine-associated wellness pattern is created from a single independent domain.'
    }

    if (supportingDomains.length === 1 && supportingDomains[0] === 'posture_musculoskeletal') {
      suppressedReason = 'Posture alone cannot trigger a hormone-associated wellness flag.'
    }

    const supportingScore = weightedScore(supportingEvidence)
    const conflictingScore = weightedScore(conflictingEvidence)
    const convergenceBonus = Math.max(0, nonPostureSupportingDomains.length - 1) * 0.12
    const consistency = consistencyFrom(supportingEvidence)
    const consistencyBonus =
      consistency === 'consistent'
        ? 0.15
        : consistency === 'recurring'
          ? 0.1
          : consistency === 'emerging'
            ? 0.04
            : 0
    const priorSignal =
      typeof previousConfidence === 'number'
        ? Math.min(0.08, Math.max(0, previousConfidence - 0.4) * 0.2)
        : 0

    const rawConfidence = supportingScore + convergenceBonus + consistencyBonus + priorSignal - conflictingScore * 1.25
    const confidence = suppressedReason ? 0 : round(Math.max(0, Math.min(0.95, rawConfidence)))
    const escalation =
      confidence >= 0.72 && consistency !== 'not_established'
        ? 'consider_follow_up'
        : confidence >= 0.45
          ? 'watch'
          : 'none'

    return {
      pattern,
      algorithmVersion: PHYSIOLOGY_PATTERN_VERSION,
      confidence,
      contributingDomains: supportingReasonableDomains(supportingDomains),
      supportingEvidence,
      conflictingEvidence,
      longitudinalConsistency: consistency,
      dateFirstObserved: firstObservedDate(supportingEvidence),
      dateLastEvaluated: now,
      recommendationEffects: effectsForPattern(pattern, confidence),
      clinicalEscalationStatus: escalation,
      classification: 'algorithmic_wellness_observation_non_diagnostic',
      suppressedReason,
    }
  })
}

function supportingReasonableDomains(domains: EvidenceDomain[]) {
  return domains.filter((domain) => domain !== 'posture_musculoskeletal' || domains.length > 1)
}

export function buildClinicianPatternObservation(flag: PhysiologyPatternFlag) {
  return {
    title: `Multisystem Pattern Observation - ${flag.pattern.replaceAll('_', ' ')}`,
    classification: 'Algorithmic wellness observation; non-diagnostic.',
    pattern: flag.pattern,
    confidence: flag.confidence,
    algorithmVersion: flag.algorithmVersion,
    measuredData: [],
    selfReportedData: flag.supportingEvidence
      .filter((item) => ['symptoms', 'menstrual_reproductive', 'recovery'].includes(item.domain))
      .map((item) => item.observation),
    calculatedData: flag.supportingEvidence
      .filter((item) => ['regional_body_composition', 'longitudinal_response'].includes(item.domain))
      .map((item) => item.observation),
    algorithmicWellnessObservation: {
      contributingDomains: flag.contributingDomains,
      supportingEvidence: flag.supportingEvidence.map((item) => item.observation),
      conflictingEvidence: flag.conflictingEvidence.map((item) => item.observation),
      recommendationEffects: flag.recommendationEffects,
    },
    clinicianProvidedData: [],
    clinicalInterpretation:
      'These findings represent longitudinal wellness observations and are provided for independent interpretation by the member’s licensed healthcare professional.',
    nonDiagnosticBoundary:
      'No hormone concentration was determined by Anastasis and no endocrine diagnosis, treatment, or prescription was generated.',
  }
}
