import { addCalendarMonths } from '@/lib/body-assessment/schedule'
import { addLocalDays, getClientLocalDate } from '@/lib/timezone'

// Use the same end-of-month clamping as the existing assessment calendar.
// Storage periods remain monthly identifiers; they are not reassessment dates.
export function strengthCadence(client: any, completedAt: string | null, now = new Date(), mondayCompleted = false) {
  const today = getClientLocalDate(client, now)
  if (!completedAt) return { eligibleDate: null, monday: null, scheduledDate: today, eligible: true, isWorkoutDay: true, completedToday: false, completedDate: null }
  const completedDate = getClientLocalDate(client, new Date(completedAt))
  const eligibleDate = addCalendarMonths(completedDate, 3)
  const weekday = new Date(`${eligibleDate}T12:00:00Z`).getUTCDay()
  const monday = addLocalDays(eligibleDate, (8 - weekday) % 7)
  const scheduledDate = mondayCompleted ? addLocalDays(monday, 1) : monday
  return { eligibleDate, monday, scheduledDate, eligible: today >= eligibleDate,
    isWorkoutDay: today === scheduledDate, completedToday: today === completedDate, completedDate }
}
