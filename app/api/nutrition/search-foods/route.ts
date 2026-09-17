import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
    .select('id, name, brand_name, barcode, calories, protein_g, carbs_g, fat_g, fiber_g')
    .limit(12)

  const { data, error } = barcode
    ? await query.eq('barcode', barcode)
    : await query.ilike('normalized_name', `%${q}%`)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ foods: data || [] })
}
