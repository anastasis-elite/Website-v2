import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getMonthlyAssessmentStatus } from '@/lib/assessment/getMonthlyAssessmentStatus'
import { isAOSAdmin } from '@/lib/aos/isAOSAdmin'
import { invalidateDailyPlan } from '@/lib/dashboard/invalidateDailyPlan'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    const supabase = await createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'You must be logged in to submit an assessment.' },
        { status: 401 }
      )
    }

    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('auth_user_id', user.id)
      .single()

    if (clientError || !client) {
      return NextResponse.json(
        { error: 'Client profile not found.' },
        { status: 404 }
      )
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)
      || !Number.isInteger(Number(body.trainingDays)) || Number(body.trainingDays) < 1 || Number(body.trainingDays) > 7
      || !['commercial-gym', 'home-gym', 'dumbbells-bands', 'bodyweight'].includes(body.equipmentAccess)
      || !['beginner', 'some-experience', 'consistent', 'advanced'].includes(body.experienceLevel)
      || !['recomposition', 'fat-loss', 'muscle-building', 'strength', 'glutes-shape', 'stage-prep', 'energy-regulation'].includes(body.primaryFocus)
      || typeof body.currentLimitations !== 'string' || !body.currentLimitations.trim()
      || !['low', 'moderate', 'high'].includes(body.recoveryCapacity)
      || !['poor', 'inconsistent', 'decent', 'strong'].includes(body.sleepQuality)
      || !['low', 'moderate', 'high', 'very-high'].includes(body.stressLevel)
      || !['walking', 'incline-walk', 'stair-stepper', 'bike', 'running', 'minimal'].includes(body.cardioPreference)) {
      return NextResponse.json({ error: 'Complete the required member assessment fields before continuing.' }, { status: 400 })
    }

    const payload = {
      client_id: client.client_id,
      auth_user_id: user.id,
      fullName: client.full_name || '',
      email: client.email || client.login_email || '',
      birthdate: client.birthdate || '',
      program: client.program || '',
      assessment_type: body.assessmentType === 'monthly' ? 'monthly' : 'initial',
      data: body,
      source: 'dashboard-assessment',
      submittedAt: new Date().toISOString(),
    }

    if (payload.assessment_type === 'monthly') {
      const status = await getMonthlyAssessmentStatus(supabase, client.client_id)
      const adminOverride = body.adminOverride === true && isAOSAdmin(user.email)
      if (!status.due && !adminOverride) {
        return NextResponse.json({ error: 'Your monthly assessment is already complete. It will reopen 30 days after the last submission.', nextDueAt: status.lastCompletedAt ? new Date(new Date(status.lastCompletedAt).getTime() + 30 * 86400000).toISOString() : null }, { status: 409 })
      }
    }

    const { error: assessmentInsertError } = await supabase
  .from('assessments')
  .insert({
    client_id: payload.client_id,
    auth_user_id: payload.auth_user_id,
    program: payload.program,
    assessment_type: payload.assessment_type,
    data: payload.data,
    source: payload.source,
    submitted_at: payload.submittedAt,
  })

if (assessmentInsertError) {
  return NextResponse.json(
    { error: assessmentInsertError.message },
    { status: 500 }
  )
}

    const equipment: Record<string, string[]> = {
      'commercial-gym': ['commercial gym'],
      'home-gym': ['home gym'],
      'dumbbells-bands': ['dumbbell', 'band'],
      bodyweight: ['bodyweight'],
    }
    const limitation = String(body.currentLimitations).trim()
    const { error: profileError } = await supabase.from('client_current_profiles').upsert({
      user_id: user.id,
      client_id: client.client_id,
      equipment_access: equipment[body.equipmentAccess],
      limitations: /^(none|no limitations|n\/a)$/i.test(limitation) ? [] : [limitation],
      primary_goal: String(body.primaryFocus).trim(),
      workout_days_available: Number(body.trainingDays),
      updated_at: payload.submittedAt,
    }, { onConflict: 'client_id' })
    if (profileError) return NextResponse.json({ error: 'Your assessment was saved, but the current training profile could not be updated. Please try again.' }, { status: 503 })
    invalidateDailyPlan()

    return NextResponse.json({
      success: true,
      redirect: payload.assessment_type === 'monthly' ? '/dashboard/assessment/monthly' : '/dashboard/assessment/start2',
    })
  } catch (error) {
    console.error('ASSESSMENT API ERROR:', error)

    const message =
      error instanceof Error ? error.message : 'Assessment submission failed'

    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
