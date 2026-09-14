import type { MenstrualFlowBurdenResult } from '@/lib/cycle/menstrualFlow'
import type { PhysiologyPatternFlag } from '@/lib/physiology/patternEngine'

export const PHYSIOLOGY_RECOMMENDATION_RULE_VERSION = 'physiology_recommendation_effects_v1.0.0'

export type PhysiologyRecommendationContext = {
  flowBurden?: Pick<MenstrualFlowBurdenResult, 'burdenScore' | 'burdenBand' | 'factors' | 'algorithmVersion'> | null
  flowEnergyPattern?: boolean
  activePatterns?: Array<Pick<PhysiologyPatternFlag, 'pattern' | 'confidence' | 'contributingDomains' | 'algorithmVersion' | 'recommendationEffects'>>
}

export type RecommendationEffect = {
  key: string
  priorityBoost: number
  reason: string
  nutrients: string[]
}

export type RecommendationEffectBundle = {
  ruleVersion: string
  effects: RecommendationEffect[]
  audit: {
    patternKeys: string[]
    evidenceDomains: string[]
    confidenceAtRecommendation: number | null
    ruleVersion: string
  }
}

export function buildPhysiologyRecommendationEffects(context?: PhysiologyRecommendationContext | null): RecommendationEffectBundle {
  const effects: RecommendationEffect[] = []
  const activePatterns = context?.activePatterns || []
  const highFlow =
    context?.flowBurden?.burdenBand === 'high' ||
    context?.flowBurden?.burdenBand === 'very_high'

  if (highFlow || context?.flowEnergyPattern) {
    effects.push({
      key: 'menstrual_flow_food_support',
      priorityBoost: highFlow ? 1.25 : 0.75,
      reason: 'Supports today’s flow and recovery context without inferring anemia or iron deficiency',
      nutrients: ['iron', 'vitamin_c', 'protein', 'potassium', 'magnesium', 'sodium'],
    })
  }

  for (const pattern of activePatterns) {
    if (pattern.confidence < 0.35) continue

    if (pattern.pattern === 'stress_recovery_associated') {
      effects.push({
        key: 'stress_recovery_food_support',
        priorityBoost: Math.min(1, pattern.confidence),
        reason: 'Supports recovery with steady energy, hydration, and adequate protein',
        nutrients: ['protein', 'magnesium', 'potassium', 'fiber'],
      })
    }

    if (pattern.pattern === 'insulin_metabolic_associated') {
      effects.push({
        key: 'stable_energy_meal_structure',
        priorityBoost: Math.min(0.9, pattern.confidence),
        reason: 'Supports stable energy with protein, fiber, and balanced meal structure',
        nutrients: ['protein', 'fiber', 'magnesium'],
      })
    }

    if (
      pattern.pattern === 'estrogen_associated' ||
      pattern.pattern === 'progesterone_associated' ||
      pattern.pattern === 'androgen_associated'
    ) {
      effects.push({
        key: `${pattern.pattern}_wellness_context`,
        priorityBoost: Math.min(0.65, pattern.confidence * 0.8),
        reason: 'Adjusts food priorities based on multisystem wellness context without labeling hormone levels',
        nutrients: ['fiber', 'protein', 'magnesium', 'zinc', 'b6'],
      })
    }
  }

  const patternKeys = activePatterns
    .filter((pattern) => pattern.confidence >= 0.35)
    .map((pattern) => String(pattern.pattern))
  if (highFlow || context?.flowEnergyPattern) {
    patternKeys.unshift('menstrual_flow_burden')
  }
  const evidenceDomains = Array.from(
    new Set(activePatterns.flatMap((pattern) => pattern.contributingDomains || [])),
  )
  const confidences = activePatterns.map((pattern) => pattern.confidence).filter((value) => Number.isFinite(value))
  const confidenceAtRecommendation = confidences.length
    ? Math.round((Math.max(...confidences) + Number.EPSILON) * 100) / 100
    : context?.flowBurden
      ? context.flowBurden.burdenScore / 40
      : null

  return {
    ruleVersion: PHYSIOLOGY_RECOMMENDATION_RULE_VERSION,
    effects,
    audit: {
      patternKeys,
      evidenceDomains,
      confidenceAtRecommendation,
      ruleVersion: PHYSIOLOGY_RECOMMENDATION_RULE_VERSION,
    },
  }
}
