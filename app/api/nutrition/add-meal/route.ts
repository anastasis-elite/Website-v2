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

  const body = await request.json()

  const {
    nutritionLogId,
    foodId,
    mealName,
    servingAmount,
    servingUnit,
    servingOptionId,
  } = body

  if (!nutritionLogId || !foodId) {
    return NextResponse.json(
      { error: 'Missing nutrition log or food.' },
      { status: 400 }
    )
  }

  const amount = Number(servingAmount || 1)

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { error: 'Serving amount must be greater than zero.' },
      { status: 400 }
    )
  }

  const { data: log, error: logError } = await supabase
    .from('nutrition_logs')
    .select('id, client_id, auth_user_id')
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

  let grams: number | null = null
  let resolvedServingUnit = servingUnit || 'serving'

  if (servingOptionId) {
    const { data: servingOption, error: servingOptionError } = await supabase
      .from('food_serving_options')
      .select('id, food_id, label, unit, grams')
      .eq('id', servingOptionId)
      .single()

    if (servingOptionError || !servingOption) {
      return NextResponse.json(
        { error: 'Serving option not found.' },
        { status: 404 }
      )
    }

    if (servingOption.food_id !== foodId) {
      return NextResponse.json(
        { error: 'Serving option does not match selected food.' },
        { status: 400 }
      )
    }

    grams = amount * Number(servingOption.grams)
    resolvedServingUnit = servingOption.label
  }

  const { error } = await supabase.from('meal_entries').insert({
    nutrition_log_id: nutritionLogId,
    food_id: foodId,
    meal_name: mealName || 'Meal',
    serving_amount: amount,
    serving_unit: resolvedServingUnit,
    serving_option_id: servingOptionId || null,
    grams,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data: remaining, error: remainingError } = await supabase
    .from('nutrition_log_remaining')
    .select('*')
    .eq('nutrition_log_id', nutritionLogId)
    .maybeSingle()

  if (remainingError) {
    return NextResponse.json(
      { error: remainingError.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    remaining,
  })
}
