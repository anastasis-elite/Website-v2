import { importedScheduleEvents } from '@/lib/calendar/service'
import { buildDailyRecommendation } from '@/lib/dashboard/dailyRecommendation'
import { buildTodayActivities, readDailyGuide } from '@/lib/dashboard/todayActivities'
import { getDailyExecutionPlan } from '@/lib/day/getDailyExecutionPlan'
import { getProgramLogicForClient } from '@/lib/dashboard/logic/getProgramLogicForClient'
import { getClientDayRange, zonedDateTimeToUtc } from './time'
import { buildDailyScheduleState, buildNextAction } from './engine'
import { dailyPlanToScheduleEvents, recurringCommitmentsToEvents } from './dailyPlanAdapter'
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
    .or(`and(start_at.lt.${dayEnd.toISOString()},end_at.gt.${dayStart.toISOString()}),and(adjusted_start_at.lt.${dayEnd.toISOString()},adjusted_end_at.gt.${dayStart.toISOString()})`)
    .order('start_at', { ascending: true })

  if (error) throw new Error(error.message)
  // Keep the original time for context, but place a moved event on its effective day.
  return ((data || []) as ScheduleEvent[]).filter(event =>
    new Date(event.adjusted_start_at || event.start_at) < dayEnd &&
    new Date(event.adjusted_end_at || event.end_at) > dayStart)
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
  const unavailableSources: NonNullable<DailyScheduleState['unavailableSources']> = []
  // Schedule integrations are optional to the daily health dashboard. Keep the
  // available sources readable, but never treat an unread source as free time.
  async function optionalSource<T>(source: typeof unavailableSources[number], load: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await load()
    } catch (error) {
      unavailableSources.push(source)
      console.error(`Schedule source unavailable (${source}):`, error instanceof Error ? error.message : error)
      return fallback
    }
  }
  const persistedEvents = await optionalSource('saved_events', () => loadScheduleEventsForDay({
    supabase,
    userId: user.id,
    clientId: client.client_id,
    dayStart: day.start,
    dayEnd: day.end,
  }), [])

  const blocks = await optionalSource<any[]>('recurring_commitments', async () => {
    const { data, error } = await supabase.from('client_schedule_blocks').select('*').eq('client_id', client.client_id).eq('user_id', user.id).eq('active', true)
    if (error) throw new Error(error.message)
    return data || []
  }, [])
  const calendarEvents = await optionalSource('calendar', () => importedScheduleEvents(supabase, user.id, client.client_id, day.start.toISOString(), day.end.toISOString(), day.timezone), [])
  persistedEvents.push(...calendarEvents)
  const commitments = recurringCommitmentsToEvents({ userId: user.id, client, date: day.date, timezone: day.timezone, blocks: blocks || [] })
  const dailyPlan = includeVirtualPlan
    ? await getDailyExecutionPlan({ supabase, client })
    : null
  const virtualEvents =
    includeVirtualPlan && dailyPlan?.date === day.date
      ? dailyPlanToScheduleEvents({ userId: user.id, client, dailyPlan }).filter(event => !commitments.some(c => c.event_type === event.event_type && event.flexibility_type === 'fixed') && !persistedEvents.some(e => ['workout','hydration'].includes(event.event_type) && e.event_type === event.event_type && !['skipped','cancelled'].includes(e.status)))
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
    dayStart: client.wake_time && (!client.bed_time || client.wake_time < client.bed_time) ? zonedDateTimeToUtc(day.date, client.wake_time, day.timezone) : day.start,
    dayEnd: client.bed_time && (!client.wake_time || client.wake_time < client.bed_time) ? zonedDateTimeToUtc(day.date, client.bed_time, day.timezone) : day.end,
    events: [...commitments, ...persistedEvents.map(event => {
      if (event.status !== 'scheduled' || !effectiveLogic || dailyPlan?.date !== day.date) return event
      const confirmed = event.event_type === 'workout' ? effectiveLogic.execution.workoutComplete : event.event_type === 'check_in' ? effectiveLogic.assessments.dailyCompleted : event.event_type === 'hydration' ? effectiveLogic.hydration.status !== 'needs_input' && effectiveLogic.hydration.remaining <= 0 : false
      return confirmed ? { ...event, status: 'completed' as const } : event
    }), ...virtualEvents.map(event => {
      const override = client.onboarding_data?.scheduleOverrides?.[event.id]
      return override ? { ...event, ...override } : event
    })],
    transitionMinutes: Number(client.onboarding_data?.transitionMinutes ?? 10),
    logic: effectiveLogic,
    program: client.program || 'ignite',
  })

  state.preferences = { executionStyle: client.execution_style || 'flow', carouselStyle: client.carousel_style || 'section',
    transitionMinutes: Number(client.onboarding_data?.transitionMinutes ?? 10) }
  state.unavailableSources = unavailableSources
  state.program = client.program || 'ignite'
  state.dailyGuide = readDailyGuide(client.onboarding_data?.dailyGuide, day.date)
  if (effectiveLogic && dailyPlan?.date === day.date) {
    state.todayActivities = buildTodayActivities(effectiveLogic, state)
    state.dailyRecommendation = buildDailyRecommendation(effectiveLogic, state)
    const primary = state.dailyRecommendation.primary
    const event = primary.eventId ? state.events.find(item => item.id === primary.eventId) || null : null
    const eventAction = event ? buildNextAction({ nextActionableEvent: event, adjustments: state.adjustments,
      now: new Date(state.now), program: state.program }) : null
    state.nextAction = { ...(eventAction || state.nextAction), id: primary.eventId || primary.id, title: primary.title,
      category: (primary.category === 'nutrition' ? 'meal' : primary.category === 'none' ? 'custom' : primary.category) as any,
      reason: primary.reason, short_reason: primary.reason, action_route: primary.href,
      start_at: eventAction?.start_at || null, overdue: eventAction?.overdue || false,
      urgency: eventAction?.urgency || (primary.completed ? 'none' : 'now'),
      automatically_adjusted: eventAction?.automatically_adjusted || false,
      can_complete: eventAction?.can_complete || false, can_defer: eventAction?.can_defer || false }
  }

  if (unavailableSources.length) {
    // An incomplete calendar cannot establish conflict-free windows. Reads may
    // continue; mutation routes must reject moves until every source is loaded.
    state.openWindows = []
    state.adjustments = []
    state.nextAction.can_defer = false
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
