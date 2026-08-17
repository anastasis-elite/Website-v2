import { NextResponse } from 'next/server'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { supabase, user } = await getDashboardContext()
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
    return NextResponse.json({ success: true, event: data })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Event could not be completed.' },
      { status: 500 },
    )
  }
}
