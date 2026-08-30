import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTimezoneFromState } from '@/lib/timezone'
import { applyExplicitPreferences, getDefaultCommunicationProfile } from '@/lib/accountability/communicationProfile'
import { createPartnerPersona } from '@/lib/accountability/partnerPersona'

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

    if (
      !body.birthdate ||
      !body.addressLine1 ||
      !body.city ||
      !body.state ||
      !body.postalCode
    ) {
      return NextResponse.json(
        {
          error:
            'Birthdate and complete address are required before opening the dashboard.',
        },
        { status: 400 }
      )
    }

    const timezone = getTimezoneFromState(body.state)
    const completedAt = new Date().toISOString()
    const accountabilityPreferences = {
      supportPreference:
        typeof body.accountabilitySupportPreference === 'string'
          ? body.accountabilitySupportPreference
          : 'encourage_without_pressure',
    }

    const { data: updatedClient, error } = await supabase
      .from('clients')
      .update({
        birthdate: body.birthdate,
        address_line_1: body.addressLine1,
        address_line_2: body.addressLine2 || null,
        city: body.city,
        state: body.state,
        postal_code: body.postalCode,
        country: body.country || 'US',

        timezone,

        reproductive_status: body.reproductiveStatus || 'cycling',
        six_month_cycle_status: body.sixMonthCycleStatus || null,
        last_period_start: body.lastPeriodStart || null,
        average_cycle_length: Number(body.averageCycleLength || 28),

        onboarding_data: {
          ...body,
          timezone,
          accountabilityPreferences,
        },

        cycle_tracking_enabled:
          body.reproductiveStatus === 'cycling' ||
          body.reproductiveStatus === 'irregular_cycles',

        onboarding_completed: true,
        onboarding_completed_at: completedAt,
        updated_at: completedAt,

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
      console.error('ONBOARDING CLIENT UPDATE ERROR:', error)

      return NextResponse.json(
        {
          error: 'Unable to save onboarding.',
          details: error.message,
        },
        { status: 500 }
      )
    }

    if (!updatedClient) {
      return NextResponse.json(
        { error: 'Client profile was not found.' },
        { status: 404 }
      )
    }

    const communicationProfile = applyExplicitPreferences(
      getDefaultCommunicationProfile(),
      accountabilityPreferences,
    )
    const partnerPersona = createPartnerPersona({
      userId: user.id,
      clientId: updatedClient.client_id,
      profile: communicationProfile,
    })

    const { error: profileError } = await supabase
      .from('client_current_profiles')
      .upsert(
        {
          user_id: user.id,
          client_id: updatedClient.client_id,
          accountability_preferences: accountabilityPreferences,
          accountability_partner_persona: partnerPersona,
          accountability_communication_profile: communicationProfile,
          updated_at: completedAt,
        },
        { onConflict: 'client_id' },
      )

    if (profileError) {
      return NextResponse.json(
        {
          error: 'Profile saved, but accountability partner initialization failed.',
          details: profileError.message,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      clientId: updatedClient.client_id,
      onboardingCompleted: updatedClient.onboarding_completed,
      redirect: `/dashboard/program/${updatedClient.program || 'ignite'}`,
    })
  } catch (error) {
    console.error('ONBOARDING PROFILE ERROR:', error)

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Onboarding failed',
      },
      { status: 500 }
    )
  }
}
