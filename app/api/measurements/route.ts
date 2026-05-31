import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const {
      client_id,
      advanced_enabled,
      measurements,
      notes,
    } = body

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
      return NextResponse.json(
        { error: clientError.message },
        { status: 500 }
      )
    }

    if (!client) {
      return NextResponse.json(
        { error: 'Client not found for this user' },
        { status: 404 }
      )
    }

    const today = new Date().toISOString().split('T')[0]

    const cleanMeasurements =
      measurements &&
      typeof measurements === 'object' &&
      !Array.isArray(measurements)
        ? measurements
        : {}

    const { error: upsertError } = await supabase
      .from('measurement_logs')
      .upsert(
        {
          client_id,
          auth_user_id: user.id,
          log_date: today,
          advanced_enabled: !!advanced_enabled,
          measurements: cleanMeasurements,
          notes:
            typeof notes === 'string' && notes.trim()
              ? notes.trim()
              : null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'client_id,log_date',
        }
      )

    if (upsertError) {
      return NextResponse.json(
        { error: upsertError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      log_date: today,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Measurements could not be saved',
      },
      { status: 500 }
    )
  }
}
