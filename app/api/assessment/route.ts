import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

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
        { error: 'You must be logged in to submit an assessment.' },
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

    const webhookUrl = process.env.N8N_ASSESSMENT_WEBHOOK_URL

    if (!webhookUrl) {
      return NextResponse.json(
        { error: 'Missing assessment webhook URL' },
        { status: 500 }
      )
    }

    const payload = {
      client_id: client.client_id,
      auth_user_id: user.id,
      fullName: client.full_name || '',
      email: client.email || client.login_email || '',
      birthdate: client.birthdate || '',
      program: client.program || '',
      assessment_type: 'initial',
      data: body,
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
      redirect: '/dashboard/assessment/start2',
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
