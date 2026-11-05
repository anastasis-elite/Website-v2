import type { ScheduleEvent } from './types'
export const healthEventTypes = new Set(['workout','meal','hydration','recovery','check_in','assessment','sleep'])
/** A breakfast self-report belongs to the schedule, never to nutrition logs.
 * Only the server's own local-day projection can opt a meal into this flow. */
export function canRespondToScheduleEvent(event: ScheduleEvent) {
  return !healthEventTypes.has(event.event_type) || (
    event.schedule_response_kind === 'breakfast' && event.event_type === 'meal' &&
    event.source === 'program' && event.virtual === true &&
    event.id === `virtual-breakfast-${event.schedule_date}` &&
    !event.calendar_event_id && !event.external_event_id && !event.external_calendar_source
  )
}
export function scheduleConflict(events: ScheduleEvent[], id: string, start: Date, end: Date, transitionMinutes = 0) {
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) return 'Choose a valid start and end.'
  const buffer = transitionMinutes * 60000
  const conflict = events.find(e => e.id !== id && !e.suggested && e.busy !== false && !['skipped','cancelled'].includes(e.status) &&
    start.getTime() < new Date(e.adjusted_end_at || e.end_at).getTime() + buffer &&
    end.getTime() > new Date(e.adjusted_start_at || e.start_at).getTime() - buffer)
  return conflict ? `This overlaps ${conflict.title} or its transition buffer. Choose another time.` : null
}
