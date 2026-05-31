import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function getCycleDayAndPhase({
  lastPeriodStart,
  averageCycleLength,
}: {
  lastPeriodStart: string | null
  averageCycleLength: number
}) {
  if (!lastPeriodStart) {
    return {
      cycleDay: null,
      cyclePhase: null,
    }
  }

  const today = new Date()
  const lastStart = new Date(lastPeriodStart)

  const msPerDay = 1000 * 60 * 60 * 24

  const daysSinceStart =
    Math.floor(
      (today.getTime() - lastStart.getTime()) / msPerDay
    ) + 1

  const cycleLength = Number(averageCycleLength || 28)

  const cycleDay = daysSinceStart

let cyclePhase = 'follicular'

if (cycleDay > cycleLength + 3) {
  cyclePhase = 'extended_cycle'
} else if (cycleDay <= 5) {
  cyclePhase = 'menstrual'
} else if (cycleDay <= 13) {
  cyclePhase = 'follicular'
} else if (cycleDay <= 16) {
  cyclePhase = 'ovulatory'
} else {
  cyclePhase = 'luteal'
}

  return {
    cycleDay,
    cyclePhase,
  }
}

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
      cycle_tracking_enabled,
      last_period_start,
      average_cycle_length,
      bleeding,
      cramps,
      headache,
      fatigue,
      mood_sensitivity,
      notes,
    } = body

    if (!client_id) {
      return NextResponse.json(
        { error: 'Missing client_id' },
        { status: 400 }
      )
    }

    const { data: client, error: clientLookupError } = await supabase
      .from('clients')
      .select('id, client_id, auth_user_id')
      .eq('client_id', client_id)
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (clientLookupError) {
      return NextResponse.json(
        { error: clientLookupError.message },
        { status: 500 }
      )
    }

    if (!client) {
      return NextResponse.json(
        { error: 'Client not found for this user' },
        { status: 404 }
      )
    }

    const averageCycleLength = Number(
      average_cycle_length || 28
    )

    const { cycleDay, cyclePhase } =
      getCycleDayAndPhase({
        lastPeriodStart: last_period_start || null,
        averageCycleLength,
      })

    const today = new Date().toISOString().split('T')[0]

    const { error: clientUpdateError } = await supabase
      .from('clients')
      .update({
        cycle_tracking_enabled: !!cycle_tracking_enabled,
        last_period_start: last_period_start || null,
        average_cycle_length: averageCycleLength,
      })
      .eq('client_id', client_id)
      .eq('auth_user_id', user.id)

    if (clientUpdateError) {
      return NextResponse.json(
        { error: clientUpdateError.message },
        { status: 500 }
      )
    }

    const { error: logError } = await supabase
      .from('cycle_logs')
      .upsert(
        {
          client_id,
          auth_user_id: user.id,
          log_date: today,

          cycle_day: cycleDay,
          cycle_phase: cyclePhase,

          bleeding: !!bleeding,
          cramps: !!cramps,
          headache: !!headache,
          fatigue: !!fatigue,
          mood_sensitivity: !!mood_sensitivity,

          notes: notes || null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'client_id,log_date',
        }
      )

    if (logError) {
      return NextResponse.json(
        { error: logError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      cycle_day: cycleDay,
      cycle_phase: cyclePhase,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Cycle save failed',
      },
      { status: 500 }
    )
  }
}
