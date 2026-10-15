import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getDailyScheduleState } from '@/lib/schedule/service'
import { getClientLocalDate } from '@/lib/timezone'
import { scheduleConflict } from '@/lib/schedule/actions'
import { invalidateDailyPlan } from '@/lib/dashboard/invalidateDailyPlan'
import { updateOwnedOnboardingData } from '@/lib/dashboard/updateOnboardingData'
export async function POST(request: Request) {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: client } = await supabase.from('clients').select('*').eq('auth_user_id', user.id).maybeSingle()
  if (!client) return NextResponse.json({ error: 'Client not found.' }, { status: 404 })
  const body = await request.json(); const state = await getDailyScheduleState({ supabase, user, client })
  const event = state.events.find(e => e.id === body.eventId && e.virtual)
  if (!event) return NextResponse.json({ error: 'Today’s plan item was not found.' }, { status: 404 })
  if (['completed', 'skipped', 'cancelled'].includes(event.status)) return NextResponse.json({ error: 'This plan item is already finished for today.' }, { status: 409 })
  let override: Record<string, unknown>
  if (body.action === 'skip') {
    if (event.flexibility_type !== 'flexible' || event.approval_required) return NextResponse.json({ error: 'Edit commitments in Daily Structure or through their approval process.' }, { status: 400 })
    override = { status: 'skipped', completed_at: null }
  } else if (body.action === 'move') {
    if (state.unavailableSources?.length) return NextResponse.json({ error: 'Your full schedule could not be loaded. Try again before changing a time.' }, { status: 503 })
    if (!event.movable || event.flexibility_type !== 'flexible' || event.approval_required) return NextResponse.json({ error: 'Edit commitments in Daily Structure or through their approval process.' }, { status: 400 })
    const start = new Date(body.start_at), end = new Date(body.end_at)
    const error = scheduleConflict(state.events, event.id, start, end, state.preferences?.transitionMinutes)
    if (error || getClientLocalDate(client, start) !== state.date || start < new Date()) return NextResponse.json({ error: error || 'Choose a later time today.' }, { status: 400 })
    override = { adjusted_start_at: start.toISOString(), adjusted_end_at: end.toISOString(), adjusted_duration_minutes: Math.round((end.getTime()-start.getTime())/60000), status: 'scheduled', suggested: false, adaptive_reason: 'Time confirmed by you.' }
  } else return NextResponse.json({ error: 'Choose move or skip.' }, { status: 400 })
  if (getClientLocalDate(client) !== state.date) return NextResponse.json({ error: 'A new day has started. Refresh Schedule before saving this change.' }, { status: 409 })
  const result = await updateOwnedOnboardingData({ supabase, userId: user.id, clientId: client.client_id,
    merge: current => ({ ...current, scheduleOverrides: { ...current.scheduleOverrides, [event.id]: override } }) })
  if (!result.saved) return NextResponse.json({ error: 'Your change could not be saved. Refresh and try again.' }, { status: result.status })
  invalidateDailyPlan(); return NextResponse.json({ success: true })
}
