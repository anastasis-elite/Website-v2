import type { MealPeriod } from '@/lib/nutrition/mealPeriod'

export type NutritionLoggingIntent = {
  action: 'water' | 'food' | 'meal' | null
  meal: MealPeriod | undefined
  recipeId: string | undefined
}

export function parseNutritionLoggingIntent(params: Record<string, string | string[] | undefined>): NutritionLoggingIntent {
  const action = typeof params.log === 'string' && ['water', 'food', 'meal'].includes(params.log)
    ? params.log as 'water' | 'food' | 'meal' : null
  const meals: Record<string, MealPeriod> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' }
  const mealKey = typeof params.meal === 'string' ? params.meal.toLowerCase() : ''
  const meal = Object.prototype.hasOwnProperty.call(meals, mealKey) ? meals[mealKey] : undefined
  const recipeId = typeof params.recipe === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(params.recipe) ? params.recipe : undefined
  return { action, meal, recipeId }
}
