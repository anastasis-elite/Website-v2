import { dashboardApiError } from '@/lib/dashboard/apiError'
import { healthEventTypes } from '@/lib/schedule/actions'
import { invalidateDailyPlan } from '@/lib/dashboard/invalidateDailyPlan'
import { NextResponse } from 'next/server'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'

const editable = new Set([
  'title',
  'description',
  'event_type',
  'start_at',
  'end_at',
  'timezone',
  'all_day',
  'status',
  'completed_at',
  'flexibility_type',
  'priority',
  'required',
  'movable',
  'approval_required',
  'earliest_start_at',
  'latest_end_at',
  'preferred_time',
  'estimated_duration_minutes',
  'reschedule_allowed',
  'reschedule_requires_approval',
  'delegation_status',
  'delegation_notes',
])

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { supabase, user } = await getDashboardContext()
    const body = await request.json()
    const { data: existing, error: lookupError } = await supabase.from('anastasis_schedule_events').select('*').eq('id', id).eq('user_id', user.id).maybeSingle()
    if (lookupError) throw new Error(lookupError.message)
    if (!existing) return NextResponse.json({ error: 'Event not found.' }, { status: 404 })
    if (body.event_type && body.event_type !== existing.event_type &&
      (healthEventTypes.has(existing.event_type) || healthEventTypes.has(body.event_type))) return NextResponse.json({ error: 'Keep this activity’s type and record completion through its activity page.' }, { status: 409 })
    if ((body.status === 'completed' || body.completed_at) && healthEventTypes.has(existing.event_type)) return NextResponse.json({ error: 'Open this activity to record what you did.' }, { status: 409 })
    if (['start_at','end_at'].some(key => key in body)) return NextResponse.json({ error: 'Use Move to later so conflicts and approvals can be checked.' }, { status: 409 })
    if (['skipped','cancelled'].includes(body.status) && (existing.flexibility_type !== 'flexible' || existing.approval_required)) return NextResponse.json({ error: 'Edit this commitment through its source or approval process.' }, { status: 409 })
    if (body.status && !['scheduled','completed','skipped','cancelled'].includes(body.status)) return NextResponse.json({ error: 'Invalid event status.' }, { status: 400 })
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }

    for (const [key, value] of Object.entries(body)) {
      if (!editable.has(key)) continue
      if (['start_at','end_at','completed_at','earliest_start_at','latest_end_at'].includes(key)) {
        update[key] = value ? new Date(String(value)).toISOString() : null
      } else {
        update[key] = value
      }
    }

    if (update.flexibility_type === 'fixed') {
      update.movable = false
      update.approval_required = true
      update.required = true
    }

    if (update.status === 'completed' && !update.completed_at) {
      update.completed_at = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('anastasis_schedule_events')
      .update(update)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*')
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) return NextResponse.json({ error: 'Event not found.' }, { status: 404 })

    invalidateDailyPlan()

    return NextResponse.json({ success: true, event: data })
  } catch (error) {
    return dashboardApiError(error, 'Schedule event could not be updated.')
  }
}
