import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getMealLoggingAccess } from '@/lib/nutrition/mealLoggingAccess'

export async function GET(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const access = await getMealLoggingAccess(supabase, user.id)
  if (!access.allowed) return NextResponse.json({ error: access.error }, { status: access.status })

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
    console.error('NUTRITION SERVING OPTIONS ERROR:', error)
    return NextResponse.json({ error: 'Serving options could not be loaded. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({
    servingOptions: data || [],
  })
}
