export const SUPPLEMENT_RECOMMENDATION_ENGINE_VERSION = 'supplement_recommendation_v1.0.0'

export const MIN_OBSERVATION_DAYS = 10
export const STANDARD_OBSERVATION_DAYS = 14

export type SupplementSupportCategory =
  | 'sleep_support'
  | 'energy_support'
  | 'recovery_support'
  | 'muscle_function'
  | 'stress_resilience'
  | 'cycle_support'
  | 'general_nutrition'

export type SupplementRecommendationReasonCode =
  | 'insufficient_observation_time'
  | 'insufficient_logging_completeness'
  | 'nutritional_pattern_not_recurrent'
  | 'no_corresponding_functional_issue'
  | 'functional_trend_improving'
  | 'no_matching_formulation'
  | 'safety_suppressed'
  | 'recently_resolved'
  | 'qualified'

export type SupplementRecommendationConfig = {
  minObservationDays: number
  standardObservationDays: number
  minDataCompleteness: number
  minRecurrenceRate: number
  adequateCoverageThreshold: number
  minFunctionalDays: number
  suboptimalFunctionalThreshold: number
  decliningTrendDelta: number
  resolutionRecurrenceRate: number
  resolutionFunctionalThreshold: number
  recentlyResolvedDays: number
}

export const DEFAULT_SUPPLEMENT_RECOMMENDATION_CONFIG: SupplementRecommendationConfig = {
  minObservationDays: MIN_OBSERVATION_DAYS,
  standardObservationDays: STANDARD_OBSERVATION_DAYS,
  minDataCompleteness: 0.7,
  minRecurrenceRate: 0.72,
  adequateCoverageThreshold: 0.85,
  minFunctionalDays: 4,
  suboptimalFunctionalThreshold: 5,
  decliningTrendDelta: -0.75,
  resolutionRecurrenceRate: 0.45,
  resolutionFunctionalThreshold: 6,
  recentlyResolvedDays: 14,
}

export type NutrientCoverageDay = {
  date: string
  nutrientKey: string
  nutrientName?: string | null
  estimatedDailyIntake: number | null
  referenceTarget: number | null
  unit: string
  adequatelyLogged: boolean
}

export type NutrientCoveragePattern = {
  nutrientKey: string
  nutrientName: string
  unit: string
  adequateLoggedDays: number
  belowTargetDays: number
  recurrencePercentage: number
  sevenDayTrend: number | null
  fourteenDayTrend: number | null
  averageCoveragePercentage: number | null
  isRecurring: boolean
}

export type FunctionalTrendInput = {
  category: SupplementSupportCategory
  date: string
  value: number | null
  higherIsBetter?: boolean
}

export type FunctionalTrend = {
  category: SupplementSupportCategory
  loggedDays: number
  averageValue: number | null
  sevenDayTrend: number | null
  isPersistentlySuboptimal: boolean
  isTrendingWorse: boolean
  isSuboptimalOrDeclining: boolean
}

export type FormulationDefinition = {
  productId: string
  productName: string
  active: boolean
  productUrl?: string | null
  nutrients: string[]
  supportCategories: SupplementSupportCategory[]
  contraindicationMetadata?: {
    suppressWhen?: string[]
    ingredientAllergens?: string[]
    upperIntakeConcernNutrients?: string[]
  } | null
  recommendationCopy?: string | null
  disclaimerCopy?: string | null
  minimumMatchingRequirements?: {
    minRecurringNutrients?: number
    minFunctionalCategories?: number
  } | null
}

export type SafetyContext = {
  pregnancyOrBreastfeeding?: boolean
  medicationInteractionConcern?: boolean
  diagnosedConditionConcern?: boolean
  knownIngredientAllergies?: string[]
  contraindicationConcern?: boolean
  upperIntakeConcernNutrients?: string[]
  recentlyResolvedProductIds?: string[]
}

export type SupplementRecommendation = {
  productId: string
  productName: string
  productUrl: string | null
  category: SupplementSupportCategory
  recommendationCopy: string
  disclaimerCopy: string
  why: {
    nutrition: string
    trend: string
    reason: string
    disclaimer: string
  }
  reasonCodes: SupplementRecommendationReasonCode[]
  recommendedAt: string
  lastQualifiedAt: string
}

export type SupplementRecommendationDebug = {
  observationDays: number
  loggingCompleteness: number
  recurringNutrientPatterns: NutrientCoveragePattern[]
  relevantFunctionalTrends: FunctionalTrend[]
  eligibleFormulations: Array<{
    productId: string
    productName: string
    category: SupplementSupportCategory
    matchedNutrients: string[]
    score: number
  }>
  recommendationGenerated: boolean
  reasonCodes: SupplementRecommendationReasonCode[]
  resolved: boolean
  safetySuppressedProducts: string[]
}

