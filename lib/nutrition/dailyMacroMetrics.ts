type NumericValue = number | string | null | undefined

type Targets = { calories?: NumericValue; protein?: NumericValue; carbs?: NumericValue; fats?: NumericValue }
type Remaining = {
  calories_remaining?: NumericValue
  protein_remaining_g?: NumericValue
  carbs_remaining_g?: NumericValue
  fat_remaining_g?: NumericValue
}

function numeric(value: NumericValue) {
  if (value == null || String(value).trim() === '') return null
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : null
}

// Remaining already includes confirmed meals and manual macro entries. Keep
// unavailable values distinct from a confirmed zero and retain over-target intake.
export function buildDailyMacroMetrics(targets: Targets | null, remaining: Remaining | null) {
  return ([
    ['Calories', targets?.calories, remaining?.calories_remaining, 'cal'],
    ['Protein', targets?.protein, remaining?.protein_remaining_g, 'g'],
    ['Carbohydrates', targets?.carbs, remaining?.carbs_remaining_g, 'g'],
    ['Fat', targets?.fats, remaining?.fat_remaining_g, 'g'],
  ] as const).map(([label, rawTarget, rawRemaining, unit]) => {
    const amount = numeric(rawTarget)
    const target = amount !== null && amount >= 0 ? amount : null
    const left = numeric(rawRemaining)
    const consumed = target !== null && left !== null ? Math.max(0, target - left) : null
    const percent = consumed === null || target === null ? null
      : target > 0 ? Math.max(0, Math.min(100, Math.round(consumed / target * 100))) : 0
    return { label, target, remaining: left, consumed, percent, unit }
  })
}
