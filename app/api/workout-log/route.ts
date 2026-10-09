import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getClientDayRange } from '@/lib/schedule/time'
import { getClientLocalDate } from '@/lib/timezone'
import { activityDose, workoutCompletion } from '@/lib/workout/activity'
import { invalidateDailyPlan } from '@/lib/dashboard/invalidateDailyPlan'
export async function POST(req: Request) {
  try {
    const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json()
    const { data: client } = await supabase.from('clients').select('*').eq('client_id', body.client_id).eq('auth_user_id', user.id).maybeSingle()
    if (!client) return NextResponse.json({ error: 'Client not found.' }, { status: 404 })
    if (body.program !== client.program) return NextResponse.json({ error: 'Workout does not match your program.' }, { status: 403 })
    if (!Array.isArray(body.exercise_logs) || !Array.isArray(body.planned_exercises) || body.exercise_logs.length > 100) return NextResponse.json({ error: 'Review your exercises before saving.' }, { status: 400 })
    const logs = body.exercise_logs
    for (const log of logs) {
      if (!log || typeof log !== 'object' || ['actual_weight','actual_reps','actual_duration'].some(k => log[k] !== undefined && (!Number.isFinite(Number(log[k])) || Number(log[k]) < 0))) return NextResponse.json({ error: 'Activity values must be valid nonnegative numbers.' }, { status: 400 })
      if (log.set_logs !== undefined && (!Array.isArray(log.set_logs) || log.set_logs.length > 100 || log.set_logs.some((set: any) => !Number.isFinite(Number(set.reps)) || Number(set.reps) <= 0 || !Number.isFinite(Number(set.weight)) || Number(set.weight) < 0 || !['lb','kg'].includes(set.weight_unit || 'lb') || !Number.isFinite(new Date(set.completed_at).getTime())))) return NextResponse.json({error:'Review the confirmed sets before saving.'},{status:400})
    }
    for (const log of logs) {
      if (!log.completed) continue
      const dose = activityDose(log)
      const sets = Array.isArray(log.set_logs) ? log.set_logs : []
      const confirmed = dose.kind === 'strength' ? sets.length >= dose.sets && sets.every((set: any) => Number(set.reps) > 0 && Number.isFinite(Number(set.weight)) && Number(set.weight) >= 0 && Boolean(set.completed_at)) : Number(['minutes','seconds'].includes(dose.metric) ? log.actual_duration : log.actual_reps) > 0 && Boolean(log.confirmed_at)
      if (!confirmed || log.skipped) return NextResponse.json({ error: 'Confirm the work you completed before finishing the session.' }, { status: 400 })
    }
    const source = body.workout_source === 'manual' ? 'manual' : 'recommended'
    const dayName = String(body.day_name || 'Workout').slice(0, 200)
    const day = getClientDayRange(client)
    const workoutDate = body.workout_date ? new Date(body.workout_date) : new Date()
    if (!Number.isFinite(workoutDate.getTime()) || getClientLocalDate(client, workoutDate) !== day.date) return NextResponse.json({ error: 'This session belongs to another day. Reload today’s workout.' }, { status: 400 })
    const payload = { client_id: client.client_id, auth_user_id: user.id, program: client.program, day_name: dayName, workout_source: source,
      workout_date: workoutDate.toISOString(), planned_exercises: body.planned_exercises, exercise_logs: logs,
      completed: body.completed === true && workoutCompletion(logs).completed && logs.length === body.planned_exercises.length, updated_at: new Date().toISOString() }
    const result = await supabase.rpc('save_daily_workout', { p_client_id: client.client_id, p_day_start: day.start.toISOString(), p_day_end: day.end.toISOString(), p_payload: payload })
    if (result.error) throw result.error
    invalidateDailyPlan(); return NextResponse.json({ success: true, completed: payload.completed })
  } catch(e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Session could not be saved. Your draft is still available.' }, { status: 500 }) }
}

export async function GET(request: Request) {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const params = new URL(request.url).searchParams
  const { data: client } = await supabase.from('clients').select('*').eq('client_id',params.get('clientId')).eq('auth_user_id',user.id).maybeSingle()
  if (!client) return NextResponse.json({ error: 'Client not found.' }, { status: 404 })
  const day = getClientDayRange(client)
  const { data, error } = await supabase.from('workout_logs').select('id,exercise_logs,completed,updated_at').eq('client_id',client.client_id).eq('auth_user_id',user.id)
    .eq('day_name',params.get('dayName') || 'Workout').eq('workout_source',params.get('source') === 'manual' ? 'manual' : 'recommended')
    .gte('workout_date',day.start.toISOString()).lt('workout_date',day.end.toISOString()).order('workout_date',{ascending:false}).limit(1).maybeSingle()
  if(error) return NextResponse.json({ error:'Saved progress could not be loaded.' }, { status:500 })
  return NextResponse.json({ session:data })
}
