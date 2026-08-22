import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTierCapabilities } from '@/lib/entitlements'

function macroNumber(value: unknown) {
  const parsed = Number(value || 0)
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const nutritionLogId = String(body.nutritionLogId || '')

  if (!nutritionLogId) {
    return NextResponse.json({ error: 'Missing nutrition log.' }, { status: 400 })
  }

  const { data: log, error: logError } = await supabase
    .from('nutrition_logs')
    .select('id, client_id, auth_user_id')
    .eq('id', nutritionLogId)
    .maybeSingle()

  if (logError || !log) {
    return NextResponse.json({ error: 'Nutrition log not found.' }, { status: 404 })
  }

  if (log.auth_user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('client_id, program')
    .eq('client_id', log.client_id)
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (clientError || !client) {
    return NextResponse.json({ error: 'Client not found.' }, { status: 404 })
  }

  const capabilities = getTierCapabilities(client.program)
  if (!capabilities.nutritionMacroEntry) {
    return NextResponse.json({ error: 'Macro-only entry is not available for this tier.' }, { status: 403 })
  }

  const calories = macroNumber(body.calories)
  const protein = macroNumber(body.protein)
  const carbs = macroNumber(body.carbs)
  const fats = macroNumber(body.fats)

  if (calories + protein + carbs + fats <= 0) {
    return NextResponse.json({ error: 'Enter at least one macro value.' }, { status: 400 })
  }

  const dayBlock = String(body.dayBlock || 'other').toLowerCase()
  if (!['morning', 'midday', 'evening', 'other'].includes(dayBlock)) {
    return NextResponse.json({ error: 'Invalid macro block.' }, { status: 400 })
  }

  const { data: entry, error } = await supabase
    .from('macro_entries')
    .insert({
      nutrition_log_id: log.id,
      client_id: client.client_id,
      auth_user_id: user.id,
      calories,
      protein_g: protein,
      carbs_g: carbs,
      fat_g: fats,
      day_block: dayBlock,
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await supabase
    .from('nutrition_logs')
    .update({ completed: true, updated_at: new Date().toISOString() })
    .eq('id', log.id)
    .eq('auth_user_id', user.id)

  return NextResponse.json({ success: true, entry })
}
