import { NUTRITION_INTELLIGENCE_CONFIG } from '@/lib/nutrition/intelligenceConfig'

export type RecurringMealOccurrence = {
  date: string
  weekday: number
}

export type RecurringMealPatternType = 'daily' | 'weekday_specific' | 'not_enough_data'

export type RecurringMealPattern = {
  patternType: RecurringMealPatternType
  occurrenceDays: number
  daysOfWeek: number[]
  eligibleForSuggestion: boolean
  eligibleForAutomaticPrelog: boolean
}

export function classifyRecurringMealPattern(
  occurrences: RecurringMealOccurrence[],
  config = NUTRITION_INTELLIGENCE_CONFIG.recurringMeals,
): RecurringMealPattern {
  const uniqueDays = new Map<string, number>()
  for (const occurrence of occurrences) {
    if (!occurrence.date) continue
    uniqueDays.set(occurrence.date, occurrence.weekday)
  }

  const weekdays = Array.from(uniqueDays.values())
  const occurrenceDays = uniqueDays.size
  const counts = weekdays.reduce<Record<number, number>>((map, day) => {
    map[day] = (map[day] || 0) + 1
    return map
  }, {})
  const dominant = Object.entries(counts)
    .map(([day, count]) => ({ day: Number(day), count }))
    .sort((a, b) => b.count - a.count)[0]

  let patternType: RecurringMealPatternType = 'not_enough_data'
  let daysOfWeek = Array.from(new Set(weekdays)).sort()

  if (occurrenceDays >= config.suggestionMinimumDays) {
    patternType = 'daily'
    if (
      dominant &&
      dominant.count >= config.weekdayPatternMinimumOccurrences &&
      dominant.count / occurrenceDays >= config.weekdayDominanceRatio
    ) {
      patternType = 'weekday_specific'
      daysOfWeek = [dominant.day]
    }
  }

  return {
    patternType,
    occurrenceDays,
    daysOfWeek,
    eligibleForSuggestion: occurrenceDays >= config.suggestionMinimumDays,
    eligibleForAutomaticPrelog: occurrenceDays >= config.automaticPrelogMinimumDays,
  }
}
