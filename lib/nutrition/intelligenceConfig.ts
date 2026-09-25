export const NUTRITION_INTELLIGENCE_CONFIG = {
  nutrientGap: {
    lookbackDays: 14,
    minimumEligibleDays: 10,
    lowIntakeRatio: 0.75,
    minimumLowDays: 7,
    minimumCompleteness: 0.68,
  },
  recurringMeals: {
    suggestionMinimumDays: 4,
    automaticPrelogMinimumDays: 14,
    weekdayPatternMinimumOccurrences: 3,
    weekdayDominanceRatio: 0.7,
  },
  hydration: {
    defaultWakeTime: '07:00',
    defaultBedTime: '22:30',
    aheadTolerance: 12,
    onPaceTolerance: 10,
    slightlyBehindTolerance: 25,
  },
} as const
