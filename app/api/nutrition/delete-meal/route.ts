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

  const { mealEntryId, nutritionLogId } = await request.json()

  if (!mealEntryId || !nutritionLogId) {
    return NextResponse.json(
      { error: 'Missing meal entry.' },
      { status: 400 }
    )
  }

  const { data: log, error: logError } = await supabase
    .from('nutrition_logs')
    .select('id, auth_user_id')
    .eq('id', nutritionLogId)
    .single()

  if (logError || !log) {
    return NextResponse.json(
      { error: 'Nutrition log not found.' },
      { status: 404 }
    )
  }

  if (log.auth_user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await supabase
    .from('meal_entries')
    .delete()
    .eq('id', mealEntryId)
    .eq('nutrition_log_id', nutritionLogId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data: remaining } = await supabase
    .from('nutrition_log_remaining')
    .select('*')
    .eq('nutrition_log_id', nutritionLogId)
    .maybeSingle()

  return NextResponse.json({
    success: true,
    remaining,
  })
}
