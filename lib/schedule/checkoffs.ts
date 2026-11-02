import { healthEventTypes } from './actions'
import type { ScheduleEvent } from './types'

export type ScheduleCheckoff = {
  user_id: string
  client_id: string
  occurrence_date: string
  event_id: string
  completed: boolean
  completed_at: string | null
  revision: number
  operation_id: string
}

export class ScheduleCheckoffConflict extends Error {}

export function validScheduleDate(date: unknown): date is string {
  return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date
}

export async function loadScheduleCheckoffs({ supabase, userId, clientId, date }: {
  supabase: any; userId: string; clientId: string; date: string
}): Promise<ScheduleCheckoff[]> {
  const { data, error } = await supabase.from('schedule_occurrence_checkoffs').select('*')
    .eq('user_id', userId).eq('client_id', clientId).eq('occurrence_date', date)
  if (error) throw new Error('Saved check-offs could not be loaded.')
  return data || []
}

export function applyScheduleCheckoffs(events: ScheduleEvent[], checkoffs: ScheduleCheckoff[]) {
  const byEvent = new Map(checkoffs.map(checkoff => [checkoff.event_id, checkoff]))
  return events.map(event => {
    // Never accept generic check-off evidence as saved health data. Inactive
    // calendar events also retain their cancellation/skip outcome.
    if (healthEventTypes.has(event.event_type) || ['cancelled', 'skipped'].includes(event.status)) return event
    const checkoff = byEvent.get(event.id)
    return {
      ...event,
      ...(checkoff?.completed ? { status: 'completed' as const, completed_at: checkoff.completed_at } : {}),
      checkoff: { completed: checkoff?.completed || event.status === 'completed', revision: checkoff?.revision || 0 },
    }
  })
}

/** Desired-state writes, never toggles. A revision comparison serializes opposing
 * actions, and the operation id recognizes a retry after an uncertain response. */
export async function saveScheduleCheckoff({ supabase, userId, clientId, date, eventId,
  completed, expectedRevision, operationId, now = new Date(),
}: {
  supabase: any; userId: string; clientId: string; date: string; eventId: string
  completed: boolean; expectedRevision: number; operationId: string; now?: Date
}): Promise<{ completed: boolean; revision: number }> {
  const owned = () => supabase.from('schedule_occurrence_checkoffs')
  const where = (query: any) => query.eq('user_id', userId).eq('client_id', clientId)
    .eq('occurrence_date', date).eq('event_id', eventId)
  async function read(): Promise<ScheduleCheckoff | null> {
    const result = await where(owned().select('*')).maybeSingle()
    if (result.error) throw new Error('Your check-off could not be saved. Try again.')
    return result.data
  }
  const current = await read()
  const sameOperation = (row: ScheduleCheckoff | null) => row?.operation_id === operationId && row.completed === completed
  const conflict = () => new ScheduleCheckoffConflict('This item changed on another screen. Refresh Schedule before trying again.')
  if (sameOperation(current)) return { completed: current!.completed, revision: current!.revision }
  if (current?.operation_id === operationId) throw conflict()
  if ((current?.revision || 0) !== expectedRevision) throw conflict()
  if (current?.completed === completed || !current && !completed) {
    return { completed, revision: current?.revision || 0 }
  }
  const values = { completed, completed_at: completed ? now.toISOString() : null,
    revision: expectedRevision + 1, operation_id: operationId, updated_at: now.toISOString() }
  const result = current
    ? await where(owned().update(values)).eq('revision', expectedRevision).select('*').maybeSingle()
    : await owned().upsert({ user_id: userId, client_id: clientId, occurrence_date: date, event_id: eventId, ...values },
      { onConflict: 'user_id,client_id,occurrence_date,event_id', ignoreDuplicates: true }).select('*').maybeSingle()
  if (result.error) throw new Error('Your check-off could not be saved. Try again.')
  if (result.data) return { completed: result.data.completed, revision: result.data.revision }
  // Another request won the insert/update. Only this exact operation can be
  // acknowledged; replaying an older intent must not undo a newer action.
  const latest = await read()
  if (sameOperation(latest)) return { completed: latest!.completed, revision: latest!.revision }
  throw conflict()
}
