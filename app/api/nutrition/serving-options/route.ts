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
  const foodId = searchParams.get('foodId')

  if (!foodId) {
    return NextResponse.json(
      { error: 'Missing foodId.' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('food_serving_options')
    .select('id, label, unit, grams, is_default, sort_order')
    .eq('food_id', foodId)
    .order('sort_order', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    servingOptions: data || [],
  })
}
