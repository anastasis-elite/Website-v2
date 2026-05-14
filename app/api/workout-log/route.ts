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
      program,
      day_name,
      workout_date,
      exercise_logs,
    } = body

    const { error } = await supabase
      .from('workout_logs')
      .upsert({
        client_id,
        auth_user_id: user.id,
        program,
        day_name,
        workout_date,
        exercise_logs,
        completed: false,
        updated_at: new Date().toISOString(),
      })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Workout log failed',
      },
      { status: 500 }
    )
  }
}
