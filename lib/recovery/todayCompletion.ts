import type { DailyScheduleState, ScheduleEvent } from '@/lib/schedule/types'

export type RecoveryCompletionEvidence = {
  ownerUserId: string
  clientId: string
  date: string
  available: boolean
  completedAt: string[]
  unlinkedRecordCount: number
}

export type RecoveryPresentation = {
  state: 'completed' | 'due' | 'upcoming' | 'held' | 'no_event' | 'ambiguous' | 'unavailable'
  complete: boolean
  eventId: string | null
  nextRefreshAt: string | null
}

/** The database query is owner-bound too. Keep that boundary when consuming
 * fixtures, old rows or future source changes; no health answers leave here. */
export function recoveryCompletionEvidence({ userId, clientId, date, rows, available = true }: {
  userId: string; clientId: string; date: string; rows: any[]; available?: boolean
}): RecoveryCompletionEvidence {
  const owned = (Array.isArray(rows) ? rows : []).filter(row => row?.user_id === userId && row?.client_id === clientId && row?.log_date === date)
  const recorded = owned.map(row => row.created_at).filter(value => typeof value === 'string' && Number.isFinite(Date.parse(value))) as string[]
  return { ownerUserId: userId, clientId, date, available: available && Array.isArray(rows),
    completedAt: [...new Set(recorded)].sort(), unlinkedRecordCount: owned.length - recorded.length }
}

type RecoverySchedule = Pick<DailyScheduleState, 'date' | 'now' | 'events'> & Pick<Partial<DailyScheduleState>, 'unavailableSources'>
type TimedEvent = { event: ScheduleEvent; start: number; end: number }

/** Presentation only: a saved recovery moment does not complete the whole day's
 * later events. Without a distinct, unambiguous window it remains unlinked. */
export function getRecoveryPresentation({ evidence, schedule, now }: {
  evidence?: RecoveryCompletionEvidence; schedule?: RecoverySchedule; now?: Date
}): RecoveryPresentation {
  const result = (state: RecoveryPresentation['state'], eventId: string | null = null, nextRefreshAt: string | null = null): RecoveryPresentation =>
    ({ state, complete: state === 'completed', eventId, nextRefreshAt })
  if (!evidence || !schedule || schedule.date !== evidence.date || schedule.unavailableSources?.length) return result('unavailable')
  const instant = (now || new Date(schedule.now)).getTime()
  if (!Number.isFinite(instant) || !evidence.ownerUserId || !evidence.clientId) return result('unavailable')
  const owned = schedule.events.filter(event => event.event_type === 'recovery' && event.user_id === evidence.ownerUserId &&
    event.client_id === evidence.clientId && event.status !== 'cancelled' && (!event.schedule_date || event.schedule_date === evidence.date))
  if (!owned.length) return result(evidence.available ? 'no_event' : 'unavailable')
  const events: TimedEvent[] = owned.map(event => ({ event,
    start: Date.parse(event.adjusted_start_at || event.start_at), end: Date.parse(event.adjusted_end_at || event.end_at) }))
  if (events.some(item => !item.event.id || !Number.isFinite(item.start) || !Number.isFinite(item.end) || item.end <= item.start) ||
    new Set(events.map(item => item.event.id)).size !== events.length) return result('ambiguous')
  events.sort((left, right) => left.start - right.start)
  const next = events.find(item => item.start > instant)
  const nextRefreshAt = next ? new Date(next.start).toISOString() : null
  const due = events.filter(item => item.start <= instant)
  if (!due.length) return result('upcoming', next?.event.id || null, nextRefreshAt)
  const current = due[due.length - 1]
  if (due.filter(item => item.start === current.start).length !== 1) return result('ambiguous', null, nextRefreshAt)
  if (current.event.status === 'completed') return result('completed', current.event.id, nextRefreshAt)
  if (['skipped', 'deferred'].includes(current.event.status)) return result('held', current.event.id, nextRefreshAt)
  if (!evidence.available) return result('unavailable', current.event.id, nextRefreshAt)
  if (current.event.all_day || evidence.unlinkedRecordCount > 0) return result('ambiguous', current.event.id, nextRefreshAt)
  let ambiguous = false
  for (const recorded of evidence.completedAt) {
    const at = Date.parse(recorded)
    if (!Number.isFinite(at) || at > instant) continue
    const matching = events.filter(item => item.start <= at && at < item.end)
    if (matching.length > 1 && matching.some(item => item.event.id === current.event.id)) ambiguous = true
    if (matching.length === 1 && !matching[0].event.all_day && matching[0].event.id === current.event.id) return result('completed', current.event.id, nextRefreshAt)
  }
  return result(ambiguous ? 'ambiguous' : 'due', current.event.id, nextRefreshAt)
}
