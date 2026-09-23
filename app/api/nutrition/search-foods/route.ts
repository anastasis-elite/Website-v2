import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { flattenFoodsNutrition, foodWithNutritionSelect } from '@/lib/nutrition/foodModel'

export async function GET(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim().toLowerCase()
  const barcode = searchParams.get('barcode')?.trim()

  if (!q && !barcode) {
    return NextResponse.json({ foods: [] })
  }

  const query = supabase
    .from('foods')
    .select(foodWithNutritionSelect)
    .limit(12)

  const { data, error } = barcode
    ? await query.eq('barcode', barcode)
    : await query.ilike('normalized_name', `%${q}%`)

  if (error) {
    console.error('NUTRITION FOOD SEARCH ERROR:', error)
    return NextResponse.json({ error: 'Food search failed. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ foods: flattenFoodsNutrition(data) })
}