export type SupplementRecommendationResult = {
  recommendation: SupplementRecommendation | null
  debug: SupplementRecommendationDebug
}

const nutrientCategories: Record<string, SupplementSupportCategory[]> = {
  magnesium: ['sleep_support', 'recovery_support', 'muscle_function', 'stress_resilience'],
  calcium: ['muscle_function', 'general_nutrition'],
  potassium: ['recovery_support', 'muscle_function', 'general_nutrition'],
  vitamin_d: ['recovery_support', 'muscle_function', 'general_nutrition'],
  vitamin_c: ['recovery_support', 'general_nutrition'],
  zinc: ['recovery_support', 'general_nutrition'],
  iron: ['energy_support', 'cycle_support', 'general_nutrition'],
  b12: ['energy_support', 'general_nutrition'],
  b9: ['energy_support', 'cycle_support', 'general_nutrition'],
  b6: ['energy_support', 'cycle_support', 'stress_resilience'],
  protein: ['recovery_support', 'muscle_function', 'general_nutrition'],
}

function numeric(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function average(values: Array<number | null | undefined>) {
  const nums = values.map(numeric).filter((value): value is number => value !== null)
  return nums.length ? nums.reduce((sum, value) => sum + value, 0) / nums.length : null
}

function trend(values: Array<number | null | undefined>) {
  const nums = values.map(numeric).filter((value): value is number => value !== null)
  if (nums.length < 4) return null
  const midpoint = Math.floor(nums.length / 2)
  const earlier = average(nums.slice(0, midpoint))
  const later = average(nums.slice(midpoint))
  return earlier === null || later === null ? null : Number((later - earlier).toFixed(2))
}

function uniqueDates(days: NutrientCoverageDay[]) {
  return Array.from(new Set(days.map((day) => day.date))).sort()
}

function coveragePatternForNutrient(
  days: NutrientCoverageDay[],
  config: SupplementRecommendationConfig,
): NutrientCoveragePattern {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date))
  const logged = sorted.filter((day) => {
    const intake = numeric(day.estimatedDailyIntake)
    const target = numeric(day.referenceTarget)
    return day.adequatelyLogged && intake !== null && target !== null && target > 0
  })
  const coverageRatios = logged.map((day) => {
    const intake = numeric(day.estimatedDailyIntake) || 0
    const target = numeric(day.referenceTarget) || 1
    return intake / target
  })
  const belowTargetDays = coverageRatios.filter((ratio) => ratio < config.adequateCoverageThreshold).length
  const recurrencePercentage = logged.length ? belowTargetDays / logged.length : 0

  return {
    nutrientKey: sorted[0]?.nutrientKey || 'unknown',
    nutrientName: sorted[0]?.nutrientName || sorted[0]?.nutrientKey?.replaceAll('_', ' ') || 'Nutrient',
    unit: sorted[0]?.unit || '',
    adequateLoggedDays: logged.length,
    belowTargetDays,
    recurrencePercentage,
    sevenDayTrend: trend(coverageRatios.slice(-7)),
    fourteenDayTrend: trend(coverageRatios.slice(-14)),
    averageCoveragePercentage: coverageRatios.length ? Math.round((average(coverageRatios) || 0) * 100) : null,
    isRecurring: logged.length >= config.minObservationDays && recurrencePercentage >= config.minRecurrenceRate,
  }
}

export function detectNutrientCoveragePatterns(
  days: NutrientCoverageDay[],
  config: SupplementRecommendationConfig = DEFAULT_SUPPLEMENT_RECOMMENDATION_CONFIG,
) {
  const byNutrient = new Map<string, NutrientCoverageDay[]>()
  for (const day of days) {
    const key = day.nutrientKey
    byNutrient.set(key, [...(byNutrient.get(key) || []), day])
  }
  return Array.from(byNutrient.values()).map((items) => coveragePatternForNutrient(items, config))
}

