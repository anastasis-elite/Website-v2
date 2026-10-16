import { getScheduleEventCapabilities, healthEventTypes, scheduleConflict, scheduleEventVersion } from './actions'
import type { ScheduleEvent } from './types'
import { getDailyScheduleState } from '@/lib/schedule/service'
import { getClientLocalDate } from '@/lib/timezone'
import { updateOwnedOnboardingData } from '@/lib/dashboard/updateOnboardingData'
import { getScheduleStructureSubmission } from '@/lib/assessment/scheduleStructure'

export class ScheduleMutationError extends Error {
  constructor(message: string, public status = 409) { super(message) }
}

export type ScheduleMutationAction = 'complete' | 'skip' | 'move'
const terminal = (event: ScheduleEvent) => ['completed', 'skipped', 'cancelled'].includes(event.status)
const stamp = (event: ScheduleEvent) => new Date(Math.max(Date.now(), (Date.parse(event.updated_at || '') || 0) + 1)).toISOString()

export function compareScheduleRow(query: any, event: ScheduleEvent) {
  query = query.eq('status', event.status)
  return event.updated_at ? query.eq('updated_at', event.updated_at) : query.is('updated_at', null)
}

function validateAction(event: ScheduleEvent, action: ScheduleMutationAction, expectedVersion?: string) {
  const capability = getScheduleEventCapabilities(event)
  if (capability.isInformational) throw new ScheduleMutationError('Open this calendar event or dismiss it from Today. Manage its time through its calendar.')
  if (action === 'complete' && healthEventTypes.has(event.event_type)) throw new ScheduleMutationError('Open this activity and save what you did to complete it.')
  const desired = action === 'complete' ? 'completed' : action === 'skip' ? 'skipped' : null
  if (desired && event.status === desired) return false
  if (terminal(event)) throw new ScheduleMutationError('This activity already has a saved outcome. Refresh to review it.')
  if (expectedVersion && expectedVersion !== scheduleEventVersion(event)) throw new ScheduleMutationError('This activity changed. Refresh and review it before trying again.')
  if (!(action === 'complete' ? capability.canComplete : action === 'skip' ? capability.canSkip : capability.canReschedule)) {
    throw new ScheduleMutationError(capability.isInformational ? 'Open this calendar event or dismiss it from Today. Manage its time through its calendar.' :
      action === 'complete' ? 'Open this activity and save what you did to complete it.' : 'This change is not supported for this activity.')
  }
  return true
}

async function changedFields(context: any, event: ScheduleEvent, action: ScheduleMutationAction, body: any) {
  const updated_at = stamp(event)
  if (action === 'complete') return { status: 'completed', completed_at: updated_at, updated_at }
  if (action === 'skip') return { status: 'skipped', completed_at: null, updated_at }
  const start = new Date(body.start_at), end = new Date(body.end_at)
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start || start <= new Date()) {
    throw new ScheduleMutationError('Choose a valid future start and end time.', 400)
  }
  if ((event.earliest_start_at && start < new Date(event.earliest_start_at)) ||
    (event.latest_end_at && end > new Date(event.latest_end_at))) throw new ScheduleMutationError('Choose a time within this activity’s available window.', 400)
  const day = getClientLocalDate(context.client, start)
  if (event.virtual && (day !== getClientLocalDate(context.client) || getClientLocalDate(context.client, new Date(end.getTime() - 1)) !== day)) {
    throw new ScheduleMutationError('Choose a later time today for this plan item.', 400)
  }
  const state = await getDailyScheduleState({ ...context, date: day })
  if (state.unavailableSources?.length) throw new ScheduleMutationError('Your full schedule could not be loaded. Try again before changing a time.', 503)
  const conflict = scheduleConflict(state.events, event.id, start, end, state.preferences?.transitionMinutes)
  if (conflict) throw new ScheduleMutationError(conflict)
  return { adjusted_start_at: start.toISOString(), adjusted_end_at: end.toISOString(),
    adjusted_duration_minutes: Math.round((end.getTime() - start.getTime()) / 60000), status: 'scheduled',
    completed_at: null, suggested: false, adaptive_reason: 'Time confirmed by you.', updated_at }
}

