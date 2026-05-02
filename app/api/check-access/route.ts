import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const webhookUrl = process.env.N8N_CHECK_ACCESS_WEBHOOK_URL

    if (!webhookUrl) {
      return NextResponse.json(
        { error: 'Missing check access webhook URL' },
        { status: 500 }
      )
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: body.client_id || '',
        email: body.email || '',
        program: body.program || '',
        source: 'dashboard-access-check',
        checkedAt: new Date().toISOString(),
      }),
    })

    const data = await response.json().catch(() => null)

    if (!response.ok) {
      return NextResponse.json(
        { error: data?.error || 'Access check failed' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      access: Boolean(data?.access),
      client_id: data?.client_id || body.client_id || '',
      email: data?.email || body.email || '',
      program: data?.program || body.program || '',
      verified_purchase: Boolean(data?.verified_purchase),
      subscription_status: data?.subscription_status || '',
      redirect: data?.redirect || '',
    })
  } catch (error) {
    console.error('CHECK ACCESS ERROR:', error)

    const message =
      error instanceof Error ? error.message : 'Unable to check access'

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
