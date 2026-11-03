import 'server-only'
import { getStrengthAssessmentStatus } from './getStrengthAssessmentStatus'
import { projectStrengthWorkout } from './strengthWorkout'
import { getClientLocalDate } from '@/lib/timezone'
import { membershipCan } from '@/lib/membership/policy'

export async function strengthCalendarEvents({ supabase, user, client, start, end, now = new Date(), events = [] }: {
  supabase: any; user: { id: string }; client: any; start: string; end: string; now?: Date; events?: any[] | Promise<any[]>
}) {
  if (!client || client.auth_user_id !== user.id || !membershipCan(client, 'generatedCoaching', now)) return events
  const [status, existing] = await Promise.all([getStrengthAssessmentStatus(supabase, client, now), events])
  if (status.unavailable) throw new Error('Strength assessment scheduling is unavailable.')
  const dates = new Set([status.scheduledDate, status.completedToday ? getClientLocalDate(client, now) : null].filter((date): date is string => Boolean(date)))
  let projected = existing
  for (const date of dates) projected = projectStrengthWorkout({ status, userId: user.id, client, date, events: projected, now })
  return projected
    .filter(event => Date.parse(event.start_at) < Date.parse(end) && Date.parse(event.end_at) > Date.parse(start))
    .map(event => event.title === 'Strength assessment' && event.virtual &&
      (event.action_route === status.href || event.action_route === status.workoutHref)
      ? { ...event, calendar_id: null, location: '', recurrence: [], reminders: [],
        source_label: 'Anastasis · Strength assessment', writable: false, etag: status.latestCompletedAt || status.period, legacy: true }
      : event)
}
