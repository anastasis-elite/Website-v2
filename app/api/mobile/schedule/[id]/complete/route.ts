import { NextResponse } from 'next/server'
import { createMobileRequestContext } from '@/lib/mobile/auth'

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
    const { data: existing, error: lookupError } = await context.supabase
      .from('anastasis_schedule_events')
      .select('*')
      .eq('id', id)
      .eq('user_id', context.user.id)
      .maybeSingle()

    if (lookupError) throw new Error(lookupError.message)
    if (!existing) return NextResponse.json({ error: 'Event not found.' }, { status: 404 })
    if (
      existing.flexibility_type === 'fixed' &&
      (existing.external_event_id || existing.external_calendar_source)
    ) {
      return NextResponse.json(
        { error: 'Fixed external events require approval before mobile changes.' },
        { status: 400 },
      )
    }

    const completedAt = new Date().toISOString()
    const { data, error } = await context.supabase
      .from('anastasis_schedule_events')
      .update({
        status: 'completed',
        completed_at: completedAt,
        updated_at: completedAt,
      })
      .eq('id', id)
      .eq('user_id', context.user.id)
      .select('*')
      .single()

    if (error) throw new Error(error.message)
    return NextResponse.json({ success: true, event: data })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Event could not be completed.' },
      { status: 500 },
    )
  }
}
