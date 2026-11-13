/** Final suggestion policy. Never call this on recorded or user-entered loads.
 * Pounds are the equipment grid; kg is only a display/input conversion.
 * A dumbbell total is deliberately NOT divided into guessed per-hand loads.
 */
export const SUGGESTED_LOAD_ROUNDING = 'equipment-v1'
const LB_PER_KG = 2.2046226218
export function weightIncrementLb(exercise: any, weightLb: number): number {
  const matches = Array.isArray(exercise?.available_variants)
    ? exercise.available_variants.filter((v: any) => v.id === exercise.selected_variant_id) : []
  const selected = matches.length === 1 ? matches[0] : null
  const equipment = String(selected?.equipment ?? exercise?.selected_equipment ?? exercise?.equipment ?? '').toLowerCase()
  const loadType = selected?.load_type ?? exercise?.load_type
  return equipment === 'dumbbell' && ['per_hand', 'single_side'].includes(loadType) && weightLb <= 15 ? 2.5 : 5
}
export function roundSuggestedWeightLb(exercise: any, weightLb: number): number {
  if (!Number.isFinite(weightLb) || weightLb <= 0) return 0
  const increment = weightIncrementLb(exercise, weightLb)
  return Math.round(weightLb / increment) * increment
}
export function weightInputIncrement(exercise: any, weight: number, unit: 'lb' | 'kg' = 'lb'): number {
  const increment = weightIncrementLb(exercise, unit === 'kg' ? weight * LB_PER_KG : weight)
  // The tracker displays one decimal place in kg. Match that input precision.
  return unit === 'kg' ? Math.round(increment / LB_PER_KG * 10) / 10 : increment
}
