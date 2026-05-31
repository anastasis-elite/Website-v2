import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function cleanTime(value: unknown) {
  if (!value || typeof value !== 'string') return null
  return value.trim() || null
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
      execution_style,
      carousel_style,
      wake_time,
      bed_time,
      work_start_time,
      work_end_time,
      preferred_workout_time,
      school_dropoff_time,
      school_pickup_time,
      lunch_window_time,
      dinner_window_time,
      daily_non_negotiables,
      day_structure_notes,
    } = body

    if (!client_id) {
      return NextResponse.json(
        { error: 'Missing client_id' },
        { status: 400 }
      )
    }

    const allowedExecutionStyles = ['schedule', 'flow', 'hybrid']
    const allowedCarouselStyles = ['section', 'step']

    const finalExecutionStyle = allowedExecutionStyles.includes(
      execution_style
    )
      ? execution_style
      : 'flow'

    const finalCarouselStyle = allowedCarouselStyles.includes(
      carousel_style
    )
      ? carousel_style
      : 'section'

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

    const { error: updateError } = await supabase
      .from('clients')
      .update({
        execution_style: finalExecutionStyle,
        carousel_style: finalCarouselStyle,

        wake_time: cleanTime(wake_time),
        bed_time: cleanTime(bed_time),
        work_start_time: cleanTime(work_start_time),
        work_end_time: cleanTime(work_end_time),
        preferred_workout_time: cleanTime(preferred_workout_time),
        school_dropoff_time: cleanTime(school_dropoff_time),
        school_pickup_time: cleanTime(school_pickup_time),
        lunch_window_time: cleanTime(lunch_window_time),
        dinner_window_time: cleanTime(dinner_window_time),

        daily_non_negotiables: Array.isArray(daily_non_negotiables)
          ? daily_non_negotiables
          : [],

        day_structure_notes:
          typeof day_structure_notes === 'string'
            ? day_structure_notes.trim()
            : null,
      })
      .eq('client_id', client_id)
      .eq('auth_user_id', user.id)

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      execution_style: finalExecutionStyle,
      carousel_style: finalCarouselStyle,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Daily structure save failed',
      },
      { status: 500 }
    )
  }
}
