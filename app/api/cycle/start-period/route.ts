import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const body = await req.json()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { client_id } = body

    if (!client_id) {
      return NextResponse.json(
        { error: 'Missing client_id' },
        { status: 400 }
      )
    }

    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('client_id, auth_user_id')
      .eq('client_id', client_id)
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (clientError) {
      return NextResponse.json({ error: clientError.message }, { status: 500 })
    }

    if (!client) {
      return NextResponse.json(
        { error: 'Client not found for this user' },
        { status: 404 }
      )
    }

    const today = new Date().toISOString().split('T')[0]

    const { error: logError } = await supabase
      .from('cycle_logs')
      .upsert(
        {
          client_id,
          auth_user_id: user.id,
          log_date: today,
          cycle_day: 1,
          cycle_phase: 'menstrual',
          period_started: true,
          bleeding: 'started',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'client_id,log_date',
        }
      )

    if (logError) {
      return NextResponse.json({ error: logError.message }, { status: 500 })
    }

    const { error: clientUpdateError } = await supabase
      .from('clients')
      .update({
        last_period_start: today,
        updated_at: new Date().toISOString(),
      })
      .eq('client_id', client_id)
      .eq('auth_user_id', user.id)

    if (clientUpdateError) {
      return NextResponse.json(
        { error: clientUpdateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      cycle_day: 1,
      log_date: today,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Could not start cycle',
      },
      { status: 500 }
    )
  }
}