export function evaluateFunctionalTrends(
  inputs: FunctionalTrendInput[],
  config: SupplementRecommendationConfig = DEFAULT_SUPPLEMENT_RECOMMENDATION_CONFIG,
) {
  const byCategory = new Map<SupplementSupportCategory, FunctionalTrendInput[]>()
  for (const input of inputs) {
    byCategory.set(input.category, [...(byCategory.get(input.category) || []), input])
  }

  return Array.from(byCategory.entries()).map(([category, rows]) => {
    const sorted = rows.sort((a, b) => a.date.localeCompare(b.date))
    const values = sorted.map((row) => numeric(row.value))
    const loggedDays = values.filter((value) => value !== null).length
    const averageValue = average(values)
    const rawTrend = trend(values.slice(-7))
    const higherIsBetter = sorted[0]?.higherIsBetter !== false
    const adjustedTrend = rawTrend === null || higherIsBetter ? rawTrend : rawTrend * -1
    const isPersistentlySuboptimal =
      loggedDays >= config.minFunctionalDays &&
      averageValue !== null &&
      (higherIsBetter
        ? averageValue <= config.suboptimalFunctionalThreshold
        : averageValue >= config.suboptimalFunctionalThreshold)
    const isTrendingWorse =
      loggedDays >= config.minFunctionalDays &&
      adjustedTrend !== null &&
      adjustedTrend <= config.decliningTrendDelta

    return {
      category,
      loggedDays,
      averageValue,
      sevenDayTrend: adjustedTrend,
      isPersistentlySuboptimal,
      isTrendingWorse,
      isSuboptimalOrDeclining: isPersistentlySuboptimal || isTrendingWorse,
    }
  })
}

function safetySuppressionReasons(formulation: FormulationDefinition, safety: SafetyContext) {
  const reasons: string[] = []
  const metadata = formulation.contraindicationMetadata || {}
  const suppressWhen = metadata.suppressWhen || []
  if (safety.pregnancyOrBreastfeeding && suppressWhen.includes('pregnancy_or_breastfeeding')) reasons.push('pregnancy_or_breastfeeding')
  if (safety.medicationInteractionConcern && suppressWhen.includes('medication_interaction_concern')) reasons.push('medication_interaction_concern')
  if (safety.diagnosedConditionConcern && suppressWhen.includes('diagnosed_condition_concern')) reasons.push('diagnosed_condition_concern')
  if (safety.contraindicationConcern) reasons.push('contraindication_concern')

  const allergies = new Set((safety.knownIngredientAllergies || []).map((item) => item.toLowerCase()))
  if ((metadata.ingredientAllergens || []).some((item) => allergies.has(item.toLowerCase()))) reasons.push('known_ingredient_allergy')

  const upperConcerns = new Set((safety.upperIntakeConcernNutrients || []).map((item) => item.toLowerCase()))
  if ((metadata.upperIntakeConcernNutrients || []).some((item) => upperConcerns.has(item.toLowerCase()))) reasons.push('upper_intake_concern')

  return reasons
}

function safeCopy(formulation: FormulationDefinition, category: SupplementSupportCategory) {
  return formulation.recommendationCopy ||
    `Your recent food logs show that you have not consistently been getting foods that provide several nutrients involved in ${category.replaceAll('_', ' ')}. Your related wellness trend has also been lower during this period. ${formulation.productName} contains nutrients that can help supplement what you are getting through food.`
}

