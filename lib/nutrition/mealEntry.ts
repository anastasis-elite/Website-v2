export const nutritionEntrySources = ['manual', 'barcode', 'recurring', 'photo_estimate'] as const
export const nutritionEntryStates = ['scheduled', 'pre_logged', 'confirmed', 'skipped'] as const

export type NutritionEntrySource = (typeof nutritionEntrySources)[number]
export type NutritionEntryState = (typeof nutritionEntryStates)[number]

type FoodServingRow = {
  default_serving_unit?: string | null
  grams_per_serving?: number | string | null
}

type ServingOptionRow = {
  food_id: string
  label?: string | null
  unit?: string | null
  grams?: number | string | null
}

export function positiveFiniteNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export function normalizeNutritionEntrySource(value: unknown): NutritionEntrySource | null {
  const source = String(value || 'manual')
  return nutritionEntrySources.includes(source as NutritionEntrySource)
    ? (source as NutritionEntrySource)
    : null
}

export function normalizeNutritionEntryState(value: unknown): NutritionEntryState | null {
  const state = String(value || 'confirmed')
  return nutritionEntryStates.includes(state as NutritionEntryState)
    ? (state as NutritionEntryState)
    : null
}

export function resolveMealServingGrams({
  amount,
  explicitGrams,
  food,
  servingOption,
}: {
  amount: number
  explicitGrams?: unknown
  food?: FoodServingRow | null
  servingOption?: ServingOptionRow | null
}) {
  const optionGrams = positiveFiniteNumber(servingOption?.grams)
  if (servingOption && optionGrams) {
    return {
      grams: amount * optionGrams,
      servingUnit: servingOption.label || servingOption.unit || 'serving',
      source: 'serving_option' as const,
    }
  }

  const submittedGrams = positiveFiniteNumber(explicitGrams)
  if (submittedGrams) {
    return {
      grams: submittedGrams,
      servingUnit: 'g',
      source: 'explicit_grams' as const,
    }
  }

  const foodGrams = positiveFiniteNumber(food?.grams_per_serving)
  if (foodGrams) {
    return {
      grams: amount * foodGrams,
      servingUnit: food?.default_serving_unit || 'serving',
      source: 'food_default' as const,
    }
  }

  return null
}

export function nutrientForGrams(per100gValue: unknown, grams: unknown) {
  const nutrient = Number(per100gValue)
  const gramAmount = Number(grams)

  if (!Number.isFinite(nutrient) || nutrient < 0) return null
  if (!Number.isFinite(gramAmount) || gramAmount <= 0) return null

  return Math.round(nutrient * gramAmount) / 100
}
