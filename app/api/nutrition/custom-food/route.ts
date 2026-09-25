import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTierCapabilities } from '@/lib/entitlements'
import {
  flattenFoodNutrition,
  foodWithNutritionSelect,
  gramsPerServing,
  per100gNutrient,
} from '@/lib/nutrition/foodModel'
import { positiveFiniteNumber } from '@/lib/nutrition/mealEntry'

type SupabaseDiagnosticError = {
  code?: string
  message?: string
}

function logCustomFoodDiagnostic({
  stage,
  table,
  error,
  userId,
}: {
  stage: string
  table: string
  error?: SupabaseDiagnosticError | null
  userId?: unknown
}) {
  console.error('NUTRITION_CUSTOM_FOOD_DIAGNOSTIC', {
    route: 'app/api/nutrition/custom-food',
    stage,
    table,
    code: error?.code || null,
    message: error?.message || null,
    userId: userId || null,
  })
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
  const name = String(body.name || '').trim()
  const brand = String(body.brand || body.brandName || '').trim() || null
  const servingSize = positiveFiniteNumber(body.servingSize ?? 1)
  const servingUnit = String(body.servingUnit || 'serving').trim() || 'serving'
  const servingUnitKey = servingUnit.toLowerCase()
  const barcode = String(body.barcode || '').trim() || null
  const barcodeFormat = String(body.barcodeFormat || '').trim() || null

  if (!name) {
    return NextResponse.json({ error: 'Food name is required.' }, { status: 400 })
  }

  if (!servingSize) {
    return NextResponse.json({ error: 'Serving size must be greater than zero.' }, { status: 400 })
  }

  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('client_id, program')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (clientError || !client) {
    return NextResponse.json({ error: 'Client not found.' }, { status: 404 })
  }

  if (!getTierCapabilities(client.program).nutritionTracking) {
    return NextResponse.json({ error: 'Nutrition tracking is not available for this tier.' }, { status: 403 })
  }

  const servingGrams = ['g', 'gram', 'grams'].includes(servingUnitKey)
    ? gramsPerServing(servingSize, servingUnit)
    : positiveFiniteNumber(body.servingGrams || body.gramsPerServing)
  const source = barcode ? 'barcode_custom' : 'custom'

  const validatedServingGrams = positiveFiniteNumber(servingGrams)

  if (!validatedServingGrams) {
    return NextResponse.json({ error: 'Serving weight in grams is required.' }, { status: 400 })
  }

  const nutrients = {
    calories: per100gNutrient(body.calories, validatedServingGrams),
    protein_g: per100gNutrient(body.protein, validatedServingGrams),
    carbs_g: per100gNutrient(body.carbs, validatedServingGrams),
    fat_g: per100gNutrient(body.fats, validatedServingGrams),
    fiber_g: body.fiber === undefined ? null : per100gNutrient(body.fiber, validatedServingGrams),
  }

  for (const value of Object.values(nutrients)) {
    if (value !== null && (!Number.isFinite(value) || value < 0)) {
      return NextResponse.json({ error: 'Nutrition values must be valid positive numbers.' }, { status: 400 })
    }
  }

  const { data: createdFoodId, error } = await supabase.rpc('create_custom_food_with_nutrition', {
    p_name: name,
    p_brand: brand,
    p_default_serving_amount: servingSize,
    p_default_serving_unit: servingUnit,
    p_grams_per_serving: validatedServingGrams,
    p_barcode: barcode,
    p_barcode_format: barcodeFormat,
    p_source: source,
    p_client_id: client.client_id,
    p_calories: nutrients.calories,
    p_protein_g: nutrients.protein_g,
    p_carbs_g: nutrients.carbs_g,
    p_fat_g: nutrients.fat_g,
    p_fiber_g: nutrients.fiber_g,
    p_serving_label: `${servingSize} ${servingUnit}`,
  })

  if (error || !createdFoodId) {
    logCustomFoodDiagnostic({
      stage: 'custom_food_insert',
      table: 'create_custom_food_with_nutrition',
      error,
      userId: user.id,
    })
    return NextResponse.json({ error: 'Custom food could not be saved. Please try again.' }, { status: 500 })
  }

  const { data: savedFood, error: savedFoodError } = await supabase
    .from('foods')
    .select(foodWithNutritionSelect)
    .eq('id', createdFoodId)
    .single()

  if (savedFoodError || !savedFood) {
    logCustomFoodDiagnostic({
      stage: 'custom_food_readback',
      table: 'foods',
      error: savedFoodError,
      userId: user.id,
    })
    return NextResponse.json({ success: true, food: null, refreshStatus: 'degraded' })
  }

  return NextResponse.json({ success: true, food: flattenFoodNutrition(savedFood), refreshStatus: 'success' })
}
