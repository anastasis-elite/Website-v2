import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const webhookUrl = process.env.N8N_ASSESSMENT_WEBHOOK_URL

    if (!webhookUrl) {
      return NextResponse.json(
        { error: 'Missing assessment webhook URL' },
        { status: 500 }
      )
    }

    const payload = {
      ...body,
      source: 'dashboard-assessment',
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
        { error: `Assessment webhook failed: ${text}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      redirect: `/dashboard/assessment/start2?program=${body.program || ''}`,
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
