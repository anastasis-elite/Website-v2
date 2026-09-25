import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseJsonObject, safeErrorResponse } from '@/lib/security/http'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const body = parseJsonObject(await req.json().catch(() => null))
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return safeErrorResponse('Unauthorized', 401)

    const clientId = body.client_id || body.clientId
    const dayName = body.day_name || body.dayName

    if (!clientId) {
      return NextResponse.json(
        { error: 'Missing client_id.' },
        { status: 400 }
      )
    }

    const { data: client } = await supabase
      .from('clients')
      .select('client_id')
      .eq('client_id', clientId)
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (!client) {
      return NextResponse.json(
        { error: 'Client not found.' },
        { status: 404 }
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
        { error: 'Unable to load program.' },
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
    return safeErrorResponse('Workout route failed', 500, error)
  }
}
