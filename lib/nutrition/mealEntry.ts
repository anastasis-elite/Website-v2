export const nutritionEntrySources = ['manual', 'barcode', 'recurring', 'photo_estimate'] as const
export const nutritionEntryStates = ['scheduled', 'pre_logged', 'confirmed', 'skipped'] as const

export type NutritionEntrySource = (typeof nutritionEntrySources)[number]
export type NutritionEntryState = (typeof nutritionEntryStates)[number]

export type NormalizedMealInput = {
  requestId?: string
  nutritionLogId: string
  foodId: string
  servingAmount: number
  servingOptionId?: string
  servingUnit?: string
  grams?: number
  mealName?: string
  mealPeriod?: string
  dayBlock?: string
  entrySource: NutritionEntrySource
  entryState: 'confirmed'
  recurringFoodId?: string
  symptoms?: string[]
  symptomNotes?: string
}

// Deliberately enumerated: never spread a request or provider response into a row.
export type MealEntryInsert = {
  id?: string
  nutrition_log_id: string
  food_id: string
  meal_name: string
  serving_amount: number
  serving_unit: string
  serving_option_id: string | null
  grams: number
  day_block: string
  meal_period: string
  entry_source: NutritionEntrySource
  entry_state: NutritionEntryState
  recurring_food_id: string | null
  confirmed_at: string | null
  skipped_at: string | null
  symptoms_after: string | null
  notes: string | null
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function normalizeMealInput(value: unknown):
  | { ok: true; input: NormalizedMealInput }
  | { ok: false; error: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ok: false, error: 'Invalid meal data.' }
  const body = value as Record<string, unknown>
  for (const key of ['nutritionLogId', 'foodId']) {
    if (typeof body[key] !== 'string' || !uuidPattern.test(body[key])) return { ok: false, error: 'Missing nutrition log or food.' }
  }
  const source = normalizeNutritionEntrySource(body.entrySource)
  if (!source) return { ok: false, error: 'Invalid nutrition entry source.' }
  if (normalizeNutritionEntryState(body.entryState) !== 'confirmed') return { ok: false, error: 'Confirm this food before adding it.' }
  const amount = positiveFiniteNumber(body.servingAmount ?? 1)
  if (!amount || typeof body.servingAmount === 'boolean') return { ok: false, error: 'Serving amount must be greater than zero.' }
  const input: NormalizedMealInput = {
    nutritionLogId: body.nutritionLogId as string,
    foodId: body.foodId as string,
    servingAmount: amount,
    entrySource: source,
    entryState: 'confirmed',
  }
  for (const key of ['requestId', 'servingOptionId', 'recurringFoodId'] as const) {
    if (body[key] === undefined || body[key] === null || body[key] === '') continue
    if (typeof body[key] !== 'string' || !uuidPattern.test(body[key])) return { ok: false, error: 'Invalid serving or recurring food.' }
    input[key] = body[key]
  }
  for (const key of ['servingUnit', 'mealName', 'mealPeriod', 'dayBlock', 'symptomNotes'] as const) {
    if (body[key] === undefined || body[key] === null) continue
    if (typeof body[key] !== 'string' || body[key].length > 2000) return { ok: false, error: 'Invalid meal details.' }
    input[key] = body[key]
  }
  if (body.grams !== undefined && body.grams !== null) {
    const grams = positiveFiniteNumber(body.grams)
    if (!grams || typeof body.grams === 'boolean') return { ok: false, error: 'Serving weight must be greater than zero.' }
    input.grams = grams
  }
  if (body.symptoms !== undefined) {
    if (!Array.isArray(body.symptoms) || body.symptoms.length > 30 || body.symptoms.some((id) => typeof id !== 'string' || !uuidPattern.test(id))) return { ok: false, error: 'Invalid symptoms.' }
    input.symptoms = body.symptoms
  }
  return { ok: true, input }
}

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
