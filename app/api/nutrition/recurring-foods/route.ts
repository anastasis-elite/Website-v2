import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTierCapabilities } from '@/lib/entitlements'
import { mealPeriodToDayBlock, normalizeMealPeriod } from '@/lib/nutrition/mealPeriod'

type MealHistoryRow = {
  food_id: string
  meal_name?: string | null
  meal_period?: string | null
  serving_amount?: number | null
  serving_unit?: string | null
  serving_option_id?: string | null
  created_at?: string | null
  foods?: { name?: string | null } | { name?: string | null }[] | null
}

function firstRelated<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

function dateKey(dateString: string) {
  return new Date(dateString).toISOString().slice(0, 10)
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('client_id, program')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (clientError || !client) {
    return NextResponse.json({ error: 'Client not found.' }, { status: 404 })
  }

  const capabilities = getTierCapabilities(client.program)
  if (!capabilities.nutritionRecurringFoodDetection) {
    return NextResponse.json({ error: 'Recurring food detection is not available for this tier.' }, { status: 403 })
  }

  const since = new Date()
  since.setDate(since.getDate() - 45)
  const sinceDate = since.toISOString().slice(0, 10)

  const { data: logs, error: logsError } = await supabase
    .from('nutrition_logs')
    .select('id')
    .eq('client_id', client.client_id)
    .eq('auth_user_id', user.id)
    .gte('log_date', sinceDate)

  if (logsError) {
    return NextResponse.json({ error: logsError.message }, { status: 500 })
  }

  const logIds = (logs || []).map((log) => log.id)
  if (!logIds.length) {
    return NextResponse.json({ suggestions: [], active: [] })
  }

  const { data: active } = await supabase
    .from('recurring_food_patterns')
    .select('*, foods (name)')
    .eq('client_id', client.client_id)
    .in('status', ['active', 'suggested'])
    .order('updated_at', { ascending: false })

  const { data: meals, error: mealsError } = await supabase
    .from('meal_entries')
    .select(`
      food_id,
      meal_name,
      meal_period,
      serving_amount,
      serving_unit,
      serving_option_id,
      created_at,
      foods (name)
    `)
    .in('nutrition_log_id', logIds)
    .eq('entry_state', 'confirmed')
    .gte('created_at', since.toISOString())

  if (mealsError) {
    return NextResponse.json({ error: mealsError.message }, { status: 500 })
  }

  const counts = new Map<string, {
    foodId: string
    foodName: string
    mealPeriod: string
    mealName: string
    servingAmount: number
    servingUnit: string | null
    servingOptionId: string | null
    days: Set<string>
    weekdays: Set<number>
    lastLoggedAt: string
  }>()

  for (const meal of (meals || []) as MealHistoryRow[]) {
    if (!meal.food_id || !meal.created_at) continue
    const period = normalizeMealPeriod(meal.meal_period || meal.meal_name)
    const key = [meal.food_id, period, meal.serving_option_id || meal.serving_unit || 'serving'].join('::')
    const food = firstRelated(meal.foods)
    const existing = counts.get(key) || {
      foodId: meal.food_id,
      foodName: food?.name || meal.meal_name || 'Food',
      mealPeriod: period,
      mealName: meal.meal_name || period,
      servingAmount: Number(meal.serving_amount || 1),
      servingUnit: meal.serving_unit || null,
      servingOptionId: meal.serving_option_id || null,
      days: new Set<string>(),
      weekdays: new Set<number>(),
      lastLoggedAt: meal.created_at,
    }

    existing.days.add(dateKey(meal.created_at))
    existing.weekdays.add(new Date(meal.created_at).getDay())
    if (new Date(meal.created_at) > new Date(existing.lastLoggedAt)) {
      existing.lastLoggedAt = meal.created_at
    }
    counts.set(key, existing)
  }

  const activeKeys = new Set(
    (active || []).map((pattern: any) => [pattern.food_id, pattern.meal_period, pattern.serving_option_id || pattern.serving_unit || 'serving'].join('::')),
  )

  const suggestions = Array.from(counts.entries())
    .filter(([key, item]) => item.days.size >= 3 && !activeKeys.has(key))
    .sort(([, first], [, second]) => second.days.size - first.days.size)
    .slice(0, 4)
    .map(([, item]) => ({
      foodId: item.foodId,
      foodName: item.foodName,
      mealPeriod: item.mealPeriod,
      mealName: item.mealName,
      servingAmount: item.servingAmount,
      servingUnit: item.servingUnit,
      servingOptionId: item.servingOptionId,
      frequency: item.days.size,
      daysOfWeek: Array.from(item.weekdays),
      lastLoggedAt: item.lastLoggedAt,
    }))

  return NextResponse.json({ suggestions, active: active || [] })
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
  const action = String(body.action || '')

  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('client_id, program')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (clientError || !client) {
    return NextResponse.json({ error: 'Client not found.' }, { status: 404 })
  }

  const capabilities = getTierCapabilities(client.program)
  if (!capabilities.nutritionAutomaticPreLogging) {
    return NextResponse.json({ error: 'Automatic pre-logging is not available for this tier.' }, { status: 403 })
  }

  if (action === 'stop' || action === 'dismiss') {
    const id = String(body.id || '')
    if (!id) return NextResponse.json({ error: 'Missing recurring food pattern.' }, { status: 400 })

    const { data, error } = await supabase
      .from('recurring_food_patterns')
      .update({ status: action === 'stop' ? 'paused' : 'dismissed', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('auth_user_id', user.id)
      .select('*')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, pattern: data })
  }

  const foodId = String(body.foodId || '')
  const mealPeriod = normalizeMealPeriod(body.mealPeriod || body.mealName)
  const servingAmount = Number(body.servingAmount || 1)

  if (!foodId || !Number.isFinite(servingAmount) || servingAmount <= 0) {
    return NextResponse.json({ error: 'Missing food or serving amount.' }, { status: 400 })
  }

  const status = action === 'suggest' ? 'suggested' : 'active'
  const { data, error } = await supabase
    .from('recurring_food_patterns')
    .insert({
      client_id: client.client_id,
      auth_user_id: user.id,
      food_id: foodId,
      serving_option_id: body.servingOptionId || null,
      serving_amount: servingAmount,
      serving_unit: body.servingUnit || null,
      meal_period: mealPeriod,
      day_block: mealPeriodToDayBlock(mealPeriod),
      days_of_week: Array.isArray(body.daysOfWeek) ? body.daysOfWeek : [],
      status,
      detection_metadata: body.detectionMetadata || {},
      last_prompted_at: new Date().toISOString(),
    })
    .select('*')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: error?.message || 'Recurring food could not be saved.' }, { status: 500 })
  }

  return NextResponse.json({ success: true, pattern: data })
}
