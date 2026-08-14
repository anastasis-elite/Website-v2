import { NextResponse } from 'next/server'
import { getClientLocalDateOffset } from '@/lib/timezone'
import { createMobileRequestContext } from '@/lib/mobile/auth'

const allowed = new Set([
  'Breathing reset',
  'Mobility',
  'Walk',
  'Sauna',
  'Tub soak',
  'Full rest',
])

export async function POST(request: Request) {
  try {
    const context = await createMobileRequestContext(request)

    if ('error' in context) {
      return NextResponse.json(
        { error: context.error },
        { status: context.status },
      )
    }

    const body = await request.json().catch(() => ({}))
    const activityType = allowed.has(body.activityType)
      ? body.activityType
      : 'Breathing reset'
    const minutes =
      activityType === 'Full rest'
        ? null
        : Math.max(2, Math.min(90, Number(body.minutes || 5)))

    const { error } = await context.supabase
      .from('recovery_activity_logs')
      .insert({
        user_id: context.user.id,
        client_id: context.client.client_id,
        log_date: getClientLocalDateOffset(context.client),
        activity_type: activityType,
        duration_minutes: minutes,
      })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Recovery quick action failed.',
      },
      { status: 500 },
    )
  }
}
