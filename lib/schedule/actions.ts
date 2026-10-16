import type { ScheduleEvent } from './types'
export const healthEventTypes = new Set(['workout','meal','hydration','recovery','check_in','assessment','sleep'])
export function scheduleEventVersion(event: ScheduleEvent) {
  return JSON.stringify([event.status, event.updated_at || null, event.adjusted_start_at || null, event.adjusted_end_at || null])
}

export function isInformationalScheduleEvent(event: ScheduleEvent) {
  return Boolean(event.calendar_event_id || event.source === 'external_calendar' || event.external_event_id || event.external_calendar_source)
}

/** Recording an outcome does not change a fixed commitment's time. */
export function getScheduleEventCapabilities(event: ScheduleEvent) {
  const isInformational = isInformationalScheduleEvent(event)
  const unresolved = !['completed', 'skipped', 'cancelled'].includes(event.status) && !event.dismissed_from_today
  return {
    isInformational,
    canComplete: unresolved && !isInformational && !healthEventTypes.has(event.event_type),
    canSkip: unresolved && !isInformational && (!healthEventTypes.has(event.event_type) ||
      (!event.required && event.flexibility_type === 'flexible' && !event.approval_required)),
    canReschedule: unresolved && !isInformational && event.flexibility_type === 'flexible' && event.movable &&
      !event.approval_required && !event.reschedule_requires_approval && event.reschedule_allowed !== false,
    canDismiss: unresolved && isInformational,
  }
}

export function applyScheduleEventOverride(event: ScheduleEvent, value: unknown): ScheduleEvent {
  if (!value || typeof value !== 'object' || ['completed', 'skipped', 'cancelled'].includes(event.status)) return event
  const override = value as Partial<ScheduleEvent>
  const capabilities = getScheduleEventCapabilities(event)
  if (override.status === 'completed' && capabilities.canComplete) {
    return { ...event, status: 'completed', completed_at: override.completed_at || null, updated_at: override.updated_at }
  }
  if (override.status === 'skipped' && capabilities.canSkip) {
    return { ...event, status: 'skipped', completed_at: null, updated_at: override.updated_at }
  }
  if (override.status === 'scheduled' && capabilities.canReschedule && override.adjusted_start_at && override.adjusted_end_at &&
    Number.isFinite(Date.parse(override.adjusted_start_at)) && Date.parse(override.adjusted_end_at) > Date.parse(override.adjusted_start_at)) {
    return { ...event, adjusted_start_at: override.adjusted_start_at, adjusted_end_at: override.adjusted_end_at,
      adjusted_duration_minutes: (Date.parse(override.adjusted_end_at) - Date.parse(override.adjusted_start_at)) / 60000,
      status: 'scheduled', suggested: false, adaptive_reason: override.adaptive_reason || 'Time confirmed by you.', updated_at: override.updated_at }
  }
  return event
}
export function scheduleConflict(events: ScheduleEvent[], id: string, start: Date, end: Date, transitionMinutes = 0) {
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) return 'Choose a valid start and end.'
  const buffer = transitionMinutes * 60000
  const conflict = events.find(e => e.id !== id && !e.suggested && e.busy !== false && !['skipped','cancelled'].includes(e.status) &&
    start.getTime() < new Date(e.adjusted_end_at || e.end_at).getTime() + buffer &&
    end.getTime() > new Date(e.adjusted_start_at || e.start_at).getTime() - buffer)
  return conflict ? `This overlaps ${conflict.title} or its transition buffer. Choose another time.` : null
}
