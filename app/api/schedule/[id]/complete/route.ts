import { dashboardApiError } from '@/lib/dashboard/apiError'
import { invalidateDailyPlan } from '@/lib/dashboard/invalidateDailyPlan'
import { healthEventTypes } from '@/lib/schedule/actions'
import { getActionRouteForEvent } from '@/lib/schedule/engine'
import { NextResponse } from 'next/server'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { supabase, user, client } = await getDashboardContext()
    const { data: existing } = await supabase.from('anastasis_schedule_events').select('*').eq('id', id).eq('user_id', user.id).maybeSingle()
    if (!existing) return NextResponse.json({ error: 'Event not found.' }, { status: 404 })
    if (healthEventTypes.has(existing.event_type)) return NextResponse.json({ error: 'Open this activity and save what you did to complete it.', href: getActionRouteForEvent(existing, client.program) }, { status: 409 })
    if (['skipped', 'cancelled'].includes(existing.status)) return NextResponse.json({ error: 'This event is already finished. Review its recorded outcome.' }, { status: 409 })
    if (existing.status === 'completed') return NextResponse.json({ success: true, event: existing })
    const completedAt = new Date().toISOString()
    const { data, error } = await supabase
      .from('anastasis_schedule_events')
      .update({ status: 'completed', completed_at: completedAt, updated_at: completedAt })
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*')
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) return NextResponse.json({ error: 'Event not found.' }, { status: 404 })
    invalidateDailyPlan()
    return NextResponse.json({ success: true, event: data })
  } catch (error) {
    return dashboardApiError(error, 'Event could not be completed.')
  }
}
