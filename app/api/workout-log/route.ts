import { membershipCan } from '@/lib/membership/policy'
import { NextResponse } from 'next/server'
import { recordConversion } from '@/lib/analytics/server'
import { createClient } from '@/lib/supabase/server'
import { getClientDayRange } from '@/lib/schedule/time'
import { getClientLocalDate } from '@/lib/timezone'
import { isConfirmedActivity, isValidCompletedSet, manualWorkoutPlan, summarizeStrengthSets, workoutCompletion } from '@/lib/workout/activity'
import { matchingWorkoutPlan, workoutSessionKeys } from '@/lib/workout/session'
import { loadWorkoutHistory } from '@/lib/workout/history'
import { invalidateDailyPlan } from '@/lib/dashboard/invalidateDailyPlan'
export async function POST(req: Request) {
  try {
    const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json()
    const { data: client } = await supabase.from('clients').select('*').eq('client_id', body.client_id).eq('auth_user_id', user.id).maybeSingle()
    if (!client) return NextResponse.json({ error: 'Client not found.' }, { status: 404 })
    if (!membershipCan(client, 'workoutLogging') || (body.workout_source !== 'manual' && !membershipCan(client, 'generatedCoaching'))) return NextResponse.json({ error: 'This membership does not include this workout operation.' }, { status: 403 })
    if (body.program !== client.program) return NextResponse.json({ error: 'Workout does not match your program.' }, { status: 403 })
    if (!Array.isArray(body.exercise_logs) || !Array.isArray(body.planned_exercises) || !body.exercise_logs.length || body.exercise_logs.length > 100 || body.planned_exercises.length > 100) return NextResponse.json({ error: 'Review your exercises before saving.' }, { status: 400 })
    const logs = body.exercise_logs
    for (const log of logs) {
      if (!log || typeof log !== 'object' || ['actual_weight','actual_reps','actual_breaths','actual_duration'].some(k => log[k] !== undefined && (!Number.isFinite(Number(log[k])) || Number(log[k]) < 0))) return NextResponse.json({ error: 'Activity values must be valid nonnegative numbers.' }, { status: 400 })
      if (log.set_logs !== undefined && (!Array.isArray(log.set_logs) || log.set_logs.length > 100 || log.set_logs.some((set: any) => !isValidCompletedSet(set) && !set?.skipped && set?.status !== 'skipped'))) return NextResponse.json({error:'Review the confirmed sets before saving.'},{status:400})
    }
    for (const log of logs) {
      if (!log.completed) continue
      if (!isConfirmedActivity(log)) return NextResponse.json({ error: 'Confirm the work you completed before finishing the session.' }, { status: 400 })
    }
    const source = body.workout_source === 'manual' ? 'manual' : 'recommended'
    const dayName = String(body.day_name || 'Workout').slice(0, 200)
    const day = getClientDayRange(client)
    const workoutDate = body.workout_date ? new Date(body.workout_date) : new Date()
    if (!Number.isFinite(workoutDate.getTime()) || getClientLocalDate(client, workoutDate) !== day.date) return NextResponse.json({ error: 'This session belongs to another day. Reload today’s workout.' }, { status: 400 })
    let planned = body.planned_exercises
    if (source === 'recommended') {
      const keys = workoutSessionKeys(planned)
      if (!matchingWorkoutPlan(logs, keys)) return NextResponse.json({ error: 'Keep the full prescribed plan when saving, including skipped exercises.' }, { status: 400 })
      const history = await loadWorkoutHistory({ supabase, client, authUserId: user.id, startDate: day.date, dayName, source })
      if (history.error) throw history.error
      const saved = (history.data || []).find((row: any) => matchingWorkoutPlan(row.exercise_logs, keys))
      if (saved && matchingWorkoutPlan(saved.planned_exercises, keys)) planned = saved.planned_exercises
      else if ((history.data || []).some((row: any) => Array.isArray(row.planned_exercises) && row.planned_exercises.length > planned.length && keys.every(key => workoutSessionKeys(row.planned_exercises).includes(key)))) {
        return NextResponse.json({ error: 'Reload the full saved workout before saving this session.' }, { status: 400 })
      }
    }
    const payload = { client_id: client.client_id, auth_user_id: user.id, program: client.program, day_name: dayName, workout_source: source,
      workout_date: workoutDate.toISOString(), workout_local_date: day.date, planned_exercises: planned, exercise_logs: logs.map((log: any) => log.set_logs?.length ? { ...log, ...summarizeStrengthSets(log.set_logs.filter(isValidCompletedSet)) } : log),
      completed: workoutCompletion(logs, source === 'manual' ? manualWorkoutPlan(logs) : planned).completed, updated_at: new Date().toISOString() }
    const result = await supabase.rpc('save_daily_workout', { p_client_id: client.client_id, p_day_start: day.start.toISOString(), p_day_end: day.end.toISOString(), p_payload: payload })
    if (result.error) throw result.error
    invalidateDailyPlan()
    if (payload.completed) await recordConversion(supabase, { userId: user.id, event: 'first_workout_completed' })
    return NextResponse.json({ success: true, completed: payload.completed, session: result.data })
  } catch(e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Session could not be saved. Your draft is still available.' }, { status: 500 }) }
}

export async function GET(request: Request) {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const params = new URL(request.url).searchParams
  const { data: client } = await supabase.from('clients').select('*').eq('client_id',params.get('clientId')).eq('auth_user_id',user.id).maybeSingle()
  if (!client) return NextResponse.json({ error: 'Client not found.' }, { status: 404 })
  const day = getClientDayRange(client)
  let planKeys: string[] | null = null
  if (params.has('planKeys')) {
    try { planKeys = JSON.parse(params.get('planKeys') || 'null') } catch { return NextResponse.json({ error: 'Invalid workout plan.' }, { status: 400 }) }
    if (!Array.isArray(planKeys) || planKeys.length > 100 || planKeys.some(key => typeof key !== 'string')) return NextResponse.json({ error: 'Invalid workout plan.' }, { status: 400 })
  }
  // Legacy saved sessions predate workout_source. Read optional columns without
  // making the history depend on the new write-path migration.
  const source = params.get('source') === 'manual' ? 'manual' : 'recommended'
  const { data, error } = await loadWorkoutHistory({ supabase, client, authUserId: user.id, startDate: day.date, dayName: params.get('dayName') || 'Workout', source })
  if(error) return NextResponse.json({ error:'Saved progress could not be loaded.' }, { status:500 })
  const session = (data || []).find((row: any) => (row.workout_source || 'recommended') === source && (!planKeys || matchingWorkoutPlan(row.exercise_logs, planKeys)))
  return NextResponse.json({ session: session ? { id: session.id, exercise_logs: session.exercise_logs, planned_exercises: session.planned_exercises, completed: session.completed, updated_at: session.updated_at } : null }, { headers: { 'Cache-Control': 'private, no-store' } })
}
