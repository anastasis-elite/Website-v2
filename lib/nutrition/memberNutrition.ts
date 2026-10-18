import { getTierCapabilities } from '@/lib/entitlements'

// This is a member-output boundary, not a change to saved intake or target math.
// Keep fiber and cholesterol here too: their gram/limit fields are not macros.
const micronutrientKeys = [
  'fiber', 'sodium', 'potassium', 'magnesium', 'calcium', 'iron', 'zinc',
  'selenium', 'cholesterol', 'choline', 'vitamin_a', 'vitamin_c', 'vitamin_d',
  'vitamin_e', 'vitamin_k', 'b1', 'b2', 'b3', 'b5', 'b6', 'b9', 'b12',
] as const
const micronutrientContainers = new Set(['micros', 'micronutrients', 'food_nutrients'])
const macroCalculationStrings = new Set([
  'statusLabel', 'statusDescription', 'calculationMode', 'calculationStatus', 'normalizedGoal',
])
const macroCalculationNumbers = new Set([
  'bmi', 'leanBodyMassKg', 'bodyFatPercentUsed', 'activityFactor', 'rollingActiveEnergy', 'rollingRestingEnergy',
])

function macroCalculationFields(value: Record<string, unknown>) {
  const output: Record<string, unknown> = {}
  for (const [key, field] of Object.entries(value)) {
    if (macroCalculationStrings.has(key) && typeof field === 'string') output[key] = field
    if (macroCalculationNumbers.has(key) && (field === null || typeof field === 'number' && Number.isFinite(field))) output[key] = field
  }
  if (typeof value.safeguardAdjusted === 'boolean') output.safeguardAdjusted = value.safeguardAdjusted
  if (Array.isArray(value.safeguardsApplied)) output.safeguardsApplied = value.safeguardsApplied.filter(field => typeof field === 'string')
  if (value.finalMacroPercentages && typeof value.finalMacroPercentages === 'object') {
    output.finalMacroPercentages = Object.fromEntries(Object.entries(value.finalMacroPercentages)
      .filter(([key, field]) => ['protein', 'carbs', 'fats'].includes(key) && typeof field === 'number' && Number.isFinite(field)))
  }
  return output
}

export function canTrackMicronutrients(program: unknown) {
  return getTierCapabilities(program).nutritionMicronutrients
}

function memberNutritionFields<T extends Record<string, unknown>>(row: T | null, program: unknown): T | null {
  if (!row || canTrackMicronutrients(program)) return row
  return Object.fromEntries(Object.entries(row).filter(([key]) =>
    !micronutrientContainers.has(key) && !micronutrientKeys.some(nutrient => key === nutrient || key.startsWith(`${nutrient}_`)),
  )) as T
}

export function memberNutritionLog<T extends Record<string, unknown>>(row: T | null, program: unknown): T | null {
  const projected = memberNutritionFields(row, program)
  if (!projected || canTrackMicronutrients(program)) return projected
  // Older-tier legacy meals can contain nested food/nutrient data. Keep those
  // records in storage; EMBER member responses use their macro/water totals.
  const withoutMeals: Record<string, unknown> = { ...projected }
  delete withoutMeals.meals
  if (withoutMeals.nutrition_calculation && typeof withoutMeals.nutrition_calculation === 'object') {
    withoutMeals.nutrition_calculation = macroCalculationFields(withoutMeals.nutrition_calculation as Record<string, unknown>)
  }
  return withoutMeals as T
}

export const memberNutritionRemaining = memberNutritionFields
export const memberFoodNutrition = memberNutritionFields

// Browser SDK reads must request the same restricted surface, not download
// hidden historical targets and discard them only after transport.
export function memberNutritionLogColumns(program: unknown): string {
  return canTrackMicronutrients(program) ? '*' : 'id,client_id,auth_user_id,log_date,calories,protein,carbs,fats,water_oz,water_consumed_oz,completed,updated_at'
}

export function memberNutritionRemainingColumns(program: unknown): string {
  return canTrackMicronutrients(program) ? '*' : 'nutrition_log_id,calories_remaining,protein_remaining_g,carbs_remaining_g,fat_remaining_g'
}
