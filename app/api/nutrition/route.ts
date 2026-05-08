import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)

    const client_id = searchParams.get('client_id') || ''
    const program = searchParams.get('program') || ''

    const webhookUrl = process.env.N8N_NUTRITION_WEBHOOK_URL

    if (!webhookUrl) {
      return NextResponse.json(
        { error: 'Missing N8N_NUTRITION_WEBHOOK_URL' },
        { status: 500 }
      )
    }

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id,
        program,
        source: 'dashboard-nutrition',
        timestamp: new Date().toISOString(),
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      return NextResponse.json(
        { error: 'Nutrition lookup failed', details: data },
        { status: res.status }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Nutrition route failed',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
