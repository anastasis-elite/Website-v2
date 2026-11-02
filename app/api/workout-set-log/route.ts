import { membershipCan } from '@/lib/membership/policy'
import { getClientDayRange } from '@/lib/schedule/time'
import { getClientLocalDate } from '@/lib/timezone'
import { isValidCompletedSet, manualWorkoutPlan, prescribedSetCount, workoutCompletion } from '@/lib/workout/activity'
import { invalidateDailyPlan } from '@/lib/dashboard/invalidateDailyPlan'
import { recordConversion } from '@/lib/analytics/server'
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
    if(!membershipCan(client, 'workoutLogging'))return NextResponse.json({error:'Workout logging is not available for this membership.'},{status:403})
    if(body.program !== client.program)return NextResponse.json({error:'Workout does not match your program.'},{status:403})
    const workoutDate = body.workout_date || new Date().toISOString()
    if(!Number.isFinite(new Date(workoutDate).getTime()) || getClientLocalDate(client,new Date(workoutDate)) !== getClientLocalDate(client))return NextResponse.json({error:'Reload today’s session before saving.'},{status:400})
    const day = getClientDayRange(client)
    const sets = Array.isArray(body.sets) ? body.sets : []
    const exerciseLogs = Array.isArray(body.exercise_logs) ? body.exercise_logs : []
    if (exerciseLogs.length !== 1 || !exerciseLogs[0] || typeof exerciseLogs[0] !== 'object') return NextResponse.json({ error: 'Review the exercise before saving.' }, { status: 400 })
    if(sets.length>100 || sets.some((set:any)=>!isValidCompletedSet(set)))return NextResponse.json({error:'Review the confirmed sets before saving.'},{status:400})

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
    const prior = existingLogs.find((log: any) => exerciseId(log) === nextExerciseKey)
    for (const log of exerciseLogs) {
      // The submitted set snapshot replaces the same exercise occurrence on
      // retries. Retain its first known prescription instead of shrinking it.
      if (prior?.planned_sets !== undefined) log.planned_sets = prior.planned_sets
      if (prior?.sets !== undefined) log.sets = prior.sets
      log.set_logs = sets
      const counts = workoutCompletion([log])
      log.completed = Boolean(body.exercise_finished_at) && prescribedSetCount(log) > 0 && counts.completedSets === counts.totalSets
    }
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
      completed: workoutCompletion(nextLogs, manualWorkoutPlan(nextLogs)).completed,
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
    if (workoutPayload.completed) await recordConversion(supabase, { userId: user.id, event: 'first_workout_completed' })

    return NextResponse.json({ success: true, completed: workoutPayload.completed, progress: workoutCompletion(nextLogs, manualWorkoutPlan(nextLogs)), workout_log_id: workoutLogId, exercise_session_id: exerciseSessionId })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Set log failed' },
      { status: 500 },
    )
  }
}
