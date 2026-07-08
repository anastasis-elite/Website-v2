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
    if(!body.birthdate||!body.addressLine1||!body.city||!body.state||!body.postalCode){return NextResponse.json({error:'Birthdate and complete address are required before opening the dashboard.'},{status:400})}

    const { data:updatedClient,error } = await supabase
      .from('clients')
      .update({
  birthdate: body.birthdate || null,
  address_line_1: body.addressLine1 || null,
  address_line_2: body.addressLine2 || null,
  city: body.city || null,
  state: body.state || null,
  postal_code: body.postalCode || null,
  country: body.country || 'US',

  timezone: getTimezoneFromState(body.state),

  reproductive_status: body.reproductiveStatus || 'cycling',
  six_month_cycle_status: body.sixMonthCycleStatus || null,
  last_period_start: body.lastPeriodStart || null,
  average_cycle_length: Number(body.averageCycleLength || 28),

  onboarding_data: {
    ...body,
    timezone: getTimezoneFromState(body.state),
  },

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
      .select('*')
      .maybeSingle()

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }
    if(!updatedClient)return NextResponse.json({error:'Client profile was not found.'},{status:404})
    const { error: snapshotError } = await supabase.from('client_onboarding_snapshots').insert({
      user_id: user.id,
      client_id: updatedClient.client_id,
      onboarding_version: 'v1',
      snapshot: {
        submitted: body,
        client: {
          birthdate: updatedClient.birthdate,
          address_line_1: updatedClient.address_line_1,
          address_line_2: updatedClient.address_line_2,
          city: updatedClient.city,
          state: updatedClient.state,
          postal_code: updatedClient.postal_code,
          reproductive_status: updatedClient.reproductive_status,
          last_period_start: updatedClient.last_period_start,
          average_cycle_length: updatedClient.average_cycle_length,
        },
      },
    })
    if (snapshotError && snapshotError.code !== '23505') return NextResponse.json({ error: snapshotError.message }, { status: 500 })
    
    return NextResponse.json({ success: true,redirect:`/dashboard/program/${updatedClient.program||'ignite'}` })
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
