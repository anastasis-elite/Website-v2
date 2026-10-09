import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { normalizeMealInput } from '@/lib/nutrition/mealEntry'
import { createMealEntry } from '@/lib/nutrition/createMealEntry'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = normalizeMealInput(await request.json().catch(() => null))
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

  try {
    return await createMealEntry(supabase, user.id, result.input)
  } catch (error) {
    console.error('NUTRITION_ADD_MEAL_DIAGNOSTIC', { stage: 'unexpected_failure', error })
    return NextResponse.json({ error: 'Unable to add this food. Please try again.' }, { status: 500 })
  }
}
