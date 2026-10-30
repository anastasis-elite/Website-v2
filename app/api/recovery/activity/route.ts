import { getClientLocalDate } from '@/lib/timezone'
import { invalidateDailyPlan } from '@/lib/dashboard/invalidateDailyPlan'
import { createPracticeTimeline } from '@/lib/meditation/practiceTiming'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sameRecoveryDetails, validateDetailedRecovery } from '@/lib/recovery/activityDetails'

const allowed = new Set(['Full rest', 'Gentle walk', 'Mobility', 'Breathwork', 'Meditation', 'Warm soak'])

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Invalid recovery request.' }, { status: 400 })
  if (typeof body.clientId !== 'string' || !body.clientId.trim() || body.clientId.length > 200) return NextResponse.json({ error: 'Invalid recovery client.' }, { status: 400 })
  if (!allowed.has(body.activityType)) return NextResponse.json({ error: 'Invalid recovery activity.' }, { status: 400 })

  let detailed: ReturnType<typeof validateDetailedRecovery> | undefined
  if (body.details !== undefined) {
    try {
      if (body.practiceId !== undefined) throw new Error('Choose one recovery logging method.')
      detailed = validateDetailedRecovery(body)
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid recovery details.' }, { status: 400 })
    }
  }

  let completedPracticeMinutes: number | undefined
  if (body.practiceId !== undefined) {
    // Only these bounded, completed sequences can use their actual whole minutes
    // below the legacy two-minute minimum. Other recovery logging stays unchanged.
    if ((body.practiceId !== 'breath-reset' && body.practiceId !== 'sleep-wind-down') ||
      typeof body.skipHolds !== 'boolean' ||
      body.activityType !== (body.practiceId === 'breath-reset' ? 'Breathwork' : 'Meditation')) {
      return NextResponse.json({ error: 'Invalid completed breathing practice.' }, { status: 400 })
    }
    const { durationMs } = createPracticeTimeline(body.practiceId, body.skipHolds)
    if (body.elapsedMs !== durationMs) {
      return NextResponse.json({ error: 'Finish the complete breathing sequence before logging it.' }, { status: 400 })
    }
    // The existing column is integer minutes; never round earned time up.
    completedPracticeMinutes = Math.floor(durationMs / 60_000)
  }

  const { data: client, error: clientError } = await supabase.from('clients')
    .select('client_id,timezone,state,onboarding_data')
    .eq('client_id', body.clientId).eq('auth_user_id', user.id).maybeSingle()
  if (clientError) return NextResponse.json({ error: 'Recovery could not be saved. Please try again.' }, { status: 500 })
  if (!client) return NextResponse.json({ error: 'Client not found.' }, { status: 404 })
  const { error } = await supabase.from('recovery_activity_logs').insert({
    user_id: user.id,
    client_id: client.client_id,
    log_date: getClientLocalDate(client),
    activity_type: body.activityType,
    duration_minutes: detailed?.durationMinutes ?? completedPracticeMinutes ?? (body.activityType === 'Full rest' ? null :
      Math.max(['Breathwork', 'Meditation'].includes(body.activityType) ? 2 : 5, Math.min(90, Number(body.minutes) || 20))),
    ...(detailed ? { request_id: detailed.requestId, activity_details: detailed.details } : {}),
  })
  if (error?.code === '23505' && detailed) {
    // A response may have been lost after the insert committed. The unique key
    // makes concurrent retries safe; never update a previously saved activity.
    const { data: existing, error: readError } = await supabase.from('recovery_activity_logs')
      .select('activity_type,duration_minutes,activity_details')
      .eq('user_id', user.id).eq('client_id', client.client_id).eq('request_id', detailed.requestId).maybeSingle()
    if (readError || !existing) return NextResponse.json({ error: 'The save could not be confirmed. Please retry.' }, { status: 500 })
    if (existing.activity_type !== body.activityType || existing.duration_minutes !== detailed.durationMinutes ||
      !sameRecoveryDetails(existing.activity_details, detailed.details)) {
      return NextResponse.json({ error: 'This save identifier already belongs to a different activity. Reopen the sheet to log another activity.' }, { status: 409 })
    }
    invalidateDailyPlan()
    return NextResponse.json({ success: true })
  }
  if (!error) invalidateDailyPlan()
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ success: true })
}
