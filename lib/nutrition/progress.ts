type NumericValue = number | string | null | undefined
type MacroRow = Record<string, NumericValue>

export type RecordedMacroTotals = {
  calories: number
  protein: number
  carbs: number
  fats: number
}

export type RecordedNutrition = {
  total: RecordedMacroTotals
  byBlock: Record<string, RecordedMacroTotals>
  macroEntryCount: number
}

type NutritionMacroTargets = {
  calories?: NumericValue
  protein?: NumericValue
  carbs?: NumericValue
  fats?: NumericValue
}

type NutritionMacroRemaining = {
  calories_remaining?: number | null
  protein_remaining_g?: number | null
  carbs_remaining_g?: number | null
  fat_remaining_g?: number | null
}

function numeric(value: NumericValue) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function emptyTotals(): RecordedMacroTotals {
  return { calories: 0, protein: 0, carbs: 0, fats: 0 }
}

// nutrition_log_totals_by_block aggregates confirmed meal entries only.
// Macro entries are a separate recorded source and must be added exactly once.
export function calculateRecordedNutrition(
  confirmedMealTotals: MacroRow[] = [],
  macroEntries: MacroRow[] = [],
): RecordedNutrition {
  const total = emptyTotals()
  const byBlock: Record<string, RecordedMacroTotals> = {}
  function add(row: MacroRow, columns: Record<keyof RecordedMacroTotals, string>) {
    const savedBlock = String(row.day_block || 'other')
    const block = ['morning', 'midday', 'evening', 'other'].includes(savedBlock) ? savedBlock : 'other'
    const blockTotal = byBlock[block] ||= emptyTotals()
    let hasIntake = false
    for (const key of Object.keys(total) as Array<keyof RecordedMacroTotals>) {
      const value = Math.max(0, numeric(row[columns[key]]) ?? 0)
      total[key] += value
      blockTotal[key] += value
      if (value > 0) hasIntake = true
    }
    return hasIntake
  }
  for (const row of confirmedMealTotals) {
    add(row, { calories: 'calories_eaten', protein: 'protein_eaten_g', carbs: 'carbs_eaten_g', fats: 'fat_eaten_g' })
  }
  let macroEntryCount = 0
  for (const row of macroEntries) {
    if (add(row, { calories: 'calories', protein: 'protein_g', carbs: 'carbs_g', fats: 'fat_g' })) macroEntryCount++
  }
  return { total, byBlock, macroEntryCount }
}

export async function loadRecordedNutrition(supabase: any, nutritionLogId: string): Promise<RecordedNutrition> {
  const [meals, macros] = await Promise.all([
    supabase.from('nutrition_log_totals_by_block').select('*').eq('nutrition_log_id', nutritionLogId),
    supabase.from('macro_entries').select('calories,protein_g,carbs_g,fat_g,day_block').eq('nutrition_log_id', nutritionLogId),
  ])
  if (meals.error || macros.error) throw new Error('Saved nutrition progress could not be loaded.')
  return calculateRecordedNutrition(meals.data || [], macros.data || [])
}

export function nutritionRemainingWithRecordedIntake<T extends NutritionMacroRemaining>(
  targets: NutritionMacroTargets,
  remaining: T | null,
  recorded: RecordedNutrition,
) {
  function value(target: NumericValue, consumed: number, fallback?: number | null) {
    const amount = numeric(target)
    return amount === null ? fallback ?? null : amount - consumed
  }
  // Recompute from targets and recorded sources, rather than subtracting again
  // from a prior combined response. Micronutrient fields stay with the meal view.
  return {
    ...remaining,
    calories_remaining: value(targets.calories, recorded.total.calories, remaining?.calories_remaining),
    protein_remaining_g: value(targets.protein, recorded.total.protein, remaining?.protein_remaining_g),
    carbs_remaining_g: value(targets.carbs, recorded.total.carbs, remaining?.carbs_remaining_g),
    fat_remaining_g: value(targets.fats, recorded.total.fats, remaining?.fat_remaining_g),
  }
}
