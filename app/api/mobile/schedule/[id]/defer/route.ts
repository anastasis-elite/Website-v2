import { invalidateDailyPlan } from '@/lib/dashboard/invalidateDailyPlan'
import { NextResponse } from 'next/server'
import { createMobileRequestContext } from '@/lib/mobile/auth'
import { firstValidWindow } from '@/lib/schedule/engine'
import { getDailyScheduleState } from '@/lib/schedule/service'
import { getClientLocalDate } from '@/lib/timezone'
import { scheduleConflict } from '@/lib/schedule/actions'
import type { ScheduleEvent } from '@/lib/schedule/types'

function minutesBetween(start: string, end: string) {
  return Math.max(
    1,
    Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000),
  )
}

function canMobileDefer(event: ScheduleEvent) {
  return (
    event.flexibility_type === 'flexible' &&
    event.movable &&
    !event.approval_required &&
    ['anastasis', 'program', 'system', 'mobile'].includes(event.source) &&
    !event.external_event_id &&
    !event.external_calendar_source
  )
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await createMobileRequestContext(request)

    if ('error' in context) {
      return NextResponse.json({ error: context.error }, { status: context.status })
    }

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const { data: existing, error: lookupError } = await context.supabase
      .from('anastasis_schedule_events')
      .select('*')
      .eq('id', id)
      .eq('user_id', context.user.id)
      .maybeSingle()

    if (lookupError) throw new Error(lookupError.message)
    if (!existing) return NextResponse.json({ error: 'Event not found.' }, { status: 404 })
    if (!canMobileDefer(existing as ScheduleEvent)) {
      return NextResponse.json(
        { error: 'Only internal flexible events can be deferred from mobile.' },
        { status: 400 },
      )
    }

    let startAt = body.start_at ? new Date(body.start_at) : null
    let endAt = body.end_at ? new Date(body.end_at) : null

    if (!startAt || !endAt || !Number.isFinite(startAt.getTime()) || !Number.isFinite(endAt.getTime()) || endAt <= startAt) {
      const schedule = await getDailyScheduleState({supabase:context.supabase,user:context.user,client:context.client,date:body.date})
      const duration =
        existing.estimated_duration_minutes ||
        existing.adjusted_duration_minutes ||
        minutesBetween(existing.start_at, existing.end_at)
      const windows = schedule.openWindows
      const nextWindow = firstValidWindow(windows, existing as ScheduleEvent, new Date(), duration)

      if (!nextWindow) {
        return NextResponse.json(
          { error: 'No valid open defer window was found today.' },
          { status: 409 },
        )
      }

      startAt = nextWindow.start
      endAt = nextWindow.end
    }

    if(startAt < new Date()) return NextResponse.json({error:'Choose a later time.'},{status:400})
    const schedule = await getDailyScheduleState({supabase:context.supabase,user:context.user,client:context.client,date:getClientLocalDate(context.client,startAt)})
    const conflict = scheduleConflict(schedule.events,id,startAt,endAt,schedule.preferences?.transitionMinutes)
    if(conflict) return NextResponse.json({error:conflict},{status:409})
    const { data, error } = await context.supabase
      .from('anastasis_schedule_events')
      .update({
        adjusted_start_at: startAt.toISOString(),
        adjusted_end_at: endAt.toISOString(),
        adjusted_duration_minutes: Math.round((endAt.getTime()-startAt.getTime())/60000),
        status: 'scheduled',
        adaptive_reason: 'Deferred by user from the mobile command layer.',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', context.user.id)
      .select('*')
      .single()

    if (error) throw new Error(error.message)
    invalidateDailyPlan()
    return NextResponse.json({ success: true, event: data })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Event could not be deferred.' },
      { status: 500 },
    )
  }
}
