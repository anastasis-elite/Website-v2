import { NextResponse } from 'next/server'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { supabase, user } = await getDashboardContext()
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
    if (existing.flexibility_type !== 'flexible' || !existing.movable || existing.approval_required) {
      return NextResponse.json({ error: 'Only movable flexible events can be deferred.' }, { status: 400 })
    }
    if (!startAt || !endAt || endAt <= startAt) {
      return NextResponse.json({ error: 'A valid defer window is required.' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('anastasis_schedule_events')
      .update({
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
        status: 'scheduled',
        adaptive_reason: 'Deferred by user from the adaptive schedule interface.',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*')
      .single()

    if (error) throw new Error(error.message)
    return NextResponse.json({ success: true, event: data })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Event could not be deferred.' },
      { status: 500 },
    )
  }
}
