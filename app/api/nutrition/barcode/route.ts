import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTierCapabilities } from '@/lib/entitlements'
import { flattenFoodNutrition, foodWithNutritionSelect } from '@/lib/nutrition/foodModel'

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const barcode = searchParams.get('barcode')?.trim()

  if (!barcode) {
    return NextResponse.json({ error: 'Missing barcode.' }, { status: 400 })
  }

  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('client_id, program')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (clientError || !client) {
    return NextResponse.json({ error: 'Client not found.' }, { status: 404 })
  }

  if (!getTierCapabilities(client.program).nutritionBarcodeScanning) {
    return NextResponse.json({ error: 'Barcode scanning is not available for this tier.' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('foods')
    .select(foodWithNutritionSelect)
    .eq('barcode', barcode)
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('NUTRITION BARCODE LOOKUP ERROR:', error)
    return NextResponse.json({ error: 'Barcode lookup failed. Please try again.' }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({
      found: false,
      barcode,
      message: 'No matching food was found in the connected Anastasis food catalog. Add it as a custom food to log this barcode.',
    })
  }

  return NextResponse.json({ found: true, food: flattenFoodNutrition(data) })
}
