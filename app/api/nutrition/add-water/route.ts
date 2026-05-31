import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { clientId, ounces } = await request.json()

  if (!clientId || !ounces) {
    return NextResponse.json(
      { error: 'Missing client or ounces.' },
      { status: 400 }
    )
  }

  const today = new Date().toISOString().split('T')[0]

  const { data: log, error: logError } = await supabase
    .from('nutrition_logs')
    .select('id, water_consumed_oz, auth_user_id')
    .eq('client_id', clientId)
    .eq('log_date', today)
    .maybeSingle()

  if (logError) {
    return NextResponse.json({ error: logError.message }, { status: 500 })
  }

  if (!log) {
    return NextResponse.json(
      { error: 'Nutrition log not found for today.' },
      { status: 404 }
    )
  }

  if (log.auth_user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const newWaterTotal =
    Number(log.water_consumed_oz || 0) + Number(ounces)

  const { data, error } = await supabase
    .from('nutrition_logs')
    .update({
      water_consumed_oz: newWaterTotal,
      updated_at: new Date().toISOString(),
    })
    .eq('id', log.id)
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    nutritionLog: data,
  })
}
