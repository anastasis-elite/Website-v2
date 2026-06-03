import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTimezoneFromState } from '@/lib/timezone'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const body = await req.json()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await supabase
      .from('clients')
      .update({
        birthdate: body.birthdate || null,
        address_line_1: body.addressLine1 || null,
        address_line_2: body.addressLine2 || null,
        city: body.city || null,
        state: body.state || null,
        postal_code: body.postalCode || null,
        country: body.country || 'US',
        reproductive_status: body.reproductiveStatus || 'cycling',
        six_month_cycle_status: body.sixMonthCycleStatus || null,
        last_period_start: body.lastPeriodStart || null,
        average_cycle_length: Number(body.averageCycleLength || 28),
        onboarding_data: body,
        cycle_tracking_enabled:
          body.reproductiveStatus === 'cycling' ||
          body.reproductiveStatus === 'irregular_cycles',
        onboarding_completed: true,
        onboarding_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_six_cycle_starts: body.knowsLastSixCycles
  ? [
      body.cycleStart1,
      body.cycleStart2,
      body.cycleStart3,
      body.cycleStart4,
      body.cycleStart5,
      body.cycleStart6,
    ].filter(Boolean)
  : null,
      })
      .eq('auth_user_id', user.id)

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    timezone: getTimezoneFromState(body.state),
onboarding_data: {
  ...body,
  timezone: getTimezoneFromState(body.state),
},
    
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Onboarding failed',
      },
      { status: 500 }
    )
  }
}
