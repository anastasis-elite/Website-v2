import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json()
  const { data: client } = await supabase.from('clients').select('client_id,birthdate_updated_once,birthdate').eq('auth_user_id', user.id).maybeSingle()
  if (!client) return NextResponse.json({ error: 'Client not found.' }, { status: 404 })

  const update: Record<string, unknown> = {
    address_line_1: String(body.addressLine1 || '').trim() || null,
    address_line_2: String(body.addressLine2 || '').trim() || null,
    city: String(body.city || '').trim() || null,
    state: String(body.state || '').trim() || null,
    postal_code: String(body.postalCode || '').trim() || null,
    country: String(body.country || 'US').trim(),
    reproductive_status: String(body.reproductiveStatus || 'not_tracking'),
    last_period_start: body.lastPeriodStart || null,
    average_cycle_length: Math.max(18, Math.min(60, Number(body.averageCycleLength) || 28)),
  }
  if (!client.birthdate_updated_once && body.birthdate && body.birthdate !== client.birthdate) {
    update.birthdate = body.birthdate
    update.birthdate_updated_once = true
  }
  const list = (value: unknown) => String(value || '').split(',').map((item) => item.trim()).filter(Boolean).slice(0, 30)
  const { data: existingProfile } = await supabase.from('client_current_profiles').select('*').eq('user_id', user.id).eq('client_id', client.client_id).maybeSingle()
  const primaryGoal = String(body.primaryGoal || '').trim() || null
  if (primaryGoal !== (existingProfile?.primary_goal || null) && !body.confirmGoalChange) {
    return NextResponse.json({ error: 'Confirm the primary goal change before saving.' }, { status: 400 })
  }
  const profileValues = {
    user_id: user.id,
    client_id: client.client_id,
    injuries: list(body.injuries),
    limitations: list(body.limitations),
    equipment_access: list(body.equipmentAccess),
    current_weight: body.currentWeight ? Math.max(50, Math.min(700, Number(body.currentWeight))) : null,
    primary_goal: primaryGoal,
    workout_days_available: body.workoutDaysAvailable === '' ? null : Math.max(0, Math.min(7, Number(body.workoutDaysAvailable))),
    workout_minutes_available: body.workoutMinutesAvailable === '' ? null : Math.max(5, Math.min(300, Number(body.workoutMinutesAvailable))),
    updated_at: new Date().toISOString(),
  }
  const historyRows = Object.entries(profileValues).filter(([field, value]) => !['user_id','client_id','updated_at'].includes(field) && JSON.stringify(existingProfile?.[field] ?? null) !== JSON.stringify(value)).map(([field_name, new_value]) => ({ user_id: user.id, client_id: client.client_id, field_name, previous_value: existingProfile?.[field_name] ?? null, new_value, source: 'account_profile' }))
  const { error } = await supabase.from('clients').update(update).eq('auth_user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const { error: profileError } = await supabase.from('client_current_profiles').upsert(profileValues, { onConflict: 'client_id' })
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })
  if (historyRows.length) {
    const { error: historyError } = await supabase.from('client_profile_change_history').insert(historyRows)
    if (historyError) return NextResponse.json({ error: historyError.message }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
