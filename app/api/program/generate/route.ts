import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const webhookUrl = process.env.N8N_PROGRAM_GENERATION_WEBHOOK

    if (!webhookUrl) {
      return NextResponse.json(
        { error: 'Missing program generation webhook URL' },
        { status: 500 }
      )
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: body.client_id,
        program: body.program,
        fullName: body.fullName,
        email: body.email,
        source: 'plan-processing-page',
        timestamp: new Date().toISOString(),
      }),
    })

    const data = await response.json().catch(() => null)

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Program generation failed', details: data },
        { status: response.status }
      )
    }

    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Program generation route failed' },
      { status: 500 }
    )
  }
}
