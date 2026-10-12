import { dashboardApiError } from '@/lib/dashboard/apiError'
import { scheduleConflict } from '@/lib/schedule/actions'
import { getDailyScheduleState } from '@/lib/schedule/service'
import { getClientLocalDate } from '@/lib/timezone'
import { invalidateDailyPlan } from '@/lib/dashboard/invalidateDailyPlan'
import { NextResponse } from 'next/server'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { supabase, user, client } = await getDashboardContext()
    const body = await request.json()
    const startAt = body.start_at ? new Date(body.start_at) : null
    const endAt = body.end_at ? new Date(body.end_at) : null

    const { data: existing, error: lookupError } = await supabase
      .from('anastasis_schedule_events')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (lookupError) throw new Error(lookupError.message)
    if (!existing) return NextResponse.json({ error: 'Event not found.' }, { status: 404 })
    if (['completed', 'skipped', 'cancelled'].includes(existing.status)) return NextResponse.json({ error: 'This event is already finished. Review its outcome before changing its time.' }, { status: 409 })
    if (existing.flexibility_type !== 'flexible' || !existing.movable || existing.approval_required) {
      return NextResponse.json({ error: 'Only movable flexible events can be deferred.' }, { status: 400 })
    }
    if (!startAt || !endAt || !Number.isFinite(startAt.getTime()) || !Number.isFinite(endAt.getTime()) || endAt <= startAt || startAt < new Date()) {
      return NextResponse.json({ error: 'A valid defer window is required.' }, { status: 400 })
    }

    const schedule = await getDailyScheduleState({ supabase, user, client, date: getClientLocalDate(client, startAt) })
    const conflict = scheduleConflict(schedule.events, id, startAt, endAt, schedule.preferences?.transitionMinutes)
    if (conflict) return NextResponse.json({ error: conflict }, { status: 409 })
    const { data, error } = await supabase
      .from('anastasis_schedule_events')
      .update({
        adjusted_start_at: startAt.toISOString(),
        adjusted_end_at: endAt.toISOString(),
        adjusted_duration_minutes: Math.round((endAt.getTime()-startAt.getTime())/60000),
        status: 'scheduled',
        adaptive_reason: 'Deferred by user from the adaptive schedule interface.',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*')
      .single()

    if (error) throw new Error(error.message)
    invalidateDailyPlan()
    return NextResponse.json({ success: true, event: data })
  } catch (error) {
    return dashboardApiError(error, 'Event could not be deferred.')
  }
}
