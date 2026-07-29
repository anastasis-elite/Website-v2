import type {
  CapacityHistoryResult,
  CapacityHistoryTrigger,
  HistoricalRecoverySignal,
} from './types'

const MS_PER_DAY = 86_400_000

const STANDARD_RESULT: CapacityHistoryResult = {
  level: 'standard',
  workoutDayMode: 'standard',
  exerciseTarget: 12,
  recoveryTarget: 1,
  triggers: [],
  completeDays: 0,
  historyComplete: false,
}

function parseDateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }

  return date
}

function formatDateOnly(date: Date) {
  return date.toISOString().slice(0, 10)
}

function previousDate(date: Date, offset: number) {
  return formatDateOnly(new Date(date.getTime() - offset * MS_PER_DAY))
}

export function evaluateCapacityHistory(
  history: HistoricalRecoverySignal[]
): CapacityHistoryResult {
  if (!history.length) return { ...STANDARD_RESULT }

  const rowsByDate = new Map<string, HistoricalRecoverySignal>()
  for (const row of history) rowsByDate.set(row.date, row)

  const latestDate = history
    .map((row) => parseDateOnly(row.date))
    .filter((date): date is Date => date !== null)
    .sort((a, b) => b.getTime() - a.getTime())[0]

  if (!latestDate) return { ...STANDARD_RESULT }

  const requiredDates = [0, 1, 2].map((offset) => previousDate(latestDate, offset))
  const requiredRows = requiredDates.map((date) => rowsByDate.get(date) || null)
  const completedRows = requiredRows.filter(
    (row): row is HistoricalRecoverySignal => Boolean(row?.checkInCompleted)
  )
  const historyComplete = completedRows.length === 3

  if (!historyComplete) {
    return {
      ...STANDARD_RESULT,
      completeDays: completedRows.length,
      historyComplete: false,
    }
  }

  const triggers: CapacityHistoryTrigger[] = []
  if (completedRows.every((row) => row.sleepHours !== null && row.sleepHours < 5)) {
    triggers.push('three_days_low_sleep')
  }
  if (completedRows.every((row) => row.stress !== null && row.stress > 8)) {
    triggers.push('three_days_high_stress')
  }
  if (completedRows.every((row) => row.energy !== null && row.energy < 5)) {
    triggers.push('three_days_low_energy')
  }

  if (!triggers.length) {
    return {
      ...STANDARD_RESULT,
      completeDays: 3,
      historyComplete: true,
    }
  }

  return {
    level: 'low',
    workoutDayMode: 'low_capacity',
    exerciseTarget: 3,
    recoveryTarget: 3,
    triggers,
    completeDays: 3,
    historyComplete: true,
  }
}
