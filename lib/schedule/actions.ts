import type { ScheduleEvent } from './types'
export const healthEventTypes = new Set(['workout','meal','hydration','recovery','check_in','assessment','sleep'])
export function scheduleConflict(events: ScheduleEvent[], id: string, start: Date, end: Date, transitionMinutes = 0) {
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) return 'Choose a valid start and end.'
  const buffer = transitionMinutes * 60000
  const conflict = events.find(e => e.id !== id && !e.suggested && !['skipped','cancelled'].includes(e.status) &&
    start.getTime() < new Date(e.adjusted_end_at || e.end_at).getTime() + buffer &&
    end.getTime() > new Date(e.adjusted_start_at || e.start_at).getTime() - buffer)
  return conflict ? `This overlaps ${conflict.title} or its transition buffer. Choose another time.` : null
}
