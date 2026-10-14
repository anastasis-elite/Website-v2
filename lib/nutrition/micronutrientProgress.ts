type NumericValue = number | string | null | undefined
type NutrientRow = Record<string, NumericValue>

export const trackedMicronutrients = [
  { key: 'fiber', label: 'Fiber', unit: 'g' },
  { key: 'sodium', label: 'Sodium', unit: 'mg' },
  { key: 'potassium', label: 'Potassium', unit: 'mg' },
  { key: 'magnesium', label: 'Magnesium', unit: 'mg' },
  { key: 'calcium', label: 'Calcium', unit: 'mg' },
  { key: 'iron', label: 'Iron', unit: 'mg' },
  { key: 'zinc', label: 'Zinc', unit: 'mg' },
  { key: 'selenium', label: 'Selenium', unit: 'mcg' },
  { key: 'choline', label: 'Choline', unit: 'mg' },
  { key: 'vitamin_a', label: 'Vitamin A', unit: 'mcg' },
  { key: 'vitamin_c', label: 'Vitamin C', unit: 'mg' },
  { key: 'vitamin_d', label: 'Vitamin D', unit: 'mcg' },
  { key: 'vitamin_e', label: 'Vitamin E', unit: 'mg' },
  { key: 'vitamin_k', label: 'Vitamin K', unit: 'mcg' },
  { key: 'b1', label: 'B1', unit: 'mg' },
  { key: 'b2', label: 'B2', unit: 'mg' },
  { key: 'b3', label: 'B3', unit: 'mg' },
  { key: 'b5', label: 'B5', unit: 'mg' },
  { key: 'b6', label: 'B6', unit: 'mg' },
  { key: 'b9', label: 'B9', unit: 'mcg' },
  { key: 'b12', label: 'B12', unit: 'mcg' },
] as const

type SavedFood = { food_nutrients?: NutrientRow | NutrientRow[] | null }
export type MicronutrientMeal = {
  grams?: NumericValue
  entry_state?: string | null
  foods?: SavedFood | SavedFood[] | null
}

export type MicronutrientUpperLimit = {
  amount?: NumericValue
  unit?: string | null
  applies_to_intake_source?: string | null
  nutrient_form?: string | null
  sex?: string | null
  pregnancy_status?: string | null
  min_age_years?: NumericValue
  max_age_years?: NumericValue
  nutrients?: { nutrient_key?: string | null } | Array<{ nutrient_key?: string | null }> | null
}

export type MicronutrientProgress = {
  key: string
  label: string
  unit: string
  consumed: number | null
  target: number | null
  percent: number | null
  ringPercent: number
  mealCount: number
  missingMealCount: number
  macroEntryCount: number
  upperLimit: number | null
  upperLimitExceeded: boolean
  state: 'empty' | 'unavailable' | 'incomplete' | 'known' | 'warning'
}

export function confirmedToxicityWarning(nutrientKey: string, insights: Array<{ nutrientKey: string; patternState: string; message: string }>) {
  // Generic inferred insights do not establish that a demographic/form/source-specific
  // upper limit applies to this food total. Match those with the reference helper above.
  return insights.find(insight => insight.nutrientKey === nutrientKey && insight.patternState === 'confirmed_toxicity')?.message
}

