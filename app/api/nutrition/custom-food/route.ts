import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTierCapabilities } from '@/lib/entitlements'

function nutrientNumber(value: unknown) {
  const parsed = Number(value || 0)
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 10) / 10) : 0
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
  const barcode = String(body.barcode || '').trim() || null

  if (!name) {
    return NextResponse.json({ error: 'Food name is required.' }, { status: 400 })
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

  const { data: food, error } = await supabase
    .from('foods')
    .insert({
      name,
      normalized_name: name.toLowerCase(),
      calories: nutrientNumber(body.calories),
      protein_g: nutrientNumber(body.protein),
      carbs_g: nutrientNumber(body.carbs),
      fat_g: nutrientNumber(body.fats),
      fiber_g: body.fiber === undefined ? null : nutrientNumber(body.fiber),
      barcode,
      barcode_format: body.barcodeFormat || null,
      brand_name: body.brandName || null,
      source: body.source || 'custom',
      client_id: client.client_id,
      auth_user_id: user.id,
    })
    .select('id, name, brand_name, barcode, calories, protein_g, carbs_g, fat_g, fiber_g')
    .single()

  if (error || !food) {
    return NextResponse.json({ error: error?.message || 'Custom food could not be saved.' }, { status: 500 })
  }

  return NextResponse.json({ success: true, food })
}
