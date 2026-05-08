import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const assessmentWebhookUrl = process.env.N8N_ASSESSMENT2_WEBHOOK_URL
    const programGenerateWebhookUrl = process.env.N8N_PROGRAM_GENERATE_WEBHOOK_URL

    if (!assessmentWebhookUrl) {
      return NextResponse.json(
        { error: 'Missing N8N_ASSESSMENT2_WEBHOOK_URL' },
        { status: 500 }
      )
    }

    if (!programGenerateWebhookUrl) {
      return NextResponse.json(
        { error: 'Missing N8N_PROGRAM_GENERATE_WEBHOOK_URL' },
        { status: 500 }
      )
    }

    // 1. Save assessment first
    const assessmentResponse = await fetch(assessmentWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const assessmentText = await assessmentResponse.text()

    let assessmentData: any = null
    try {
      assessmentData = assessmentText ? JSON.parse(assessmentText) : null
    } catch {
      assessmentData = { raw: assessmentText }
    }

    if (!assessmentResponse.ok) {
      return NextResponse.json(
        {
          error: 'Assessment save failed',
          details: assessmentData,
        },
        { status: assessmentResponse.status }
      )
    }

    // 2. Trigger program generation immediately after assessment saves
    const generationResponse = await fetch(programGenerateWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...body,
        source: 'assessment-strength-complete',
        timestamp: new Date().toISOString(),
      }),
    })

    const generationText = await generationResponse.text()

    let generationData: any = null
    try {
      generationData = generationText ? JSON.parse(generationText) : null
    } catch {
      generationData = { raw: generationText }
    }

    if (!generationResponse.ok) {
      return NextResponse.json(
        {
          error: 'Program generation failed',
          details: generationData,
        },
        { status: generationResponse.status }
      )
    }

    // 3. Send user to waiting page
    const redirect = `/dashboard/program/${encodeURIComponent(
      body.program
    )}/plan?program=${encodeURIComponent(
      body.program
    )}&client_id=${encodeURIComponent(
      body.client_id
    )}&fullName=${encodeURIComponent(
      body.fullName
    )}&email=${encodeURIComponent(
      body.email
    )}&birthdate=${encodeURIComponent(
      body.birthdate
    )}`

    return NextResponse.json({
      success: true,
      redirect,
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
