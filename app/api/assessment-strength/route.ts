import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
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

    const assessmentWebhookUrl = process.env.N8N_ASSESSMENT2_WEBHOOK_URL
    const programGenerateWebhookUrl =
      process.env.N8N_PROGRAM_GENERATE_WEBHOOK_URL

    if (!assessmentWebhookUrl || !programGenerateWebhookUrl) {
      return NextResponse.json(
        { error: 'Missing n8n webhook URL.' },
        { status: 500 }
      )
    }

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
    
    const assessmentResponse = await fetch(assessmentWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(trustedPayload),
    })

    const assessmentText = await assessmentResponse.text()
    const assessmentData = assessmentText ? JSON.parse(assessmentText) : null

    if (!assessmentResponse.ok) {
      return NextResponse.json(
        {
          error: 'Assessment save failed',
          details: assessmentData,
        },
        { status: assessmentResponse.status }
      )
    }

    const generationResponse = await fetch(programGenerateWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...trustedPayload,
        source: 'assessment-strength-complete',
        timestamp: new Date().toISOString(),
      }),
    })

    const generationText = await generationResponse.text()
    const generationData = generationText ? JSON.parse(generationText) : null

    if (!generationResponse.ok) {
      return NextResponse.json(
        {
          error: 'Program generation failed',
          details: generationData,
        },
        { status: generationResponse.status }
      )
    }

    const { data: initialAssessment } = await supabase
  .from('assessments')
  .select('*')
  .eq('client_id', client.client_id)
  .eq('assessment_type', 'initial')
  .order('submitted_at', { ascending: false })
  .limit(1)
  .maybeSingle()

const { data: strengthAssessment } = await supabase
  .from('assessments')
  .select('*')
  .eq('client_id', client.client_id)
  .eq('assessment_type', 'strength')
  .order('submitted_at', { ascending: false })
  .limit(1)
  .maybeSingle()

const programJson = {
  client_id: client.client_id,
  program: client.program,
  generated_at: new Date().toISOString(),
  status: 'pending_calculation',
  initial_assessment: initialAssessment?.data || null,
  strength_assessment: strengthAssessment?.data || null,
  days: [],
}

const { error: programOutputError } = await supabase
  .from('program_outputs')
  .insert({
    client_id: client.client_id,
    auth_user_id: user.id,
    program: client.program,
    status: 'pending_calculation',
    program_json: programJson,
    generated_at: new Date().toISOString(),
  })

if (programOutputError) {
  return NextResponse.json(
    { error: programOutputError.message },
    { status: 500 }
  )
}

    return NextResponse.json({
  success: true,
  redirect: '/dashboard/program',
  assessment: assessmentData,
  generation: generationData,
})
    
    return NextResponse.json({
      success: true,
      redirect: '/dashboard/program',
      assessment: assessmentData,
      generation: generationData,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Assessment strength route failed',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
