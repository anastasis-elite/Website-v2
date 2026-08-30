import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import {
  buildSuggestedFoods,
  hasMeaningfulNutritionGaps,
  type NutritionRemainingSnapshot,
  type SuggestedFoodCandidate,
} from '@/lib/nutrition/suggestedFoods'

type MealRow = {
  food_id?: string | null
}

function avoidTermsFromClient(client: Record<string, unknown> | null) {
  if (!client) return []
  return [client.allergies, client.intolerances, client.dietary_restrictions]
    .flatMap((value) => {
      if (Array.isArray(value)) return value
      if (typeof value === 'string') return value.split(/[,;]/)
      return []
    })
    .map((value) => String(value).trim())
    .filter(Boolean)
}

export async function GET(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const nutritionLogId = searchParams.get('nutritionLogId')

  if (!nutritionLogId) {
    return NextResponse.json({ error: 'Missing nutrition log.' }, { status: 400 })
  }

  const { data: log, error: logError } = await supabase
    .from('nutrition_logs')
    .select('id, auth_user_id, client_id')
    .eq('id', nutritionLogId)
    .single()

  if (logError || !log) {
    return NextResponse.json(
      { error: logError?.message || 'Nutrition log not found.' },
      { status: 404 },
    )
  }

  if (log.auth_user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('client_id', log.client_id)
    .eq('auth_user_id', user.id)
    .maybeSingle()

  const { data: remaining, error: remainingError } = await supabase
    .from('nutrition_log_remaining')
    .select('*')
    .eq('nutrition_log_id', nutritionLogId)
    .maybeSingle()

  if (remainingError) {
    return NextResponse.json({ error: remainingError.message }, { status: 500 })
  }

  const { data: meals, error: mealError } = await supabase
    .from('meal_entries')
    .select('food_id')
    .eq('nutrition_log_id', nutritionLogId)

  if (mealError) {
    return NextResponse.json({ error: mealError.message }, { status: 500 })
  }

  const loggedFoodIds = (meals || [])
    .map((meal: MealRow) => meal.food_id)
    .filter((id): id is string => Boolean(id))

  if (!loggedFoodIds.length) {
    return NextResponse.json({
      state: 'needs_logs',
      suggestions: [],
      remaining,
    })
  }

  if (!hasMeaningfulNutritionGaps(remaining as NutritionRemainingSnapshot | null)) {
    return NextResponse.json({
      state: 'complete',
      suggestions: [],
      remaining,
    })
  }

  const { data: foods, error: foodsError } = await supabase
    .from('foods')
    .select(
      `
        id,
        name,
        calories,
        protein_g,
        carbs_g,
        fat_g,
        fiber_g,
        sodium_mg,
        potassium_mg,
        magnesium_mg,
        calcium_mg,
        iron_mg,
        zinc_mg,
        selenium_mcg,
        choline_mg,
        vitamin_a_mcg,
        vitamin_c_mg,
        vitamin_d_mcg,
        vitamin_e_mg,
        vitamin_k_mcg,
        b1_mg,
        b2_mg,
        b3_mg,
        b5_mg,
        b6_mg,
        b9_mcg,
        b12_mcg,
        allergens,
        food_serving_options (
          label,
          grams,
          is_default,
          sort_order
        )
      `,
    )
    .gt('calories', 0)
    .limit(250)

  if (foodsError) {
    return NextResponse.json({ error: foodsError.message }, { status: 500 })
  }

  const suggestions = buildSuggestedFoods({
    remaining: remaining as NutritionRemainingSnapshot | null,
    candidates: (foods || []) as SuggestedFoodCandidate[],
    loggedFoodIds,
    avoidTerms: avoidTermsFromClient(client),
  })

  return NextResponse.json({
    state: suggestions.length ? 'ready' : 'complete',
    suggestions,
    remaining,
  })
}