function numeric(value: unknown) {
  if ((typeof value !== 'number' && typeof value !== 'string') || (typeof value === 'string' && !value.trim())) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function first<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

function matchingFoodUpperLimit(
  references: MicronutrientUpperLimit[], key: string, unit: string, age: number | null,
) {
  const matching = references.filter(reference => {
    if (first(reference.nutrients)?.nutrient_key !== key || reference.unit !== unit) return false
    // Food logging cannot establish exposure to supplements or a specific chemical form.
    if (!['food', 'total'].includes(reference.applies_to_intake_source || '') || reference.nutrient_form) return false
    // Use only demographic contexts actually known here; never guess sex/pregnancy.
    if (reference.sex && reference.sex !== 'any') return false
    if (reference.pregnancy_status && !['any', 'not_applicable'].includes(reference.pregnancy_status)) return false
    const min = numeric(reference.min_age_years)
    const max = numeric(reference.max_age_years)
    if ((min !== null || max !== null) && age === null) return false
    if (age !== null && ((min !== null && age < min) || (max !== null && age > max))) return false
    return numeric(reference.amount) !== null
  }).map(reference => numeric(reference.amount)!)
  return matching.length ? Math.min(...matching) : null
}

export function calculateMicronutrientProgress({
  targets, meals, upperLimits = [], age = null, macroEntryCount = 0,
}: {
  targets: Record<string, unknown>
  meals: MicronutrientMeal[]
  upperLimits?: MicronutrientUpperLimit[]
  age?: number | null
  macroEntryCount?: number
}): MicronutrientProgress[] {
  const confirmed = meals.filter(meal => meal.entry_state === 'confirmed')
  const unknownEntries = Math.max(0, Math.floor(macroEntryCount))
  const intakeCount = confirmed.length + unknownEntries
  return trackedMicronutrients.map(nutrient => {
    const targetValue = numeric(targets[`${nutrient.key}_target_${nutrient.unit}`])
    const target = targetValue !== null && targetValue > 0 ? targetValue : null
    let knownTotal = 0
    let missingMealCount = unknownEntries
    for (const meal of confirmed) {
      const grams = numeric(meal.grams)
      const nutrients = first(first(meal.foods)?.food_nutrients)
      const amount = numeric(nutrients?.[`${nutrient.key}_${nutrient.unit}`])
      if (grams === null || grams <= 0 || amount === null) { missingMealCount++; continue }
      knownTotal += amount * grams / 100
    }
    const consumed = intakeCount > 0 && missingMealCount === intakeCount ? null : knownTotal
    const percent = intakeCount && consumed !== null && target !== null ? consumed / target * 100 : null
    const upperLimit = matchingFoodUpperLimit(upperLimits, nutrient.key, nutrient.unit, age)
    const upperLimitExceeded = consumed !== null && upperLimit !== null && consumed > upperLimit
    return {
      ...nutrient, consumed, target, percent, ringPercent: Math.min(100, Math.max(0, percent ?? 0)),
      mealCount: intakeCount, missingMealCount, macroEntryCount: unknownEntries, upperLimit, upperLimitExceeded,
      state: upperLimitExceeded ? 'warning' : !intakeCount ? 'empty' : consumed === null || target === null ? 'unavailable' : missingMealCount ? 'incomplete' : 'known',
    }
  })
}

// Read through existing RLS with the signed-in client. No cache is shared between accounts.
export async function loadMicronutrientProgress(supabase: any, nutritionLogId: string) {
  const fields = trackedMicronutrients.map(nutrient => `${nutrient.key}_${nutrient.unit}`).join(',')
  const [meals, references, macros] = await Promise.all([
    supabase.from('meal_entries')
      .select(`grams,entry_state,foods(food_nutrients(${fields}))`)
      .eq('nutrition_log_id', nutritionLogId).eq('entry_state', 'confirmed'),
    supabase.from('nutrient_reference_values')
      .select('amount,unit,applies_to_intake_source,nutrient_form,sex,pregnancy_status,min_age_years,max_age_years,nutrients(nutrient_key)')
      .eq('reference_type', 'ul'),
    supabase.from('macro_entries').select('calories,protein_g,carbs_g,fat_g').eq('nutrition_log_id', nutritionLogId),
  ])
  if (meals.error || macros.error) throw new Error('Saved micronutrient intake could not be loaded.')
  return {
    meals: (meals.data || []) as MicronutrientMeal[],
    upperLimits: (references.error ? [] : references.data || []) as MicronutrientUpperLimit[],
    upperLimitsAvailable: !references.error,
    macroEntryCount: (macros.data || []).filter((entry: NutrientRow) => ['calories','protein_g','carbs_g','fat_g'].some(key => (numeric(entry[key]) || 0) > 0)).length,
  }
}
