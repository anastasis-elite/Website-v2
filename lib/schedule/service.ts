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

  return buildDailyScheduleState({
    date: day.date,
    timezone: day.timezone,
    now: new Date(),
    dayStart: day.start,
    dayEnd: day.end,
    events: [...persistedEvents, ...virtualEvents],
    logic: effectiveLogic,
  })
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
