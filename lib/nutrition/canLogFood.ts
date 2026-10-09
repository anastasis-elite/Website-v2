import { getTierCapabilities, normalizeProgramTier, type ProgramTier } from '@/lib/entitlements'

export type FoodLoggingTier = ProgramTier | string | null | undefined

export function canLogFood(tier: FoodLoggingTier) {
  return getTierCapabilities(tier).nutritionMealLogging
}

export { normalizeProgramTier }
