import { parseMembershipTier, type MembershipTier } from './membership/tiers'

export type ProgramTier = 'ember' | 'ignite' | 'phoenix'

export type NutritionCapability =
  | 'none'
  | 'macro_entry'
  | 'meal_logging'
  | 'recommended_meal'

export type RecoveryCapability =
  | 'none'
  | 'basic'
  | 'recommended'
  | 'directed'

export type TierCapability =
  | 'calendar'
  | 'whatsNext'
  | 'workoutDisplay'
  | 'nutritionTracking'
  | 'nutritionMacroEntry'
  | 'nutritionMicronutrients'
  | 'nutritionMealLogging'
  | 'nutritionBarcodeScanning'
  | 'nutritionRecurringFoodDetection'
  | 'nutritionAutomaticPreLogging'
  | 'nutritionPhotoMacroEstimation'
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
  tier: MembershipTier | 'unknown'
  nutrition: NutritionCapability
  recovery: RecoveryCapability
}

const supportedProgramTiers = new Set(['ember', 'ignite', 'phoenix'])

export function normalizeProgramTier(value: unknown): ProgramTier {
  const normalized = String(value || '').trim().toLowerCase()
  if (!supportedProgramTiers.has(normalized)) throw new Error('A recognized coaching tier is required.')
  return normalized as ProgramTier
}

// Macro-only totals are EMBER's established input. IGNITE/PHOENIX record
// foods/meals through their separate manual/barcode/photo capabilities.
// Keep this aligned with the EMBER-only macro INSERT API and RLS.
const capabilitiesByTier: Record<ProgramTier, TierCapabilities> = {
  ember: {
    tier: 'ember',
    calendar: true,
    whatsNext: true,
    workoutDisplay: true,
    nutritionTracking: true,
    nutritionMacroEntry: true,
    nutritionMicronutrients: false,
    nutritionMealLogging: false,
    nutritionBarcodeScanning: false,
    nutritionRecurringFoodDetection: false,
    nutritionAutomaticPreLogging: false,
    nutritionPhotoMacroEstimation: false,
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
    nutritionTracking: true,
    nutritionMacroEntry: false,
    nutritionMicronutrients: true,
    nutritionMealLogging: true,
    nutritionBarcodeScanning: true,
    nutritionRecurringFoodDetection: true,
    nutritionAutomaticPreLogging: true,
    nutritionPhotoMacroEstimation: false,
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
    nutritionTracking: true,
    nutritionMacroEntry: false,
    nutritionMicronutrients: true,
    nutritionMealLogging: true,
    nutritionBarcodeScanning: true,
    nutritionRecurringFoodDetection: true,
    nutritionAutomaticPreLogging: true,
    nutritionPhotoMacroEstimation: false,
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
  const tier = parseMembershipTier(value)
  if (tier === 'ember' || tier === 'ignite' || tier === 'phoenix') return capabilitiesByTier[tier]
  const denied = Object.fromEntries(Object.keys(capabilitiesByTier.ember).map(key => [key, false])) as unknown as TierCapabilities
  const base: TierCapabilities = { ...denied, tier: tier || 'unknown', nutrition: 'none', recovery: 'none' }
  return tier === 'tracker' ? { ...base, workoutDisplay: true, nutritionTracking: true, nutritionMacroEntry: true,
    recoveryBasic: true, progressView: true, nutrition: 'macro_entry', recovery: 'basic' } : base
}

export function hasTierCapability(value: unknown, capability: TierCapability) {
  return getTierCapabilities(value)[capability]
}
