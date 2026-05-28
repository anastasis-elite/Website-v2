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

  const { data: meal, error: mealError } = await supabase
    .from('meal_entries')
    .select(`
      id,
      nutrition_log_id,
      nutrition_logs (
        auth_user_id
      )
    `)
    .eq('id', mealEntryId)
    .single()

  if (mealError || !meal) {
    return NextResponse.json(
      { error: 'Meal not found.' },
      { status: 404 }
    )
  }

  const ownerId = Array.isArray(meal.nutrition_logs)
    ? meal.nutrition_logs[0]?.auth_user_id
    : meal.nutrition_logs?.auth_user_id

  if (ownerId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await supabase
    .from('meal_entries')
    .delete()
    .eq('id', mealEntryId)

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