export async function mutatePersistedScheduleEvent(context: any, id: string, action: ScheduleMutationAction, body: any = {}) {
  const { supabase, user, client } = context
  const { data: event, error } = await supabase.from('anastasis_schedule_events').select('*')
    .eq('id', id).eq('user_id', user.id).eq('client_id', client.client_id).maybeSingle()
  if (error) throw new ScheduleMutationError('Your activity could not be loaded. Try again.', 503)
  if (!event) throw new ScheduleMutationError('Activity not found.', 404)
  if (getScheduleStructureSubmission(client.onboarding_data, event)) throw new ScheduleMutationError('This assessment is already submitted. Its completion is saved.')
  if (!validateAction(event, action, body.expected_version)) return event
  const fields = await changedFields(context, event, action, body)
  // suggested is projected for virtual items, not a database column.
  const persisted: Record<string, unknown> = { ...fields }
  delete persisted.suggested
  const result = await compareScheduleRow(supabase.from('anastasis_schedule_events').update(persisted)
    .eq('id', id).eq('user_id', user.id).eq('client_id', client.client_id), event).select('*').maybeSingle()
  if (result.error) throw new ScheduleMutationError('Your change could not be saved. Try again.', 503)
  if (!result.data) throw new ScheduleMutationError('This activity changed while saving. Refresh to see its saved outcome.')
  return result.data
}

export async function mutateVirtualScheduleEvent(context: any, body: any) {
  const { supabase, user, client } = context
  const state = await getDailyScheduleState(context)
  if (body.date && body.date !== state.date) throw new ScheduleMutationError('A new day has started. Refresh Today before saving.')
  const event = state.events.find(item => item.id === body.eventId && item.virtual)
  if (!event) throw new ScheduleMutationError('Today’s plan item was not found.', 404)
  const action = body.action as ScheduleMutationAction
  if (!['complete', 'skip', 'move'].includes(action)) throw new ScheduleMutationError('Choose complete, skip, or reschedule.', 400)
  if (!validateAction(event, action, body.expected_version)) return event
  const fields = await changedFields(context, event, action, body)
  const original = JSON.stringify(client.onboarding_data?.scheduleOverrides?.[event.id] || null)
  if (getClientLocalDate(client) !== state.date) throw new ScheduleMutationError('A new day has started. Refresh Today before saving.')
  const result = await updateOwnedOnboardingData({ supabase, userId: user.id, clientId: client.client_id,
    merge: current => {
      if (JSON.stringify(current.scheduleOverrides?.[event.id] || null) !== original) throw new ScheduleMutationError('This activity changed while saving. Refresh to see its saved outcome.')
      return { ...current, scheduleOverrides: { ...current.scheduleOverrides,
        [event.id]: { ...fields, event_snapshot: { ...event, dismissed_from_today: undefined } } } }
    } })
  if (!result.saved) throw new ScheduleMutationError('Your change could not be saved. Refresh and try again.', result.status)
  return { ...event, ...fields }
}

export async function dismissScheduleEvent(context: any, body: any) {
  const { supabase, user, client } = context
  const state = await getDailyScheduleState(context)
  if (body.date !== state.date || state.date !== getClientLocalDate(client)) throw new ScheduleMutationError('A new day has started. Refresh Today before dismissing an event.')
  const event = state.events.find(item => item.id === body.eventId)
  if (!event) throw new ScheduleMutationError('Calendar event not found.', 404)
  if (event.dismissed_from_today === state.date) return event
  if (!getScheduleEventCapabilities(event).canDismiss) throw new ScheduleMutationError('Only informational calendar events can be dismissed from Today.')
  const savedAt = new Date().toISOString()
  const result = await updateOwnedOnboardingData({ supabase, userId: user.id, clientId: client.client_id,
    merge: current => ({ ...current, scheduleDismissals: { ...current.scheduleDismissals,
      [state.date]: { ...current.scheduleDismissals?.[state.date], [event.id]: current.scheduleDismissals?.[state.date]?.[event.id] || savedAt } } }) })
  if (!result.saved) throw new ScheduleMutationError('Your dismissal could not be saved. Try again.', result.status)
  return { ...event, dismissed_from_today: state.date }
}

export async function refreshedScheduleAfterMutation(context: any) {
  const { data, error } = await context.supabase.from('clients').select('onboarding_data')
    .eq('client_id', context.client.client_id).eq('auth_user_id', context.user.id).maybeSingle()
  if (error || !data) return undefined
  return getDailyScheduleState({ ...context, client: { ...context.client, onboarding_data: data.onboarding_data } })
}
