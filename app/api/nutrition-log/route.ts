import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const supabase = await createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const {
      client_id,
      log_date,
      protein,
      carbs,
      fats,
      calories,
      water_oz,
      meals,
      completed,
    } = body

    const { error } = await supabase
      .from('nutrition_logs')
      .upsert({
        client_id,
        auth_user_id: user.id,
        log_date,
        protein,
        carbs,
        fats,
        calories,
        water_oz,
        meals: meals || [],
        completed: completed ?? false,
        updated_at: new Date().toISOString(),
      })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Nutrition log failed',
      },
      { status: 500 }
    )
  }
}
