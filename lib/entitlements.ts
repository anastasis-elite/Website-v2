export type ProgramTier = 'ember' | 'ignite' | 'phoenix'

export type NutritionCapability =
  | 'macro_entry'
  | 'meal_logging'
  | 'recommended_meal'

export type RecoveryCapability =
  | 'basic'
  | 'recommended'
  | 'directed'

export type TierCapability =
  | 'calendar'
  | 'whatsNext'
  | 'workoutDisplay'
  | 'nutritionMacroEntry'
  | 'nutritionMealLogging'
  | 'nutritionRecommendedMeal'
  | 'recipeFavorites'
  | 'recoveryBasic'
  | 'recoveryRecommendation'
  | 'recoveryDirectedNextAction'
  | 'assessmentPhotoUpload'
  | 'postureAssessment'
  | 'progressView'
  | 'assessmentsView'
  | 'trendsView'

export type TierCapabilities = Record<TierCapability, boolean> & {
  tier: ProgramTier
  nutrition: NutritionCapability
  recovery: RecoveryCapability
}

const supportedProgramTiers = new Set(['ember', 'ignite', 'phoenix'])

export function normalizeProgramTier(value: unknown): ProgramTier {
  const normalized = String(value || '').trim().toLowerCase()
  return supportedProgramTiers.has(normalized) ? normalized as ProgramTier : 'ignite'
}

const capabilitiesByTier: Record<ProgramTier, TierCapabilities> = {
  ember: {
    tier: 'ember',
    calendar: true,
    whatsNext: true,
    workoutDisplay: true,
    nutritionMacroEntry: true,
    nutritionMealLogging: false,
    nutritionRecommendedMeal: false,
    recipeFavorites: true,
    nutrition: 'macro_entry',
    recoveryBasic: true,
    recoveryRecommendation: false,
    recoveryDirectedNextAction: false,
    recovery: 'basic',
    assessmentPhotoUpload: true,
    postureAssessment: false,
    progressView: true,
    assessmentsView: true,
    trendsView: true,
  },
  ignite: {
    tier: 'ignite',
    calendar: true,
    whatsNext: true,
    workoutDisplay: true,
    nutritionMacroEntry: false,
    nutritionMealLogging: true,
    nutritionRecommendedMeal: false,
    recipeFavorites: true,
    nutrition: 'meal_logging',
    recoveryBasic: true,
    recoveryRecommendation: true,
    recoveryDirectedNextAction: false,
    recovery: 'recommended',
    assessmentPhotoUpload: true,
    postureAssessment: true,
    progressView: true,
    assessmentsView: true,
    trendsView: true,
  },
  phoenix: {
    tier: 'phoenix',
    calendar: true,
    whatsNext: true,
    workoutDisplay: true,
    nutritionMacroEntry: false,
    nutritionMealLogging: true,
    nutritionRecommendedMeal: true,
    recipeFavorites: true,
    nutrition: 'recommended_meal',
    recoveryBasic: true,
    recoveryRecommendation: true,
    recoveryDirectedNextAction: true,
    recovery: 'directed',
    assessmentPhotoUpload: true,
    postureAssessment: true,
    progressView: true,
    assessmentsView: true,
    trendsView: true,
  },
}

export function getTierCapabilities(value: unknown): TierCapabilities {
  return capabilitiesByTier[normalizeProgramTier(value)]
}

export function hasTierCapability(value: unknown, capability: TierCapability) {
  return getTierCapabilities(value)[capability]
}
