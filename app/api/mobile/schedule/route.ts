import { NextResponse } from 'next/server'
import { getProgramLogicForClient } from '@/lib/dashboard/logic/getProgramLogicForClient'
import { createMobileRequestContext } from '@/lib/mobile/auth'
import { buildMobileDailyState } from '@/lib/mobile/dailyState'
import { getDailyScheduleState } from '@/lib/schedule/service'
import type { DailyScheduleState, ScheduleEvent } from '@/lib/schedule/types'

const mobileRoutes: Record<string, string> = {
  workout: '/workout',
  meal: '/food-log',
  hydration: '/nutrition',
  recovery: '/recovery',
  check_in: '/check-in',
  assessment: '/assessments',
  sleep: '/recovery',
}

function mobileActionId(type: string) {
  if (type === 'hydration') return 'water'
  if (type === 'meal') return 'nutrition'
  if (type === 'check_in' || type === 'assessment') return 'check-in'
  if (type === 'workout') return 'workout'
  if (type === 'recovery' || type === 'sleep') return 'recovery'
  return 'check-in'
}

function toMobileScheduleEvent(event: ScheduleEvent, schedule: DailyScheduleState) {
  const adjustment = schedule.adjustments.find((item) => item.event_id === event.id)

  return {
    id: event.id,
    title: event.title,
    category: event.event_type,
    start_at: event.adjusted_start_at || event.start_at,
    end_at: event.adjusted_end_at || event.end_at,
    status: event.status,
    required: event.required,
    priority: event.priority,
    external: Boolean(event.external_event_id || event.external_calendar_source),
    can_complete:
      !event.virtual &&
      !['completed', 'cancelled', 'skipped'].includes(event.status) &&
      !(event.flexibility_type === 'fixed' && Boolean(event.external_event_id || event.external_calendar_source)),
    can_defer:
      !event.virtual &&
      event.flexibility_type === 'flexible' &&
      event.movable &&
      !event.approval_required &&
      ['anastasis', 'program', 'system', 'mobile'].includes(event.source) &&
      !event.external_event_id &&
      !event.external_calendar_source,
    adjusted: Boolean(adjustment?.applied),
    adjustment_reason: adjustment?.applied ? adjustment.reason : null,
    href: mobileRoutes[event.event_type] || '/today',
  }
}

export async function GET(request: Request) {
  try {
    const context = await createMobileRequestContext(request)

    if ('error' in context) {
      return NextResponse.json({ error: context.error }, { status: context.status })
    }

    const url = new URL(request.url)
    const logic = await getProgramLogicForClient(context)
    const schedule = await getDailyScheduleState({
      supabase: context.supabase,
      user: context.user,
      client: context.client,
      date: url.searchParams.get('date') || undefined,
      logic,
    })
    const dailyState = buildMobileDailyState(logic)
    const scheduleAction = schedule.nextAction
    const nextActionId = mobileActionId(scheduleAction.category)
    const nextAction = {
      ...(dailyState.actions.find((action) => action.id === nextActionId) || dailyState.nextAction),
      id: nextActionId,
      label: scheduleAction.title,
      status:
        scheduleAction.urgency === 'overdue'
          ? 'urgent'
          : scheduleAction.urgency === 'now'
            ? 'active'
            : scheduleAction.urgency === 'soon'
              ? 'active'
              : 'upcoming',
      detail: scheduleAction.short_reason,
      href: mobileRoutes[scheduleAction.category] || '/today',
      primary: true,
      scheduleEventId: scheduleAction.id !== 'none' ? scheduleAction.id : null,
      urgency: scheduleAction.urgency,
      start_at: scheduleAction.start_at,
      reason: scheduleAction.reason,
      can_complete: scheduleAction.can_complete,
      can_defer: scheduleAction.can_defer,
    }
    const actions = dailyState.actions.map((action) => ({
      ...action,
      primary: action.id === nextAction.id,
    }))

    return NextResponse.json({
      ...dailyState,
      user: {
        ...dailyState.user,
        id: context.user.id,
        clientId: context.client.client_id,
      },
      nextAction,
      actions,
      schedule,
      scheduleEvents: schedule.events
        .filter((event) => !['completed', 'cancelled', 'skipped'].includes(event.status))
        .map((event) => toMobileScheduleEvent(event, schedule)),
      scheduleCompletedEvents: schedule.completedEvents
        .slice(0, 5)
        .map((event) => toMobileScheduleEvent(event, schedule)),
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Mobile schedule could not be loaded.' },
      { status: 500 },
    )
  }
}
