import { NUTRITION_INTELLIGENCE_CONFIG } from '@/lib/nutrition/intelligenceConfig'

export type NutrientDailyExposure = {
  date: string
  nutrientKey: string
  amount: number | null
  target: number | null
  complete?: boolean | null
}

export type FunctionSignal = {
  functionKey: string
  days: number
  severity?: number | null
  trend?: 'improving' | 'stable' | 'declining' | 'poor' | null
}

export type AnastasisSupplement = {
  id: string
  name: string
  nutrients: Array<{ nutrientKey: string; amount?: number | null; unit?: string | null }>
  supportedFunctions: string[]
}

export type SupplementEligibilityInput = {
  nutrientKey: string
  exposures: NutrientDailyExposure[]
  functionSignals: FunctionSignal[]
  nutrientFunctions: string[]
  supplements: AnastasisSupplement[]
  config?: Partial<typeof NUTRITION_INTELLIGENCE_CONFIG.nutrientGap>
}

export type SupplementEligibility = {
  eligible: boolean
  supplement: AnastasisSupplement | null
  nutrientKey: string
  observedLowDays: number
  sufficientDataDays: number
  dataCompleteness: number
  matchedFunctions: string[]
  reason: string
  message: string
}

function mergedConfig(config?: Partial<typeof NUTRITION_INTELLIGENCE_CONFIG.nutrientGap>) {
  return { ...NUTRITION_INTELLIGENCE_CONFIG.nutrientGap, ...(config || {}) }
}

function hasRelevantExperience(signal: FunctionSignal) {
  return signal.days >= 3 && (
    signal.trend === 'declining' ||
    signal.trend === 'poor' ||
    (typeof signal.severity === 'number' && signal.severity >= 5)
  )
}

export function evaluateSupplementEligibility(input: SupplementEligibilityInput): SupplementEligibility {
  const config = mergedConfig(input.config)
  const relevantRows = input.exposures
    .filter((row) => row.nutrientKey === input.nutrientKey)
    .slice(-config.lookbackDays)
  const completeRows = relevantRows.filter((row) => row.complete !== false && Number(row.amount) >= 0 && Number(row.target) > 0)
  const sufficientDataDays = completeRows.length
  const dataCompleteness = relevantRows.length ? sufficientDataDays / Math.min(config.lookbackDays, relevantRows.length) : 0
  const observedLowDays = completeRows.filter((row) => Number(row.amount) < Number(row.target) * config.lowIntakeRatio).length
  const experiencedFunctions = input.functionSignals
    .filter(hasRelevantExperience)
    .map((signal) => signal.functionKey)
  const functionSet = new Set(input.nutrientFunctions)
  const matchedFunctions = experiencedFunctions.filter((key) => functionSet.has(key))

  const base = {
    supplement: null,
    nutrientKey: input.nutrientKey,
    observedLowDays,
    sufficientDataDays,
    dataCompleteness: Math.round(dataCompleteness * 100) / 100,
    matchedFunctions,
  }

  if (sufficientDataDays < config.minimumEligibleDays) {
    return {
      ...base,
      eligible: false,
      reason: 'insufficient_longitudinal_data',
      message: "We're still learning your patterns before making supplement suggestions.",
    }
  }

  if (dataCompleteness < config.minimumCompleteness || observedLowDays < config.minimumLowDays) {
    return {
      ...base,
      eligible: false,
      reason: 'nutrient_pattern_not_recurrent',
      message: 'Your recent logs do not show a recurring enough nutrient pattern for a supplement match.',
    }
  }

  if (!matchedFunctions.length) {
    return {
      ...base,
      eligible: false,
      reason: 'no_matching_experience_signal',
      message: 'A nutrient pattern is present, but your current experience does not match a supplement purpose closely enough.',
    }
  }

  const supplement = input.supplements.find((product) => {
    const hasNutrient = product.nutrients.some((item) => item.nutrientKey === input.nutrientKey)
    const supportsExperience = product.supportedFunctions.some((key) => matchedFunctions.includes(key))
    return hasNutrient && supportsExperience
  }) || null

  if (!supplement) {
    return {
      ...base,
      eligible: false,
      reason: 'no_compatible_anastasis_formula',
      message: 'A recurring pattern is present, but no Anastasis formula matches both the nutrient pattern and your current experience.',
    }
  }

  return {
    ...base,
    eligible: true,
    supplement,
    reason: 'persistent_nutrient_gap_with_matching_experience_and_formula',
    message: `We've noticed this has been a recurring pattern rather than just a few off days. ${supplement.name} matches the nutrient gap and the related pattern showing up in your recent check-ins.`,
  }
}
