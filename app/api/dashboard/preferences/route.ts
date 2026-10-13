import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { invalidateDailyPlan } from '@/lib/dashboard/invalidateDailyPlan'
import { updateOwnedOnboardingData } from '@/lib/dashboard/updateOnboardingData'
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: client } = await supabase.from('clients').select('*').eq('auth_user_id', user.id).maybeSingle()
  if (!client) return NextResponse.json({ error: 'Client not found.' }, { status: 404 })
  const body = await request.json()
  const update: Record<string, unknown> = {}
  if (body.executionStyle !== undefined) {
    if (!['schedule','flow','hybrid'].includes(body.executionStyle)) return NextResponse.json({ error: 'Choose a daily structure.' }, { status: 400 })
    update.execution_style = body.executionStyle
  }
  if (body.carouselStyle !== undefined) {
    if (!['section','step'].includes(body.carouselStyle)) return NextResponse.json({ error: 'Choose a display preference.' }, { status: 400 })
    update.carousel_style = body.carouselStyle
  }
  if (body.transitionMinutes !== undefined) {
    if (!Number.isInteger(body.transitionMinutes) || body.transitionMinutes < 0 || body.transitionMinutes > 120) return NextResponse.json({ error: 'Choose a transition buffer from 0 to 120 minutes.' }, { status: 400 })
  }
  if (body.transitionMinutes !== undefined) {
    const result = await updateOwnedOnboardingData({ supabase, userId: user.id, clientId: client.client_id,
      fields: update, merge: current => ({ ...current, transitionMinutes: body.transitionMinutes }) })
    if (!result.saved) return NextResponse.json({ error: 'Preferences could not be saved. Refresh and try again.' }, { status: result.status })
  } else {
    const { error } = await supabase.from('clients').update(update).eq('client_id', client.client_id).eq('auth_user_id', user.id)
    if (error) return NextResponse.json({ error: 'Preferences could not be saved. Try again.' }, { status: 500 })
  }
  invalidateDailyPlan()
  return NextResponse.json({ success: true })
}
