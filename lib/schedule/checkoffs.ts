import { canRespondToScheduleEvent } from './actions'
import type { ScheduleEvent, ScheduleResponseStatus } from './types'

export type ScheduleCheckoff = {
  user_id: string
  client_id: string
  occurrence_date: string
  event_id: string
  completed: boolean
  completed_at: string | null
  response_status?: ScheduleResponseStatus
  occurrence_snapshot?: BreakfastOccurrenceSnapshot | null
  revision: number
  operation_id: string
}

export type BreakfastOccurrenceSnapshot = Pick<ScheduleEvent,
  'id' | 'title' | 'start_at' | 'end_at' | 'timezone' | 'schedule_date' | 'schedule_response_kind'>

type SavedResponse = { completed: boolean; status: ScheduleResponseStatus; revision: number }
export class ScheduleCheckoffConflict extends Error {}

export function validScheduleDate(date: unknown): date is string {
  return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date
}

export function validScheduleResponseStatus(status: unknown): status is ScheduleResponseStatus {
  return status === 'scheduled' || status === 'in_progress' || status === 'completed'
}

function responseStatus(row: ScheduleCheckoff): ScheduleResponseStatus {
  // Older rows only recorded a boolean. Elapsed time is never evidence.
  return row.completed ? 'completed' : row.response_status === 'in_progress' ? 'in_progress' : 'scheduled'
}
function savedResponse(row: ScheduleCheckoff): SavedResponse {
  return { completed: row.completed, status: responseStatus(row), revision: row.revision }
}

export async function loadScheduleCheckoffs({ supabase, userId, clientId, date }: {
  supabase: any; userId: string; clientId: string; date: string
}): Promise<ScheduleCheckoff[]> {
  const { data, error } = await supabase.from('schedule_occurrence_checkoffs').select('*')
    .eq('user_id', userId).eq('client_id', clientId).eq('occurrence_date', date)
  if (error) throw new Error('Saved schedule responses could not be loaded.')
  return data || []
}

export function applyScheduleCheckoffs(events: ScheduleEvent[], checkoffs: ScheduleCheckoff[]) {
  const byEvent = new Map(checkoffs.map(checkoff => [checkoff.event_id, checkoff]))
  return events.map(event => {
    // Health completion continues to come from its saved workflows. Breakfast
    // is the single projected schedule-only self-report, without a meal entry.
    if (!canRespondToScheduleEvent(event) || ['cancelled', 'skipped'].includes(event.status)) return event
    const checkoff = byEvent.get(event.id)
    const authoritative = event.status === 'completed'
    const status = authoritative ? 'completed' : checkoff ? responseStatus(checkoff) : 'scheduled'
    return {
      ...event,
      ...(status === 'completed' && !authoritative ? { status: 'completed' as const, completed_at: checkoff!.completed_at } : {}),
      checkoff: { completed: status === 'completed', status, revision: checkoff?.revision || 0,
        ...(authoritative ? { authoritative: true as const } : {}) },
    }
  })
}

/** Desired-state writes, never toggles. A revision comparison serializes opposing
 * actions, and the operation id recognizes a retry after an uncertain response. */
export async function saveScheduleCheckoff({ supabase, userId, clientId, date, eventId,
  completed, status, expectedRevision, operationId, occurrenceSnapshot, now = new Date(),
}: {
  supabase: any; userId: string; clientId: string; date: string; eventId: string
  completed?: boolean; status?: ScheduleResponseStatus; expectedRevision: number; operationId: string; now?: Date
  occurrenceSnapshot?: BreakfastOccurrenceSnapshot
}): Promise<SavedResponse> {
  const desired = status ?? (completed === true ? 'completed' : 'scheduled')
  if (!validScheduleResponseStatus(desired) || (completed !== undefined && completed !== (desired === 'completed'))) {
    throw new Error('Choose a valid schedule response.')
  }
  const owned = () => supabase.from('schedule_occurrence_checkoffs')
  const where = (query: any) => query.eq('user_id', userId).eq('client_id', clientId)
    .eq('occurrence_date', date).eq('event_id', eventId)
  async function read(): Promise<ScheduleCheckoff | null> {
    const result = await where(owned().select('*')).maybeSingle()
    if (result.error) throw new Error('Your schedule response could not be saved. Try again.')
    return result.data
  }
  const current = await read()
  const sameOperation = (row: ScheduleCheckoff | null) => row?.operation_id === operationId && responseStatus(row) === desired
  const conflict = () => new ScheduleCheckoffConflict('This item changed on another screen. Refresh Schedule before trying again.')
  if (sameOperation(current)) return savedResponse(current!)
  if (current?.operation_id === operationId) throw conflict()
  if ((current?.revision || 0) !== expectedRevision) throw conflict()
  if (current && responseStatus(current) === desired || !current && desired === 'scheduled') {
    return { completed: desired === 'completed', status: desired, revision: current?.revision || 0 }
  }
  const values = { completed: desired === 'completed', response_status: desired,
    ...(occurrenceSnapshot ? { occurrence_snapshot: occurrenceSnapshot } : {}),
    completed_at: desired === 'completed' ? now.toISOString() : null,
    revision: expectedRevision + 1, operation_id: operationId, updated_at: now.toISOString() }
  const result = current
    ? await where(owned().update(values)).eq('revision', expectedRevision).select('*').maybeSingle()
    : await owned().upsert({ user_id: userId, client_id: clientId, occurrence_date: date, event_id: eventId, ...values },
      { onConflict: 'user_id,client_id,occurrence_date,event_id', ignoreDuplicates: true }).select('*').maybeSingle()
  if (result.error) throw new Error('Your schedule response could not be saved. Try again.')
  if (result.data) return savedResponse(result.data)
  // Another request won the insert/update. Only this exact operation can be
  // acknowledged; replaying an older intent must not undo a newer action.
  const latest = await read()
  if (sameOperation(latest)) return savedResponse(latest!)
  throw conflict()
}
