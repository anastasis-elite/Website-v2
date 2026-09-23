import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTierCapabilities } from '@/lib/entitlements'
import { mealPeriodToDayBlock, normalizeMealPeriod } from '@/lib/nutrition/mealPeriod'

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
    symptoms = [],
    symptomNotes,
    dayBlock,
    mealPeriod,
    entrySource = 'manual',
    entryState = 'confirmed',
    barcode,
    estimateMetadata,
    confidence,
    recurringFoodId,
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
  if (!capabilities.nutritionTracking || !capabilities.nutritionMealLogging) {
    return NextResponse.json({ error: 'Food logging is not available for this tier.' }, { status: 403 })
  }

  const source = String(entrySource || 'manual')
  if (!['manual', 'barcode', 'recurring', 'photo_estimate'].includes(source)) {
    return NextResponse.json({ error: 'Invalid nutrition entry source.' }, { status: 400 })
  }

  if (source === 'barcode' && !capabilities.nutritionBarcodeScanning) {
    return NextResponse.json({ error: 'Barcode scanning is not available for this tier.' }, { status: 403 })
  }

  if (source === 'recurring' && !capabilities.nutritionAutomaticPreLogging) {
    return NextResponse.json({ error: 'Recurring food logging is not available for this tier.' }, { status: 403 })
  }

  if (source === 'photo_estimate' && !capabilities.nutritionPhotoMacroEstimation) {
    return NextResponse.json({ error: 'Photo macro estimation is not available for this tier.' }, { status: 403 })
  }

  const state = String(entryState || 'confirmed')
  if (!['scheduled', 'pre_logged', 'confirmed', 'skipped'].includes(state)) {
    return NextResponse.json({ error: 'Invalid nutrition entry state.' }, { status: 400 })
  }

  let grams: number | null = null
  let resolvedServingUnit = servingUnit || 'serving'
  const normalizedMealPeriod = normalizeMealPeriod(mealPeriod || mealName)
  const normalizedMealName = String(mealName || normalizedMealPeriod || 'Meal')
  const inferredDayBlock = String(dayBlock || '').toLowerCase() || mealPeriodToDayBlock(normalizedMealPeriod)
  if (!['morning','midday','evening','other'].includes(inferredDayBlock)) return NextResponse.json({ error: 'Invalid meal time block.' }, { status: 400 })

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
  } else {
    const { data: food, error: foodError } = await supabase
      .from('foods')
      .select('id, default_serving_unit, grams_per_serving')
      .eq('id', foodId)
      .single()

    if (foodError || !food) {
      console.error('NUTRITION ADD MEAL FOOD LOOKUP ERROR:', foodError)
      return NextResponse.json(
        { error: "We couldn't add this food. Please try again." },
        { status: 404 }
      )
    }

    grams = amount * Number(food.grams_per_serving || 100)
    resolvedServingUnit = servingUnit || food.default_serving_unit || 'serving'
  }

  const { data: mealEntry, error } = await supabase
    .from('meal_entries')
    .insert({
      nutrition_log_id: nutritionLogId,
      food_id: foodId,
      meal_name: normalizedMealName,
      serving_amount: amount,
      serving_unit: resolvedServingUnit,
      serving_option_id: servingOptionId || null,
      grams,
      day_block: inferredDayBlock,
      meal_period: normalizedMealPeriod,
      entry_source: source,
      entry_state: state,
      verified: source !== 'photo_estimate',
      estimated: source === 'photo_estimate',
      barcode: barcode || null,
      estimate_metadata: estimateMetadata && typeof estimateMetadata === 'object' ? estimateMetadata : {},
      confidence: confidence === undefined || confidence === null ? null : Number(confidence),
      recurring_food_id: recurringFoodId || null,
      confirmed_at: state === 'confirmed' ? new Date().toISOString() : null,
      skipped_at: state === 'skipped' ? new Date().toISOString() : null,
      symptoms_after: symptomNotes || null,
      notes: symptomNotes || null,
    })
    .select('id')
    .single()

  if (error || !mealEntry) {
    console.error('NUTRITION ADD MEAL INSERT ERROR:', error)
    return NextResponse.json(
      { error: "We couldn't add this food. Please try again." },
      { status: 500 }
    )
  }

  if (Array.isArray(symptoms) && symptoms.length > 0) {
    const symptomRows = symptoms.map((symptomTypeId: string) => ({
      meal_entry_id: mealEntry.id,
      symptom_type_id: symptomTypeId,
      severity: null,
      notes: symptomNotes || null,
    }))

    const { error: symptomError } = await supabase
      .from('meal_symptoms')
      .insert(symptomRows)

    if (symptomError) {
      console.error('NUTRITION ADD MEAL SYMPTOM INSERT ERROR:', symptomError)
      return NextResponse.json(
        { error: "We couldn't add this food. Please try again." },
        { status: 500 }
      )
    }
  }

  await supabase.from('nutrition_logs').update({ completed: true, updated_at: new Date().toISOString() }).eq('id', nutritionLogId).eq('auth_user_id', user.id)

  const { data: remaining, error: remainingError } = await supabase
    .from('nutrition_log_remaining')
    .select('*')
    .eq('nutrition_log_id', nutritionLogId)
    .maybeSingle()

  if (remainingError) {
    console.error('NUTRITION ADD MEAL REMAINING ERROR:', remainingError)
    return NextResponse.json(
      { error: "Food was added, but today's remaining macros could not be refreshed." },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    mealEntryId: mealEntry.id,
    dayBlock: inferredDayBlock,
    remaining,
  })
}
