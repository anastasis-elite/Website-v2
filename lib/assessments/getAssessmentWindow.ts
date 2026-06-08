type AssessmentWindowStatus = 'open' | 'upcoming' | 'unknown'

type AssessmentWindow = {
  status: AssessmentWindowStatus
  windowType: 'ovulatory_best_guess'
  estimatedStartDate: string | null
  estimatedEndDate: string | null
  daysUntilStart: number | null
  daysUntilEnd: number | null
  isOpen: boolean
  isUpcoming: boolean
  message: string
}

function toDateOnly(date: Date) {
  return date.toISOString().split('T')[0]
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function differenceInCalendarDays(a: Date, b: Date) {
  const dateA = new Date(a.getFullYear(), a.getMonth(), a.getDate())
  const dateB = new Date(b.getFullYear(), b.getMonth(), b.getDate())

  return Math.round(
    (dateA.getTime() - dateB.getTime()) / (1000 * 60 * 60 * 24)
  )
}

export function getAssessmentWindow(client: any): AssessmentWindow {
  const today = new Date()

  const lastPeriodStart = client?.last_period_start
    ? new Date(client.last_period_start)
    : null

  const averageCycleLength = Number(client?.average_cycle_length || 28)

  if (!lastPeriodStart || !Number.isFinite(averageCycleLength)) {
    return {
      status: 'unknown',
      windowType: 'ovulatory_best_guess',
      estimatedStartDate: null,
      estimatedEndDate: null,
      daysUntilStart: null,
      daysUntilEnd: null,
      isOpen: false,
      isUpcoming: false,
      message:
        'Enter what you know about your cycle and the system will estimate the best assessment window over time.',
    }
  }

  const estimatedOvulationOffset = Math.max(10, averageCycleLength - 14)

  const estimatedOvulationDate = addDays(
    lastPeriodStart,
    estimatedOvulationOffset
  )

  const estimatedStart = addDays(estimatedOvulationDate, -2)
  const estimatedEnd = addDays(estimatedOvulationDate, 2)

  const daysUntilStart = differenceInCalendarDays(estimatedStart, today)
  const daysUntilEnd = differenceInCalendarDays(estimatedEnd, today)

  const isOpen = today >= estimatedStart && today <= estimatedEnd
  const isUpcoming = daysUntilStart > 0

  if (isOpen) {
    return {
      status: 'open',
      windowType: 'ovulatory_best_guess',
      estimatedStartDate: toDateOnly(estimatedStart),
      estimatedEndDate: toDateOnly(estimatedEnd),
      daysUntilStart,
      daysUntilEnd,
      isOpen: true,
      isUpcoming: false,
      message:
        'Your estimated assessment window is open. Add what you can this week — the system will keep refining as you live your normal routine.',
    }
  }

  return {
    status: 'upcoming',
    windowType: 'ovulatory_best_guess',
    estimatedStartDate: toDateOnly(estimatedStart),
    estimatedEndDate: toDateOnly(estimatedEnd),
    daysUntilStart,
    daysUntilEnd,
    isOpen: false,
    isUpcoming,
    message:
      daysUntilStart > 0
        ? `Your next estimated assessment window opens in ${daysUntilStart} day${
            daysUntilStart === 1 ? '' : 's'
          }. You can still add information now, but that window may give cleaner comparison data.`
        : 'Your estimated assessment window has passed for this cycle. You can still update your assessment now, or wait for the next best-estimate window.',
  }
}
