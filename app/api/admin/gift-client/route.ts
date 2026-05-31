import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const {
      adminSecret,
      fullName,
      email,
      phone,
      program,
      durationMonths,
    } = body

    if (
      adminSecret !== process.env.ADMIN_GIFT_SECRET
    ) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL

    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SECRET_KEY

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Missing Supabase env vars' },
        { status: 500 }
      )
    }

    const supabase = createClient(
      supabaseUrl,
      supabaseKey
    )

    const clientId = `AN-${Date.now()}`

    const months =
      Number(durationMonths || 12)

    const endsAt = new Date()

    endsAt.setMonth(
      endsAt.getMonth() + months
    )

    const payload = {
      client_id: clientId,
      full_name: fullName,
      email,
      login_email: email,
      phone,
      program,
      subscription_status: 'gifted',
      verified_purchase: true,
      access: true,
      active: true,
      subscription_started_at:
        new Date().toISOString(),
      subscription_ends_at:
        endsAt.toISOString(),
    }

    const { error } = await supabase
      .from('clients')
      .insert(payload)

    if (error) {
      return NextResponse.json(
        {
          error: error.message,
        },
        { status: 500 }
      )
    }

    const createLoginLink =
      `/create-login?client_id=${clientId}` +
      `&email=${encodeURIComponent(email)}` +
      `&program=${encodeURIComponent(program)}`

    return NextResponse.json({
      success: true,
      clientId,
      createLoginLink,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Gift client failed',
      },
      { status: 500 }
    )
  }
}
