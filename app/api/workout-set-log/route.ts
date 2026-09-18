import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function dayBounds(value: string) {
  const date = new Date(value)
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(start.getDate() + 1)
  return { start: start.toISOString(), end: end.toISOString() }
}

function exerciseId(exercise: any) {
  return String(
    exercise?.id ||
    exercise?.exercise_id ||
    exercise?.selected_variant_id ||
    exercise?.exercise ||
    exercise?.display_name ||
    exercise?.name ||
    'manual-exercise',
  )
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const workoutDate = body.workout_date || new Date().toISOString()
    const bounds = dayBounds(workoutDate)
    const sets = Array.isArray(body.sets) ? body.sets : []
    const exerciseLogs = Array.isArray(body.exercise_logs) ? body.exercise_logs : []

    const existingResult = await supabase
      .from('workout_logs')
      .select('id, exercise_logs')
      .eq('client_id', body.client_id)
      .eq('workout_source', 'manual')
      .gte('workout_date', bounds.start)
      .lt('workout_date', bounds.end)
      .order('workout_date', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingResult.error) {
      return NextResponse.json({ error: existingResult.error.message }, { status: 500 })
    }

    const existingLogs = Array.isArray(existingResult.data?.exercise_logs)
      ? existingResult.data.exercise_logs
      : []
    const nextExerciseKey = exerciseId(body.exercise)
    const nextLogs = [
      ...existingLogs.filter((log: any) => exerciseId(log) !== nextExerciseKey),
      ...exerciseLogs,
    ]

    const workoutPayload = {
      client_id: body.client_id,
      auth_user_id: user.id,
      program: body.program,
      day_name: body.day_name || 'Manual Workout',
      workout_source: 'manual',
      workout_date: workoutDate,
      planned_exercises: Array.isArray(body.planned_exercises) ? body.planned_exercises : [],
      exercise_logs: nextLogs,
      completed: body.completed ?? nextLogs.length > 0,
      updated_at: new Date().toISOString(),
    }

    const workoutResult = existingResult.data?.id
      ? await supabase
          .from('workout_logs')
          .update(workoutPayload)
          .eq('id', existingResult.data.id)
          .select('id')
          .single()
      : await supabase
          .from('workout_logs')
          .insert(workoutPayload)
          .select('id')
          .single()

    if (workoutResult.error) {
      return NextResponse.json({ error: workoutResult.error.message }, { status: 500 })
    }

    const workoutLogId = workoutResult.data.id
    const sessionResult = await supabase
      .from('workout_exercise_sessions')
      .upsert({
        workout_log_id: workoutLogId,
        client_id: body.client_id,
        auth_user_id: user.id,
        exercise_id: nextExerciseKey,
        exercise_name: String(body.exercise?.display_name || body.exercise?.exercise || body.exercise?.name || 'Exercise'),
        source: 'manual',
        started_at: body.exercise_started_at || workoutDate,
        finished_at: body.exercise_finished_at || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'workout_log_id,exercise_id,source' })
      .select('id')
      .single()

    if (sessionResult.error) {
      return NextResponse.json({ error: sessionResult.error.message }, { status: 500 })
    }

    const exerciseSessionId = sessionResult.data.id

    const deleteResult = await supabase
      .from('workout_exercise_sets')
      .delete()
      .eq('exercise_session_id', exerciseSessionId)

    if (deleteResult.error) {
      return NextResponse.json({ error: deleteResult.error.message }, { status: 500 })
    }

    if (sets.length) {
      const insertResult = await supabase
        .from('workout_exercise_sets')
        .insert(sets.map((set: any) => ({
          workout_log_id: workoutLogId,
          exercise_session_id: exerciseSessionId,
          exercise_id: nextExerciseKey,
          set_number: Number(set.set_number),
          weight: Number(set.weight || 0),
          weight_unit: set.weight_unit || 'lb',
          reps: Number(set.reps || 0),
          set_started_at: set.set_started_at || null,
          completed_at: set.completed_at || new Date().toISOString(),
        })))

      if (insertResult.error) {
        return NextResponse.json({ error: insertResult.error.message }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true, workout_log_id: workoutLogId, exercise_session_id: exerciseSessionId })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Set log failed' },
      { status: 500 },
    )
  }
}
