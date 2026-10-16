import { importedScheduleEvents } from '@/lib/calendar/service'
import { buildDailyRecommendation } from '@/lib/dashboard/dailyRecommendation'
import { buildTodayActivities, readDailyGuide } from '@/lib/dashboard/todayActivities'
import { getDailyExecutionPlan } from '@/lib/day/getDailyExecutionPlan'
import { getProgramLogicForClient } from '@/lib/dashboard/logic/getProgramLogicForClient'
import { getScheduleStructureSubmission, getScheduleStructureVersion, scheduleStructureMonthlyTask, SCHEDULE_STRUCTURE_PATH } from '@/lib/assessment/scheduleStructure'
import { getClientLocalDate } from '@/lib/timezone'
import { getClientDayRange, zonedDateTimeToUtc } from './time'
import { buildDailyScheduleState, buildNextAction } from './engine'
import { dailyPlanToScheduleEvents, recurringCommitmentsToEvents } from './dailyPlanAdapter'
import type { DailyScheduleState, ScheduleEvent } from './types'
import { applyScheduleEventOverride, healthEventTypes, isInformationalScheduleEvent } from './actions'

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
  dailyPlan: providedDailyPlan,
  sourceTimeoutMs,
}: {
  supabase: any
  user: any
  client: any
  date?: string
  includeVirtualPlan?: boolean
  logic?: any
  dailyPlan?: Awaited<ReturnType<typeof getDailyExecutionPlan>>
  sourceTimeoutMs?: number
}): Promise<DailyScheduleState> {
  const day = getClientDayRange(client, date)
  const unavailableSources: NonNullable<DailyScheduleState['unavailableSources']> = []
  // Schedule integrations are optional to the daily health dashboard. Keep the
  // available sources readable, but never treat an unread source as free time.
  async function optionalSource<T>(source: typeof unavailableSources[number], load: () => Promise<T>, fallback: T): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      return await (sourceTimeoutMs ? Promise.race([
        load(),
        new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Error('Schedule source timed out.')), sourceTimeoutMs) }),
      ]) : load())
    } catch (error) {
      unavailableSources.push(source)
      console.error(`Schedule source unavailable (${source}):`, error instanceof Error ? error.message : error)
      return fallback
    } finally {
      if (timer) clearTimeout(timer)
    }
  }
  const dailyPlanPromise = includeVirtualPlan ? Promise.resolve(providedDailyPlan || getDailyExecutionPlan({ supabase, client })) : Promise.resolve(null)
  const [persistedEvents, blocks, calendarEvents, dailyPlan, effectiveLogic] = await Promise.all([
    optionalSource('saved_events', () => loadScheduleEventsForDay({
    supabase,
    userId: user.id,
    clientId: client.client_id,
    dayStart: day.start,
    dayEnd: day.end,
  }), []),
  optionalSource<any[]>('recurring_commitments', async () => {
    const { data, error } = await supabase.from('client_schedule_blocks').select('*').eq('client_id', client.client_id).eq('user_id', user.id).eq('active', true)
    if (error) throw new Error(error.message)
    return data || []
  }, []),
  optionalSource('calendar', () => importedScheduleEvents(supabase, user.id, client.client_id, day.start.toISOString(), day.end.toISOString(), day.timezone), []),
  dailyPlanPromise,
  logic || (includeVirtualPlan ? dailyPlanPromise.then(dailyPlan => getProgramLogicForClient({ supabase, user, client, dailyPlan: dailyPlan || undefined })) : null),
  ])
  persistedEvents.push(...calendarEvents)
  const commitments = recurringCommitmentsToEvents({ userId: user.id, client, date: day.date, timezone: day.timezone, blocks: blocks || [] })
  const virtualEvents =
    includeVirtualPlan && dailyPlan?.date === day.date
      ? dailyPlanToScheduleEvents({ userId: user.id, client, dailyPlan }).filter(event => !commitments.some(c => c.event_type === event.event_type && event.flexibility_type === 'fixed') && !persistedEvents.some(e => ['workout','hydration'].includes(event.event_type) && e.event_type === event.event_type && !['skipped','cancelled'].includes(e.status)))
      : []
  const month = day.date.slice(0, 7)
  const monthlyTask = scheduleStructureMonthlyTask(month)
  const monthlySubmission = getScheduleStructureSubmission(client.onboarding_data, monthlyTask)
  const reviewedAt = typeof client.daily_structure_reviewed_at === 'string' ? new Date(client.daily_structure_reviewed_at) : null
  const legacyReviewComplete = reviewedAt && Number.isFinite(reviewedAt.getTime()) &&
    getClientLocalDate(client, reviewedAt).slice(0, 7) === month
  // This is the existing monthly Daily Structure Review, projected into the
  // shared schedule. Work and school commitments keep their own meaning.
  // Historical reviewed-at evidence stays complete without requiring a repeat.
  if (includeVirtualPlan && dailyPlan?.date === day.date && day.date === getClientLocalDate(client) &&
    !persistedEvents.some(event => getScheduleStructureVersion(event) !== null) &&
    (monthlySubmission || !legacyReviewComplete)) {
    virtualEvents.push({
      ...monthlyTask, user_id: user.id, client_id: client.client_id, title: monthlyTask.title!,
      event_type: 'assessment', source: 'system', description: 'Review your daily rhythm and training availability for this month.',
      start_at: day.start.toISOString(), end_at: day.end.toISOString(), timezone: day.timezone,
      all_day: true, busy: false, status: 'scheduled', completed_at: null,
      flexibility_type: 'flexible', priority: 'high', required: true, movable: false, approval_required: false,
      earliest_start_at: null, latest_end_at: null, preferred_time: null, estimated_duration_minutes: 15,
      external_provider_name: null, external_contact_type: null, external_contact_value: null,
      external_event_id: null, external_calendar_source: null, reschedule_allowed: false,
      reschedule_requires_approval: false, last_reschedule_requested_at: null, delegation_status: null,
      delegation_notes: null, adaptive_reason: null, adjusted_start_at: null, adjusted_end_at: null,
      adjusted_duration_minutes: null, virtual: true,
    })
  }
  const savedSnapshots = Object.entries(client.onboarding_data?.scheduleOverrides || {}).flatMap(([id, value]) => {
    const snapshot = (value as any)?.event_snapshot as ScheduleEvent | undefined
    if (!snapshot || snapshot.id !== id || !snapshot.virtual || snapshot.user_id !== user.id || snapshot.client_id !== client.client_id ||
      !Number.isFinite(Date.parse(snapshot.start_at)) || !Number.isFinite(Date.parse(snapshot.end_at))) return []
    const effective = applyScheduleEventOverride(snapshot, value)
    return new Date(effective.adjusted_start_at || effective.start_at) < day.end &&
      new Date(effective.adjusted_end_at || effective.end_at) > day.start ? [snapshot] : []
  })
  const snapshotById = new Map(savedSnapshots.map(event => [event.id, event]))
  const projectedIds = new Set([...commitments, ...persistedEvents, ...virtualEvents].map(event => event.id))
  const historicalEvents = savedSnapshots.filter(event => !projectedIds.has(event.id) &&
    (!healthEventTypes.has(event.event_type) || client.onboarding_data?.scheduleOverrides?.[event.id]?.status === 'skipped'))
  const state = buildDailyScheduleState({
    date: day.date,
    timezone: day.timezone,
    now: new Date(),
    dayStart: client.wake_time && (!client.bed_time || client.wake_time < client.bed_time) ? zonedDateTimeToUtc(day.date, client.wake_time, day.timezone) : day.start,
    dayEnd: client.bed_time && (!client.wake_time || client.wake_time < client.bed_time) ? zonedDateTimeToUtc(day.date, client.bed_time, day.timezone) : day.end,
    events: [...commitments, ...persistedEvents.map(event => {
      if (event.status !== 'scheduled' || isInformationalScheduleEvent(event) || !effectiveLogic || dailyPlan?.date !== day.date) return event
      const confirmed = event.event_type === 'workout' ? effectiveLogic.execution.workoutComplete : event.event_type === 'check_in' ? effectiveLogic.assessments.dailyCompleted : event.event_type === 'hydration' ? effectiveLogic.hydration.status !== 'needs_input' && effectiveLogic.hydration.remaining <= 0 : false
      return confirmed ? { ...event, status: 'completed' as const } : event
    }), ...virtualEvents, ...historicalEvents].map(event => {
      // Both recurring commitments and daily suggestions are per-occurrence
      // virtual records. Apply saved outcomes without editing their template.
      const override = event.virtual ? client.onboarding_data?.scheduleOverrides?.[event.id] : null
      const dismissal = client.onboarding_data?.scheduleDismissals?.[day.date]?.[event.id]
      return { ...applyScheduleEventOverride(event.virtual && !healthEventTypes.has(event.event_type) ? snapshotById.get(event.id) || event : event, override),
        ...(typeof dismissal === 'string' ? { dismissed_from_today: day.date } : {}) }
    }).map(event => {
      const submission = getScheduleStructureSubmission(client.onboarding_data, event)
      if (!submission && getScheduleStructureVersion(event) === null) return event
      // Persisted submission wins even if an older open screen finishes a
      // skip/cancel request after the assessment has already been submitted.
      if (submission) return { ...event, status: 'completed' as const, completed_at: submission.submittedAt,
        action_route: `${SCHEDULE_STRUCTURE_PATH}?assessmentVersion=${submission.assessmentVersion}` }
      // A task is complete only when its matching assessment version was saved.
      return event.status === 'completed' ? { ...event, status: 'scheduled' as const, completed_at: null } : event
    }),
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
