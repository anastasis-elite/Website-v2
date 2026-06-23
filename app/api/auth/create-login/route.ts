import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseSecretKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SECRET_KEY

    if (!supabaseUrl || !supabaseSecretKey) {
      return NextResponse.json(
        { error: 'Missing Supabase server environment variables.' },
        { status: 500 }
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const { email, password, client_id, program } = await req.json()
    const normalizedEmail = String(email || '').trim().toLowerCase()

    if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address.' },
        { status: 400 }
      )
    }

    if (!password || password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters.' },
        { status: 400 }
      )
    }

    if (!client_id) {
      return NextResponse.json(
        { error: 'Missing client reference.' },
        { status: 400 }
      )
    }

    const { data: userData, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: {
          client_id,
          program,
        },
      })

    if (createError) {
      return NextResponse.json(
        { error: createError.message },
        { status: 400 }
      )
    }

    const userId = userData.user?.id

    if (!userId) {
      return NextResponse.json(
        { error: 'User was not created.' },
        { status: 500 }
      )
    }

    const { error: updateClientError } = await supabaseAdmin
      .from('clients')
      .update({
        auth_user_id: userId,
        login_email: normalizedEmail,
        updated_at: new Date().toISOString(),
      })
      .eq('client_id', client_id)

    if (updateClientError) {
      return NextResponse.json(
        { error: updateClientError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      user_id: userId,
      redirect: `/dashboard/assessment/start?program=${encodeURIComponent(
        program || ''
      )}&client_id=${encodeURIComponent(
        client_id
      )}&email=${encodeURIComponent(normalizedEmail)}`,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to create login.'

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
