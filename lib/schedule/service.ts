import { getDailyExecutionPlan } from '@/lib/day/getDailyExecutionPlan'
import { getProgramLogicForClient } from '@/lib/dashboard/logic/getProgramLogicForClient'
import { getClientDayRange } from './time'
import { buildDailyScheduleState } from './engine'
import { dailyPlanToScheduleEvents } from './dailyPlanAdapter'
import type { DailyScheduleState, ScheduleEvent } from './types'

export async function loadScheduleEventsForDay({
  supabase,
  userId,
  clientId,
  dayStart,
  dayEnd,
}: {
  supabase: any
  userId: string
  clientId: string
  dayStart: Date
  dayEnd: Date
}) {
  const { data, error } = await supabase
    .from('anastasis_schedule_events')
    .select('*')
    .eq('user_id', userId)
    .eq('client_id', clientId)
    .lt('start_at', dayEnd.toISOString())
    .gt('end_at', dayStart.toISOString())
    .order('start_at', { ascending: true })

  if (error) throw new Error(error.message)
  return (data || []) as ScheduleEvent[]
}

export async function getDailyScheduleState({
  supabase,
  user,
  client,
  date,
  includeVirtualPlan = true,
  logic,
}: {
  supabase: any
  user: any
  client: any
  date?: string
  includeVirtualPlan?: boolean
  logic?: any
}): Promise<DailyScheduleState> {
  const day = getClientDayRange(client, date)
  const persistedEvents = await loadScheduleEventsForDay({
    supabase,
    userId: user.id,
    clientId: client.client_id,
    dayStart: day.start,
    dayEnd: day.end,
  })

  const dailyPlan = includeVirtualPlan
    ? await getDailyExecutionPlan({ supabase, client })
    : null
  const virtualEvents =
    includeVirtualPlan && dailyPlan?.date === day.date
      ? dailyPlanToScheduleEvents({ userId: user.id, client, dailyPlan })
      : []
  const effectiveLogic =
    logic ||
    (includeVirtualPlan
      ? await getProgramLogicForClient({ supabase, user, client })
      : null)

  const state = buildDailyScheduleState({
    date: day.date,
    timezone: day.timezone,
    now: new Date(),
    dayStart: day.start,
    dayEnd: day.end,
    events: [...persistedEvents, ...virtualEvents],
    logic: effectiveLogic,
    program: client.program || 'ignite',
  })

  const appliedPersistedAdjustments = state.adjustments.filter(
    (adjustment) => adjustment.automatic && adjustment.applied,
  )

  for (const adjustment of appliedPersistedAdjustments) {
    const event = state.events.find((item) => item.id === adjustment.event_id)
    if (!event || event.virtual) continue
    if (!['anastasis', 'program', 'system', 'mobile'].includes(event.source)) continue
    if (event.external_event_id || event.external_calendar_source) continue

    const nextStart = adjustment.suggested_start_at
    const nextEnd = adjustment.suggested_end_at
    const nextDuration = adjustment.suggested_duration_minutes
    if (
      event.adjusted_start_at === nextStart &&
      event.adjusted_end_at === nextEnd &&
      event.adjusted_duration_minutes === nextDuration
    ) {
      continue
    }

    await supabase
      .from('anastasis_schedule_events')
      .update({
        adjusted_start_at: nextStart,
        adjusted_end_at: nextEnd,
        adjusted_duration_minutes: nextDuration,
        adaptive_reason: adjustment.reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', event.id)
      .eq('user_id', user.id)
  }

  return state
}

export async function assertClientOwner({
  supabase,
  userId,
  clientId,
}: {
  supabase: any
  userId: string
  clientId: string
}) {
  const { data, error } = await supabase
    .from('clients')
    .select('client_id')
    .eq('client_id', clientId)
    .eq('auth_user_id', userId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return Boolean(data)
}
