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
  const nutritionLogId = searchParams.get('nutritionLogId')

  if (!nutritionLogId) {
    return NextResponse.json(
      { error: 'Missing nutrition log.' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('meal_entries')
    .select(`
      id,
      meal_name,
      serving_amount,
      serving_unit,
      grams,
      day_block,
      created_at,
      foods (
        name
      )
    `)
    .eq('nutrition_log_id', nutritionLogId)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ meals: data || [] })
}
