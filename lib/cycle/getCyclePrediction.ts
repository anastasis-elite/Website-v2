export type CyclePrediction = {
  hasEnoughHistory: boolean
  estimatedNextPeriodStart: string | null
  averageCycleLength: number | null
  recentCycleLengths: number[]
  daysUntilExpectedPeriod: number | null
  confidence: 'low' | 'moderate' | 'higher'
  note: string
}

function dateOnly(date: Date) {
  return date.toISOString().split('T')[0]
}

function normalizeDate(value: unknown): string | null {
  if (!value) {
    return null
  }

  const rawValue = String(value)
  const parsedDate = new Date(
    rawValue.includes('T')
      ? rawValue
      : `${rawValue}T00:00:00`,
  )

  if (Number.isNaN(parsedDate.getTime())) {
    return null
  }

  return dateOnly(parsedDate)
}

function daysBetween(start: string, end: string) {
  const startDate = new Date(`${start}T00:00:00`)
  const endDate = new Date(`${end}T00:00:00`)
  const msPerDay = 1000 * 60 * 60 * 24

  return Math.round(
    (endDate.getTime() - startDate.getTime()) /
      msPerDay,
  )
}

function addDays(dateString: string, days: number) {
  const date = new Date(`${dateString}T00:00:00`)
  date.setDate(date.getDate() + days)

  return dateOnly(date)
}

export function getCyclePrediction({
  periodStartLogs,
  fallbackLastPeriodStart,
  fallbackAverageCycleLength = 28,
}: {
  periodStartLogs: any[]
  fallbackLastPeriodStart?: string | null
  fallbackAverageCycleLength?: number
}): CyclePrediction {
  const allPeriodStarts = Array.from(
    new Set(
      periodStartLogs
        .map(
          (log) =>
            log?.log_date ??
            log?.period_start_date ??
            log?.start_date,
        )
        .map(normalizeDate)
        .filter(
          (value): value is string =>
            Boolean(value),
        ),
    ),
  ).sort(
    (a, b) =>
      new Date(`${a}T00:00:00`).getTime() -
      new Date(`${b}T00:00:00`).getTime(),
  )

  const cycleLengths: number[] = []

  for (
    let index = 1;
    index < allPeriodStarts.length;
    index += 1
  ) {
    const previousStart =
      allPeriodStarts[index - 1]
    const currentStart =
      allPeriodStarts[index]

    const cycleLength = daysBetween(
      previousStart,
      currentStart,
    )

    if (
      cycleLength >= 18 &&
      cycleLength <= 60
    ) {
      cycleLengths.push(cycleLength)
    }
  }

  const hasEnoughHistory =
    cycleLengths.length >= 3

  const validFallbackAverage =
    Number.isFinite(fallbackAverageCycleLength) &&
    fallbackAverageCycleLength >= 18 &&
    fallbackAverageCycleLength <= 60
      ? Math.round(fallbackAverageCycleLength)
      : 28

  const averageCycleLength =
    cycleLengths.length > 0
      ? Math.round(
          cycleLengths.reduce(
            (sum, length) => sum + length,
            0,
          ) / cycleLengths.length,
        )
      : validFallbackAverage

  const normalizedFallbackLastPeriodStart =
    normalizeDate(fallbackLastPeriodStart)

  const lastPeriodStart =
    allPeriodStarts[
      allPeriodStarts.length - 1
    ] ??
    normalizedFallbackLastPeriodStart ??
    null

  if (!lastPeriodStart) {
    return {
      hasEnoughHistory: false,
      estimatedNextPeriodStart: null,
      averageCycleLength: null,
      recentCycleLengths: [],
      daysUntilExpectedPeriod: null,
      confidence: 'low',
      note:
        'There is not enough cycle history yet to estimate the next period start.',
    }
  }

  const estimatedNextPeriodStart =
    addDays(
      lastPeriodStart,
      averageCycleLength,
    )

  const today = dateOnly(new Date())

  const daysUntilExpectedPeriod =
    daysBetween(
      today,
      estimatedNextPeriodStart,
    )

  const confidence = hasEnoughHistory
    ? 'higher'
    : cycleLengths.length >= 1
      ? 'moderate'
      : 'low'

  return {
    hasEnoughHistory,
    estimatedNextPeriodStart,
    averageCycleLength,
    recentCycleLengths: cycleLengths,
    daysUntilExpectedPeriod,
    confidence,
    note: hasEnoughHistory
      ? `This estimate is based on all ${cycleLengths.length} valid logged cycle intervals.`
      : cycleLengths.length >= 1
        ? `This estimate is based on ${cycleLengths.length} valid logged cycle interval${
            cycleLengths.length === 1
              ? ''
              : 's'
          } and may adjust as more periods are logged.`
        : `This estimate is using the saved average cycle length until enough period history is available.`,
  }
}
