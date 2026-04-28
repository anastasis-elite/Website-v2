import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const data = await req.json()

    const webhookUrl = process.env.N8N_ASSESSMENT_WEBHOOK_URL

    const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          },
        body: JSON.stringify(payload),
      })
    

    const text = await response.text()

    let parsed: { redirect?: string; error?: string } = {}

    try {
      parsed = text ? JSON.parse(text) : {}
    } catch {
      parsed = {}
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: 'n8n webhook failed', details: parsed },
        { status: response.status }
      )
    }

    return NextResponse.json({
      success: true,
      ...parsed,
    })
  } catch (error) {
    console.error('Apply API error:', error)

    return NextResponse.json(
      { error: 'Application submission failed' },
      { status: 500 }
    )
  }
}
