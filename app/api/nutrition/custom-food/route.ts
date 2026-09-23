import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTierCapabilities } from '@/lib/entitlements'
import {
  flattenFoodNutrition,
  foodWithNutritionSelect,
  gramsPerServing,
  per100gNutrient,
} from '@/lib/nutrition/foodModel'

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
  const servingSize = Number(body.servingSize || 1)
  const servingUnit = String(body.servingUnit || 'serving').trim() || 'serving'
  const barcode = String(body.barcode || '').trim() || null

  if (!name) {
    return NextResponse.json({ error: 'Food name is required.' }, { status: 400 })
  }

  if (!Number.isFinite(servingSize) || servingSize <= 0) {
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

  const servingGrams = gramsPerServing(servingSize, servingUnit)
  const source = body.source || 'custom'

  const { data: food, error } = await supabase
    .from('foods')
    .insert({
      name,
      normalized_name: name.toLowerCase(),
      brand,
      default_serving_amount: servingSize,
      default_serving_unit: servingUnit,
      grams_per_serving: servingGrams,
      barcode,
      barcode_format: body.barcodeFormat || null,
      source,
      client_id: client.client_id,
      auth_user_id: user.id,
    })
    .select('id')
    .single()

  if (error || !food) {
    console.error('CUSTOM FOOD INSERT ERROR:', error)
    return NextResponse.json({ error: 'Custom food could not be saved. Please try again.' }, { status: 500 })
  }

  const { error: nutrientError } = await supabase
    .from('food_nutrients')
    .insert({
      food_id: food.id,
      calories: per100gNutrient(body.calories, servingGrams),
      protein_g: per100gNutrient(body.protein, servingGrams),
      carbs_g: per100gNutrient(body.carbs, servingGrams),
      fat_g: per100gNutrient(body.fats, servingGrams),
      fiber_g: body.fiber === undefined ? null : per100gNutrient(body.fiber, servingGrams),
    })

  if (nutrientError) {
    console.error('CUSTOM FOOD NUTRIENT INSERT ERROR:', nutrientError)
    return NextResponse.json({ error: 'Custom food could not be saved. Please try again.' }, { status: 500 })
  }

  const { error: servingError } = await supabase
    .from('food_serving_options')
    .insert({
      food_id: food.id,
      label: `${servingSize} ${servingUnit}`,
      unit: servingUnit,
      grams: servingGrams,
      is_default: true,
      sort_order: 0,
    })

  if (servingError) {
    console.error('CUSTOM FOOD SERVING INSERT ERROR:', servingError)
    return NextResponse.json({ error: 'Custom food could not be saved. Please try again.' }, { status: 500 })
  }

  const { data: savedFood, error: savedFoodError } = await supabase
    .from('foods')
    .select(foodWithNutritionSelect)
    .eq('id', food.id)
    .single()

  if (savedFoodError || !savedFood) {
    console.error('CUSTOM FOOD READBACK ERROR:', savedFoodError)
    return NextResponse.json({ error: 'Custom food was saved, but could not be loaded. Please search for it.' }, { status: 500 })
  }

  return NextResponse.json({ success: true, food: flattenFoodNutrition(savedFood) })
}
