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
