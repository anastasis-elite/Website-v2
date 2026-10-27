import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getMonthlyAssessmentStatus } from '@/lib/assessment/getMonthlyAssessmentStatus'
import { isAOSAdmin } from '@/lib/aos/isAOSAdmin'
import { memberSelections, validMemberSelections } from '@/lib/assessment/memberSelections'
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

    if (!validMemberSelections(body) || body.notes !== undefined && typeof body.notes !== 'string'
      || !['initial', 'monthly', 'quarterly', 'review'].includes(body.assessmentType)) {
      return NextResponse.json({ error: 'Complete the required member assessment fields before continuing.' }, { status: 400 })
    }
    // Legacy monthly form URLs/submissions are full assessments. The compact
    // review explicitly opts into its own record source and completion date.
    const kind = body.assessmentType === 'monthly' ? 'quarterly' : body.assessmentType
    const status = await getMonthlyAssessmentStatus(supabase, client)
    if (status.unavailable) return NextResponse.json({ error: 'Your saved assessment status could not be loaded. No new assessment was saved.' }, { status: 503 })
    const adminOverride = body.adminOverride === true && isAOSAdmin(user.email)
    if (kind === 'initial' && status.lastCompletedAt) {
      return NextResponse.json({ error: 'Your starting assessment is already saved. Use your assessment library for reviews.', redirect: '/dashboard/assessment' }, { status: 409 })
    }
    if (kind === 'review' && (status.dueKind !== 'review' || !status.lastCompletedAt)) {
      return NextResponse.json({ error: status.dueKind === 'quarterly' ? 'Your Quarterly Assessment is due. Complete the full assessment instead of a separate Monthly Review.' : 'Your Monthly Review is already up to date.', nextDueAt: status.nextReviewDueDate }, { status: 409 })
    }
    if (kind === 'quarterly' && status.dueKind !== 'quarterly' && !adminOverride) {
      return NextResponse.json({ error: 'Your Quarterly Assessment reopens three calendar months after the last full completion.', nextDueAt: status.nextFullDueDate }, { status: 409 })
    }
    const payload = {
      client_id: client.client_id, auth_user_id: user.id, program: client.program || '',
      assessment_type: kind === 'initial' ? 'initial' : 'monthly',
      data: { ...memberSelections(client, body), assessmentKind: kind },
      source: kind === 'review' ? 'monthly-review' : 'dashboard-assessment',
      submittedAt: new Date().toISOString(),
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
      redirect: kind === 'initial' ? '/dashboard/assessment/start2' : '/dashboard/assessment/monthly',
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
