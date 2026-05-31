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

function daysBetween(start: string, end: string) {
  const startDate = new Date(`${start}T00:00:00`)
  const endDate = new Date(`${end}T00:00:00`)
  const msPerDay = 1000 * 60 * 60 * 24

  return Math.round((endDate.getTime() - startDate.getTime()) / msPerDay)
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
  const sortedStarts = periodStartLogs
    .map((log) => log.log_date || log.period_start_date)
    .filter(Boolean)
    .map(String)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())

  const recentStarts = sortedStarts.slice(-6)

  const recentCycleLengths: number[] = []

  for (let i = 1; i < recentStarts.length; i++) {
    const length = daysBetween(recentStarts[i - 1], recentStarts[i])

    if (length >= 18 && length <= 60) {
      recentCycleLengths.push(length)
    }
  }

  const hasEnoughHistory = recentCycleLengths.length >= 3

  const averageCycleLength = recentCycleLengths.length
    ? Math.round(
        recentCycleLengths.reduce((sum, length) => sum + length, 0) /
          recentCycleLengths.length
      )
    : fallbackAverageCycleLength

  const lastPeriodStart =
    recentStarts[recentStarts.length - 1] || fallbackLastPeriodStart || null

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

  const estimatedNextPeriodStart = addDays(lastPeriodStart, averageCycleLength)

  const today = dateOnly(new Date())
  const daysUntilExpectedPeriod = daysBetween(today, estimatedNextPeriodStart)

  const confidence = hasEnoughHistory
    ? 'higher'
    : recentCycleLengths.length >= 1
    ? 'moderate'
    : 'low'

  return {
    hasEnoughHistory,
    estimatedNextPeriodStart,
    averageCycleLength,
    recentCycleLengths,
    daysUntilExpectedPeriod,
    confidence,
    note: hasEnoughHistory
      ? `This estimate is based on your recent cycle history.`
      : `This estimate is based on limited history and may adjust as more cycles are logged.`,
  }
}
