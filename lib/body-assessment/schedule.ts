export type BodyAssessmentSessionStatus = 'draft' | 'completed' | 'abandoned'
export type BodyAssessmentDueKind = 'none' | 'monthly' | 'structural' | 'full'

export type BodyAssessmentScheduleInput = {
  today: string
  latestMonthlyCompletedAt?: string | null
  latestStructuralCompletedAt?: string | null
  activeSession?: {
    id: string
    assessment_type: string
    status: BodyAssessmentSessionStatus | string
    started_at?: string | null
  } | null
}

export type BodyAssessmentScheduleStatus = {
  dueKind: BodyAssessmentDueKind
  monthlyDue: boolean
  structuralDue: boolean
  inProgress: boolean
  title: string
  actionLabel: string
  href: string
  nextMonthlyDueDate: string
  nextStructuralDueDate: string
  daysUntilNext: number
}

function dateOnly(value: string) {
  return value.slice(0, 10)
}

export function addCalendarMonths(date: string, months: number) {
  const [year, month, day] = dateOnly(date).split('-').map(Number)
  const next = new Date(Date.UTC(year, month - 1, day))
  const originalDay = next.getUTCDate()

  next.setUTCMonth(next.getUTCMonth() + months)

  if (next.getUTCDate() !== originalDay) {
    next.setUTCDate(0)
  }

  return next.toISOString().slice(0, 10)
}

function daysBetween(start: string, end: string) {
  const startDate = new Date(`${dateOnly(start)}T00:00:00.000Z`)
  const endDate = new Date(`${dateOnly(end)}T00:00:00.000Z`)
  return Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000)
}

function nextDueDate(latestCompletedAt: string | null | undefined, today: string, cadenceMonths: number) {
  return latestCompletedAt ? addCalendarMonths(latestCompletedAt, cadenceMonths) : today
}

export function getBodyAssessmentScheduleStatus({
  today,
  latestMonthlyCompletedAt,
  latestStructuralCompletedAt,
  activeSession,
}: BodyAssessmentScheduleInput): BodyAssessmentScheduleStatus {
  const nextMonthlyDueDate = nextDueDate(latestMonthlyCompletedAt, today, 1)
  const nextStructuralDueDate = nextDueDate(latestStructuralCompletedAt, today, 9)
  const monthlyDue = nextMonthlyDueDate <= today
  const structuralDue = nextStructuralDueDate <= today
  const inProgress = activeSession?.status === 'draft'
  const dueKind: BodyAssessmentDueKind =
    monthlyDue && structuralDue ? 'full' : structuralDue ? 'structural' : monthlyDue ? 'monthly' : 'none'

  const nextDue = nextMonthlyDueDate < nextStructuralDueDate ? nextMonthlyDueDate : nextStructuralDueDate
  const daysUntilNext = Math.max(0, daysBetween(today, nextDue))

  if (inProgress) {
    return {
      dueKind,
      monthlyDue,
      structuralDue,
      inProgress,
      title: 'Body Assessment In Progress',
      actionLabel: 'Continue',
      href: '/dashboard/assessment/measurements',
      nextMonthlyDueDate,
      nextStructuralDueDate,
      daysUntilNext,
    }
  }

  const title =
    dueKind === 'full'
      ? 'Full Body Assessment Due'
      : dueKind === 'structural'
        ? 'Body Measurements Due'
        : dueKind === 'monthly'
          ? 'Monthly Body Assessment Due'
          : 'Body Assessment'

  return {
    dueKind,
    monthlyDue,
    structuralDue,
    inProgress,
    title,
    actionLabel: dueKind === 'none' ? 'Review' : 'Start',
    href: '/dashboard/assessment/measurements',
    nextMonthlyDueDate,
    nextStructuralDueDate,
    daysUntilNext,
  }
}
