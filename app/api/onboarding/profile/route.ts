import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTimezoneFromState } from '@/lib/timezone'
import { applyExplicitPreferences, getDefaultCommunicationProfile } from '@/lib/accountability/communicationProfile'
import { createPartnerPersona } from '@/lib/accountability/partnerPersona'
import { updateOwnedOnboardingData } from '@/lib/dashboard/updateOnboardingData'

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

    const { data: existing, error: clientError } = await supabase.from('clients').select('*').eq('auth_user_id', user.id).maybeSingle()
    if (clientError) return NextResponse.json({ error: 'Your profile could not be loaded.' }, { status: 503 })
    if (!existing) return NextResponse.json({ error: 'Client profile was not found.' }, { status: 404 })
    const [programResult, initialResult, strengthResult] = await Promise.all([
      supabase.from('program_outputs').select('id').eq('client_id', existing.client_id).eq('program', existing.program).limit(1).maybeSingle(),
      supabase.from('assessments').select('id').eq('client_id', existing.client_id).eq('assessment_type', 'initial').limit(1).maybeSingle(),
      supabase.from('assessments').select('id').eq('client_id', existing.client_id).eq('assessment_type', 'strength').limit(1).maybeSingle(),
    ])
    if (programResult.error || initialResult.error || strengthResult.error) {
      return NextResponse.json({ error: 'Your saved setup progress could not be loaded. Please try again.' }, { status: 503 })
    }
    // Profile completion opens the member assessment; it is not a completed training baseline.
    // Existing plans or strength baselines remain usable without repeating earlier assessments.
    const setupStep = programResult.data ? 'dashboard' : strengthResult.data ? 'plan_generation' : initialResult.data ? 'strength_assessment' : 'initial_assessment'
    const nextRoute = setupStep === 'initial_assessment' ? '/dashboard/assessment/start'
      : setupStep === 'strength_assessment' ? '/dashboard/assessment/start2'
      : setupStep === 'plan_generation' ? '/dashboard/onboarding/plan'
      : `/dashboard/program/${existing.program || 'ignite'}`
    const timezone = existing?.timezone || getTimezoneFromState(body.state)
    const completedAt = new Date().toISOString()
    const accountabilityPreferences = {
      supportPreference:
        typeof body.accountabilitySupportPreference === 'string'
          ? body.accountabilitySupportPreference
          : 'encourage_without_pressure',
    }

    const updateResult = await updateOwnedOnboardingData({
      supabase,
      userId: user.id,
      clientId: existing.client_id,
      fields: {
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

        execution_style: ['schedule','flow','hybrid'].includes(body.executionStyle) ? body.executionStyle : existing?.execution_style || 'flow',
        carousel_style: ['section','step'].includes(body.carouselStyle) ? body.carouselStyle : existing?.carousel_style || 'section',
        cycle_tracking_enabled:
          body.reproductiveStatus === 'cycling' ||
          body.reproductiveStatus === 'irregular_cycles',

        onboarding_completed: true,
        onboarding_completed_at: existing?.onboarding_completed_at || completedAt,
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
      },
      merge: current => ({ ...current, ...body, timezone, accountabilityPreferences }),
    })

    if (!updateResult.saved) {
      return NextResponse.json({ error: updateResult.status === 404 ? 'Client profile was not found.'
        : updateResult.status === 409 ? 'Another change was saved at the same time. Refresh and try again.'
        : 'Unable to save onboarding. Please try again.' }, { status: updateResult.status })
    }

    const communicationProfile = applyExplicitPreferences(
      getDefaultCommunicationProfile(),
      accountabilityPreferences,
    )
    const partnerPersona = createPartnerPersona({
      userId: user.id,
      clientId: existing.client_id,
      profile: communicationProfile,
    })

    const { error: profileError } = await supabase
      .from('client_current_profiles')
      .upsert(
        {
          user_id: user.id,
          client_id: existing.client_id,
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
      clientId: existing.client_id,
      onboardingCompleted: true,
      profileCompleted: true,
      baselineCompleted: Boolean(strengthResult.data),
      setupStep,
      redirect: nextRoute,
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
