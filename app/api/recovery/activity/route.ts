import { getClientLocalDate } from '@/lib/timezone'
import { invalidateDailyPlan } from '@/lib/dashboard/invalidateDailyPlan'
import { createPracticeTimeline } from '@/lib/meditation/practiceTiming'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const allowed = new Set(['Full rest', 'Gentle walk', 'Mobility', 'Breathwork', 'Meditation', 'Warm soak'])

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json()
  if (!allowed.has(body.activityType)) return NextResponse.json({ error: 'Invalid recovery activity.' }, { status: 400 })

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

  const { data: client } = await supabase.from('clients')
    .select('client_id,timezone,state,onboarding_data')
    .eq('client_id', body.clientId).eq('auth_user_id', user.id).maybeSingle()
  if (!client) return NextResponse.json({ error: 'Client not found.' }, { status: 404 })
  const { error } = await supabase.from('recovery_activity_logs').insert({
    user_id: user.id,
    client_id: client.client_id,
    log_date: getClientLocalDate(client),
    activity_type: body.activityType,
    duration_minutes: completedPracticeMinutes ?? (body.activityType === 'Full rest' ? null :
      Math.max(['Breathwork', 'Meditation'].includes(body.activityType) ? 2 : 5, Math.min(90, Number(body.minutes) || 20))),
  })
  if (!error) invalidateDailyPlan()
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ success: true })
}
