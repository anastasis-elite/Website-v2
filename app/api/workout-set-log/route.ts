import { getClientDayRange } from '@/lib/schedule/time'
import { getClientLocalDate } from '@/lib/timezone'
import { workoutCompletion } from '@/lib/workout/activity'
import { invalidateDailyPlan } from '@/lib/dashboard/invalidateDailyPlan'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { loadWorkoutHistory } from '@/lib/workout/history'

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

    const {data:client} = await supabase.from('clients').select('*').eq('client_id',body.client_id).eq('auth_user_id',user.id).maybeSingle()
    if(!client)return NextResponse.json({error:'Client not found.'},{status:404})
    if(body.program !== client.program)return NextResponse.json({error:'Workout does not match your program.'},{status:403})
    const workoutDate = body.workout_date || new Date().toISOString()
    if(!Number.isFinite(new Date(workoutDate).getTime()) || getClientLocalDate(client,new Date(workoutDate)) !== getClientLocalDate(client))return NextResponse.json({error:'Reload today’s session before saving.'},{status:400})
    const day = getClientDayRange(client)
    const sets = Array.isArray(body.sets) ? body.sets : []
    const exerciseLogs = Array.isArray(body.exercise_logs) ? body.exercise_logs : []
    if(sets.length>100 || sets.some((set:any)=>!Number.isFinite(Number(set.weight)) || Number(set.weight)<0 || !Number.isFinite(Number(set.reps)) || Number(set.reps)<=0 || !['lb','kg'].includes(set.weight_unit || 'lb') || !set.completed_at))return NextResponse.json({error:'Review the confirmed sets before saving.'},{status:400})
    for(const log of exerciseLogs)log.completed=Boolean(body.exercise_finished_at) && sets.length >= Math.max(1,Number(body.exercise?.sets || 1))

    const dayName = String(body.day_name || 'Manual Workout')
    const history = await loadWorkoutHistory({ supabase, client, authUserId: user.id, startDate: day.date, source: 'manual', dayName, limit: 1 })
    const existingResult = { ...history, data: history.data?.[0] || null }

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
      day_name: dayName,
      workout_source: 'manual',
      workout_date: day.date,
      workout_started_at: existingResult.data ? existingResult.data.workout_started_at || null : new Date(workoutDate).toISOString(),
      planned_exercises: Array.isArray(body.planned_exercises) ? body.planned_exercises : [],
      exercise_logs: nextLogs,
      completed: Array.isArray(body.planned_exercises) && body.planned_exercises.length === nextLogs.length && workoutCompletion(nextLogs).completed,
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

    const deleteResult = await supabase.rpc('replace_workout_sets', {p_session_id:exerciseSessionId,p_sets:sets})

    if (deleteResult.error) {
      return NextResponse.json({ error: deleteResult.error.message }, { status: 500 })
    }

    invalidateDailyPlan()

    return NextResponse.json({ success: true, workout_log_id: workoutLogId, exercise_session_id: exerciseSessionId })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Set log failed' },
      { status: 500 },
    )
  }
}
