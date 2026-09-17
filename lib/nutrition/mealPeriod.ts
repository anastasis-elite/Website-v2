export type MealPeriod =
  | 'Wake Up'
  | 'Breakfast'
  | 'Brunch'
  | 'Lunch'
  | 'Snack'
  | 'Dinner'
  | 'Pre-Bed'
  | 'Other'

export type DayBlock = 'morning' | 'midday' | 'evening' | 'other'

export const mealPeriods: MealPeriod[] = [
  'Wake Up',
  'Breakfast',
  'Brunch',
  'Lunch',
  'Snack',
  'Dinner',
  'Pre-Bed',
  'Other',
]

export function getMealPeriodForLocalDate(date = new Date()): MealPeriod {
  const minutes = date.getHours() * 60 + date.getMinutes()

  if (minutes >= 4 * 60 && minutes <= 5 * 60 + 59) return 'Wake Up'
  if (minutes >= 6 * 60 && minutes <= 9 * 60 + 29) return 'Breakfast'
  if (minutes >= 9 * 60 + 30 && minutes <= 10 * 60 + 59) return 'Brunch'
  if (minutes >= 11 * 60 && minutes <= 13 * 60 + 29) return 'Lunch'
  if (minutes >= 13 * 60 + 30 && minutes <= 16 * 60 + 29) return 'Snack'
  if (minutes >= 16 * 60 + 30 && minutes <= 18 * 60 + 59) return 'Dinner'
  if (minutes >= 19 * 60 && minutes <= 22 * 60) return 'Pre-Bed'

  return 'Other'
}

export function normalizeMealPeriod(value: unknown): MealPeriod {
  const normalized = String(value || '').trim().toLowerCase()
  return mealPeriods.find((period) => period.toLowerCase() === normalized) || 'Other'
}

export function mealPeriodToDayBlock(period: MealPeriod): DayBlock {
  if (period === 'Wake Up' || period === 'Breakfast' || period === 'Brunch') return 'morning'
  if (period === 'Lunch' || period === 'Snack') return 'midday'
  if (period === 'Dinner' || period === 'Pre-Bed') return 'evening'
  return 'other'
}
