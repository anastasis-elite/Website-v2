import type { ProgramTier } from '@/lib/dashboard/logic/types'

export type FoodLoggingTier = ProgramTier | string | null | undefined

const supportedProgramTiers = new Set(['ember', 'ignite', 'phoenix'])

export function normalizeProgramTier(value: FoodLoggingTier): ProgramTier {
  const normalized = String(value || '').trim().toLowerCase()

  if (supportedProgramTiers.has(normalized)) {
    return normalized as ProgramTier
  }

  return 'ignite'
}

export function canLogFood(tier: FoodLoggingTier) {
  const normalized = normalizeProgramTier(tier)

  return normalized === 'ember' || normalized === 'ignite' || normalized === 'phoenix'
}
