import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export async function POST(req: Request) {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Missing Supabase server environment variables.' },
        { status: 500 }
      )
    }

    const body = await req.json()
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const clientId = body.client_id || body.clientId
    const dayName = body.day_name || body.dayName

    if (!clientId) {
      return NextResponse.json(
        { error: 'Missing client_id.' },
        { status: 400 }
      )
    }

    const { data: latestProgram, error } = await supabase
      .from('program_outputs')
      .select('*')
      .eq('client_id', clientId)
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      return NextResponse.json(
        { error: 'Unable to load program.', details: error.message },
        { status: 500 }
      )
    }

    if (!latestProgram?.output) {
      return NextResponse.json(
        { error: 'No generated program found for this client.' },
        { status: 404 }
      )
    }

    const output = latestProgram.output
    const days = output.days || []

    const selectedDay = dayName
      ? days.find(
          (day: any) =>
            String(day.day_name).toLowerCase() ===
            String(dayName).toLowerCase()
        )
      : days[0]

    if (!selectedDay) {
      return NextResponse.json(
        { error: 'Workout day not found.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      program: output.program,
      generated_at: output.generated_at || latestProgram.generated_at,
      day: selectedDay,
      exercises: selectedDay.exercises || [],
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Workout route failed',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
