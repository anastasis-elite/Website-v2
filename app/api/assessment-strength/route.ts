import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const webhookUrl = process.env.N8N_ASSESSMENT2_WEBHOOK_URL

    if (!webhookUrl) {
      return NextResponse.json(
        { error: 'Missing assessment 2 webhook URL' },
        { status: 500 }
      )
    }

    const payload = {
      ...body,
      source: 'dashboard-assessment-strength',
      submittedAt: new Date().toISOString(),
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const text = await response.text()

      return NextResponse.json(
        { error: `Assessment 2 webhook failed: ${text}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      redirect: `/dashboard/plan?program=${body.program || ''}`,
    })
  } catch (error) {
    console.error('ASSESSMENT 2 API ERROR:', error)

    const message =
      error instanceof Error
        ? error.message
        : 'Assessment 2 submission failed'

    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
