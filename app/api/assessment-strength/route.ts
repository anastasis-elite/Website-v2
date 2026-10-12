import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateProgram } from '@/lib/program/generateProgram'
import { evaluateSafetyEscalation } from '@/lib/safety/evaluateSafetyEscalation'
import { invalidateDailyPlan } from '@/lib/dashboard/invalidateDailyPlan'

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
        { error: 'You must be logged in to submit this assessment.' },
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
      || !Number.isFinite(Number(body.weight)) || Number(body.weight) <= 0
      || !Number.isFinite(Number(body.height_in)) || Number(body.height_in) <= 0) {
      return NextResponse.json({ error: 'Enter your current weight in pounds and height in inches for your starting nutrition guidance.' }, { status: 400 })
    }
    const lifts = ['shoulder_press', 'squat', 'bench_press', 'close_grip_press', 'romanian_deadlift', 'seated_row', 'bicep_curl', 'lateral_raise']
    for (const lift of lifts) {
      const weight = body[`${lift}_weight`], reps = body[`${lift}_reps`]
      const provided = weight !== undefined && weight !== '' || reps !== undefined && reps !== ''
      if (provided && (weight === undefined || weight === '' || reps === undefined || reps === ''
        || !Number.isFinite(Number(weight)) || Number(weight) < 0
        || !Number.isInteger(Number(reps)) || Number(reps) < 1 || Number(reps) > 100)) {
        return NextResponse.json({ error: 'For each strength test you record, enter a nonnegative load and a positive whole-number repetition count. Leave untested movements blank.' }, { status: 400 })
      }
    }
    const [initialResult, profileResult] = await Promise.all([
      supabase.from('assessments').select('*').eq('client_id', client.client_id).eq('assessment_type', 'initial').order('submitted_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('client_current_profiles').select('*').eq('client_id', client.client_id).eq('user_id', user.id).maybeSingle(),
    ])
    if (initialResult.error || profileResult.error) return NextResponse.json({ error: 'Your saved member assessment could not be loaded. Please try again.' }, { status: 503 })
    if (!initialResult.data) return NextResponse.json({ error: 'Complete the initial member assessment before the strength baseline.', redirect: '/dashboard/assessment/start' }, { status: 409 })
    const effectiveClient = profileResult.data ? { ...client, ...profileResult.data, auth_user_id: user.id } : client

    const trustedPayload = {
      client_id: client.client_id,
      auth_user_id: user.id,
      fullName: client.full_name || '',
      email: client.email || client.login_email || '',
      birthdate: client.birthdate || '',
      program: client.program || '',
      assessment_type: 'strength',
      data: body,
      source: 'strength-assessment',
      submittedAt: new Date().toISOString(),
    }

    const { error: assessmentInsertError } = await supabase
  .from('assessments')
  .insert({
    client_id: trustedPayload.client_id,
auth_user_id: trustedPayload.auth_user_id,
program: trustedPayload.program,
assessment_type: trustedPayload.assessment_type,
data: trustedPayload.data,
source: trustedPayload.source,
submitted_at: trustedPayload.submittedAt,
  })

if (assessmentInsertError) {
  return NextResponse.json(
    { error: assessmentInsertError.message },
    { status: 500 }
  )
}

    invalidateDailyPlan()
    const safetyFlags = evaluateSafetyEscalation({ client: effectiveClient, initialAssessment: initialResult.data.data, strengthAssessment: body })
    if (safetyFlags.length) return NextResponse.json({ error: 'Program generation paused for a safety signal. Seek appropriate care before continuing.', safetyFlags }, { status: 409 })
    const { error: profileError } = await supabase.from('client_current_profiles').upsert({
      user_id: user.id,
      client_id: client.client_id,
      current_weight: Number(body.weight),
      updated_at: trustedPayload.submittedAt,
    }, { onConflict: 'client_id' })
    if (profileError) return NextResponse.json({ error: 'Your strength baseline was saved, but the current profile could not be updated. Please try again.' }, { status: 503 })

const generatedProgram = generateProgram({
  client: effectiveClient,
  initialAssessment: initialResult.data.data,
  strengthAssessment: body,
})

const { error: programOutputError } = await supabase
  .from('program_outputs')
  .insert({
    client_id: client.client_id,
    auth_user_id: user.id,
    program: client.program,
    status: 'generated',
    program_json: generatedProgram,
    generated_at: new Date().toISOString(),
  })

if (programOutputError) {
  return NextResponse.json(
    { error: 'Your strength assessment is saved, but the plan could not be saved. Retry plan creation from your saved assessments.', baselineSaved: true, retryRoute: '/dashboard/onboarding/plan' },
    { status: 500 }
  )
}

    return NextResponse.json({
  success: true,
  redirect: '/dashboard/program',
  program: generatedProgram,
})
  }    
  catch (error) {
    return NextResponse.json(
      {
        error: 'Assessment strength route failed',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
