import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const webhookUrl = process.env.N8N_PROGRAM_GENERATE_WEBHOOK_URL

    if (!webhookUrl) {
      return NextResponse.json({
        error: 'Missing webhook URL env',
      })
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: 'TEST123',
        program: 'ignite',
        fullName: 'Test User',
        email: 'test@test.com',
        source: 'manual-get-test',
      }),
    })

    const text = await response.text()

    return NextResponse.json({
      success: response.ok,
      status: response.status,
      response: text,
    })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const webhookUrl = process.env.N8N_PROGRAM_GENERATE_WEBHOOK_URL

    if (!webhookUrl) {
      return NextResponse.json(
        { error: 'Missing N8N_PROGRAM_GENERATE_WEBHOOK_URL' },
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
        source: 'program-generate-route',
        timestamp: new Date().toISOString(),
      }),
    })

    const text = await response.text()

    let parsed = null
    try {
      parsed = text ? JSON.parse(text) : null
    } catch {
      parsed = { raw: text }
    }

    return NextResponse.json({
      success: response.ok,
      n8n_status: response.status,
      n8n_response: parsed,
      sent: {
        client_id: body.client_id,
        program: body.program,
        fullName: body.fullName,
        email: body.email,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Program generation route failed',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
