import { getTierCapabilities } from '@/lib/entitlements'

export type MealEntryType = 'breakfast' | 'lunch' | 'dinner' | 'snack'
export const WATER_ENTRY_HREF = '/dashboard/nutrition?log=water'

export function inferMealType(context?: string | null): MealEntryType | undefined {
  return context?.toLowerCase().match(/\b(breakfast|lunch|dinner|snack)\b/)?.[1] as MealEntryType | undefined
}

export function foodEntryHref(program?: string | null) {
  return getTierCapabilities(program).nutritionMealLogging
    ? '/dashboard/nutrition?log=food'
    : '/dashboard/nutrition'
}

export function mealEntryHref(program?: string | null, meal?: MealEntryType, recipeId?: string | null) {
  if (!getTierCapabilities(program).nutritionMealLogging) return '/dashboard/nutrition'
  const query = new URLSearchParams({ log: 'meal' })
  if (meal) query.set('meal', meal)
  if (recipeId) query.set('recipe', recipeId)
  return `/dashboard/nutrition?${query}`
}
