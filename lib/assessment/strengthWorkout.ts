import 'server-only'

import type { StrengthAssessmentStatus } from './getStrengthAssessmentStatus'
import type { ScheduleEvent } from '@/lib/schedule/types'
import { dailyPlanToScheduleEvents } from '@/lib/schedule/dailyPlanAdapter'
import { getClientDayRange } from '@/lib/schedule/time'
import { getClientLocalDate } from '@/lib/timezone'

export function strengthCompletionForDay(status: StrengthAssessmentStatus | undefined, client: any, date: string, now = new Date()) {
  const timestamp = status?.latestCompletedAt
  return Boolean(status && !status.unavailable && status.completedToday && timestamp && Number.isFinite(Date.parse(timestamp)) &&
    Date.parse(timestamp) <= now.getTime() && getClientLocalDate(client, new Date(timestamp)) === date)
}

// Read-only projection into the existing workout slot. Fixed commitments,
// saved moves/skips, transition buffers and the Schedule conflict engine retain
// their existing behavior. No workout/assessment/history record is written.
export function projectStrengthWorkout({ status, userId, client, date, events, now = new Date() }: {
  status: StrengthAssessmentStatus | undefined; userId: string; client: any; date: string; events: ScheduleEvent[]; now?: Date
}): ScheduleEvent[] {
  if (!status || status.unavailable) return events
  const completed = strengthCompletionForDay(status, client, date, now)
  if (!completed && !(status.scheduledDate === date && (!status.eligibleDate || status.eligibleDate <= date))) return events
  const day = getClientDayRange(client, date)
  const workouts = events.filter(event => event.user_id === userId && event.client_id === client.client_id &&
    getClientLocalDate(client, new Date(event.adjusted_start_at || event.start_at)) === date &&
    event.event_type === 'workout' && !event.calendar_event_id &&
    !event.external_event_id && ['program', 'anastasis', 'system'].includes(event.source) && !['completed', 'cancelled'].includes(event.status))
  const template = workouts[0] || dailyPlanToScheduleEvents({ userId, client, dailyPlan: { date, timezone: day.timezone, timing: {} } })
    .find(event => event.event_type === 'workout')
  const fallback: ScheduleEvent = {
    id: `strength-workout-${date}`, user_id: userId, client_id: client.client_id,
    event_type: 'workout', source: 'program', start_at: day.start.toISOString(), end_at: day.end.toISOString(),
    timezone: day.timezone, all_day: true, busy: false, status: 'scheduled', completed_at: null,
    flexibility_type: 'flexible', priority: 'high', required: false, movable: false, approval_required: false,
    earliest_start_at: null, latest_end_at: null, preferred_time: null, estimated_duration_minutes: null,
    external_provider_name: null, external_contact_type: null, external_contact_value: null,
    external_event_id: null, external_calendar_source: null, reschedule_allowed: false,
    reschedule_requires_approval: false, last_reschedule_requested_at: null, delegation_status: null,
    delegation_notes: null, adaptive_reason: null, adjusted_start_at: null, adjusted_end_at: null, adjusted_duration_minutes: null,
    title: 'Strength assessment', description: 'Your eligible strength assessment takes the place of this day’s workout.',
  }
  let event: ScheduleEvent = {
    ...fallback, ...template,
    title: fallback.title, description: fallback.description,
    action_route: completed ? status.href : status.workoutHref || status.href, virtual: true,
    suggested: !completed && (template?.suggested ?? (template ? template.virtual === true : true)) && !template?.adjusted_start_at,
    ...(completed ? { status: 'completed', completed_at: status.latestCompletedAt! } : {}),
  }
  // This is a read-only assessment overlay, including when it borrows a saved
  // workout's slot/ID. Keep its mutations on the existing owner-bound plan/CAS
  // route, and consume that route's outcomes here for both kinds of template.
  const override = client.onboarding_data?.scheduleOverrides?.[event.id]
  if (!completed && event.flexibility_type === 'flexible' && !event.approval_required && override) {
    if (override.status === 'skipped') event = { ...event, status: 'skipped', completed_at: null }
    else if (event.movable && override.status === 'scheduled' && override.suggested === false &&
      typeof override.adjusted_start_at === 'string' && typeof override.adjusted_end_at === 'string') {
      const start = new Date(override.adjusted_start_at), end = new Date(override.adjusted_end_at)
      if (Number.isFinite(start.getTime()) && end > start && getClientLocalDate(client, start) === date) {
        event = { ...event, adjusted_start_at: start.toISOString(), adjusted_end_at: end.toISOString(),
          adjusted_duration_minutes: Math.round((end.getTime() - start.getTime()) / 60000),
          status: 'scheduled', suggested: false, adaptive_reason: 'Time confirmed by you.' }
      }
    }
  }
  // A confirmed timed slot occupies time just like the workout slot it uses.
  // Only the genuinely untimed all-day fallback is nonblocking.
  event.busy = !event.all_day && Date.parse(event.adjusted_end_at || event.end_at) > Date.parse(event.adjusted_start_at || event.start_at)
  return [...events.filter(event => !workouts.includes(event)), event]
}