export function evaluateSupplementRecommendation({
  coverageDays,
  functionalInputs,
  formulations,
  safetyContext = {},
  config = DEFAULT_SUPPLEMENT_RECOMMENDATION_CONFIG,
  now = new Date(),
}: {
  coverageDays: NutrientCoverageDay[]
  functionalInputs: FunctionalTrendInput[]
  formulations: FormulationDefinition[]
  safetyContext?: SafetyContext
  config?: SupplementRecommendationConfig
  now?: Date
}): SupplementRecommendationResult {
  const dates = uniqueDates(coverageDays)
  const observationDays = dates.length
  const loggedDates = new Set(coverageDays.filter((day) => day.adequatelyLogged).map((day) => day.date))
  const loggingCompleteness = observationDays ? loggedDates.size / observationDays : 0
  const reasonCodes = new Set<SupplementRecommendationReasonCode>()

  if (observationDays < config.minObservationDays) reasonCodes.add('insufficient_observation_time')
  if (loggingCompleteness < config.minDataCompleteness) reasonCodes.add('insufficient_logging_completeness')

  const patterns = detectNutrientCoveragePatterns(coverageDays, config)
  const recurring = patterns.filter((pattern) => pattern.isRecurring)
  if (!recurring.length) reasonCodes.add('nutritional_pattern_not_recurrent')

  const functionalTrends = evaluateFunctionalTrends(functionalInputs, config)
  const relevantFunctionalTrends = functionalTrends.filter((item) => item.isSuboptimalOrDeclining)
  if (!relevantFunctionalTrends.length) reasonCodes.add('no_corresponding_functional_issue')
  if (functionalTrends.length && !relevantFunctionalTrends.length) reasonCodes.add('functional_trend_improving')

  const blocked = reasonCodes.has('insufficient_observation_time') ||
    reasonCodes.has('insufficient_logging_completeness') ||
    reasonCodes.has('nutritional_pattern_not_recurrent') ||
    reasonCodes.has('no_corresponding_functional_issue')

  const safetySuppressedProducts: string[] = []
  const eligibleFormulations = blocked ? [] : formulations
    .filter((formulation) => formulation.active)
    .map((formulation) => {
      const safetyReasons = safetySuppressionReasons(formulation, safetyContext)
      if (safetyReasons.length) {
        safetySuppressedProducts.push(formulation.productId)
        return null
      }

      if (safetyContext.recentlyResolvedProductIds?.includes(formulation.productId)) {
        reasonCodes.add('recently_resolved')
        return null
      }

      const formulationNutrients = new Set(formulation.nutrients)
      const recurringMatches = recurring.filter((pattern) => formulationNutrients.has(pattern.nutrientKey))
      const categoryMatches = relevantFunctionalTrends.filter((trendItem) => formulation.supportCategories.includes(trendItem.category))
      const nutrientCategoryMatches = recurringMatches.filter((pattern) => {
        const supported = nutrientCategories[pattern.nutrientKey] || ['general_nutrition']
        return categoryMatches.some((trendItem) => supported.includes(trendItem.category))
      })
      const minNutrients = formulation.minimumMatchingRequirements?.minRecurringNutrients || 1
      const minCategories = formulation.minimumMatchingRequirements?.minFunctionalCategories || 1
      if (nutrientCategoryMatches.length < minNutrients || categoryMatches.length < minCategories) return null

      const recurrenceScore = nutrientCategoryMatches.reduce((sum, pattern) => sum + pattern.recurrencePercentage, 0)
      const durationScore = Math.min(1, observationDays / config.standardObservationDays)
      const completenessScore = Math.min(1, loggingCompleteness)
      const functionalScore = categoryMatches.reduce((sum, trendItem) => sum + (trendItem.isPersistentlySuboptimal ? 1 : 0.7), 0)
      const score = Number((recurrenceScore + durationScore + completenessScore + functionalScore).toFixed(3))

      return {
        productId: formulation.productId,
        productName: formulation.productName,
        productUrl: formulation.productUrl || null,
        category: categoryMatches[0].category,
        matchedNutrients: nutrientCategoryMatches.map((pattern) => pattern.nutrientKey),
        score,
        formulation,
      }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => b.score - a.score)

  if (safetySuppressedProducts.length) reasonCodes.add('safety_suppressed')
  if (!blocked && !eligibleFormulations.length && !reasonCodes.has('recently_resolved')) reasonCodes.add('no_matching_formulation')

  const top = eligibleFormulations[0] || null
  if (top) reasonCodes.add('qualified')

  const resolved = Boolean(
    patterns.length &&
    patterns.every((pattern) => !pattern.isRecurring || pattern.recurrencePercentage < config.resolutionRecurrenceRate) &&
    functionalTrends.every((trendItem) => !trendItem.isSuboptimalOrDeclining || (trendItem.averageValue || 0) >= config.resolutionFunctionalThreshold),
  )

  const recommendation = top
    ? {
        productId: top.productId,
        productName: top.productName,
        productUrl: top.productUrl,
        category: top.category,
        recommendationCopy: safeCopy(top.formulation, top.category),
        disclaimerCopy: top.formulation.disclaimerCopy ||
          'This recommendation is based on your logged nutrition and wellness patterns and does not identify or diagnose a nutrient deficiency.',
        why: {
          nutrition: 'Your food logs have not consistently included your usual target amounts of several nutrients contained in this formulation.',
          trend: `You have also reported lower ${top.category.replaceAll('_', ' ')} recently.`,
          reason: 'Because these patterns have occurred together over time, Anastasis identified this formulation as one option for supplementing your nutrition.',
          disclaimer: 'This recommendation is based on your logged nutrition and wellness patterns and does not identify or diagnose a nutrient deficiency.',
        },
        reasonCodes: Array.from(reasonCodes),
        recommendedAt: now.toISOString(),
        lastQualifiedAt: now.toISOString(),
      }
    : null

  return {
    recommendation,
    debug: {
      observationDays,
      loggingCompleteness: Number(loggingCompleteness.toFixed(3)),
      recurringNutrientPatterns: recurring,
      relevantFunctionalTrends,
      eligibleFormulations: eligibleFormulations.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        category: item.category,
        matchedNutrients: item.matchedNutrients,
        score: item.score,
      })),
      recommendationGenerated: Boolean(recommendation),
      reasonCodes: Array.from(reasonCodes),
      resolved,
      safetySuppressedProducts,
    },
  }
}
