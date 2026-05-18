import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)

    const client_id = searchParams.get('client_id') || ''
    const program = searchParams.get('program') || ''

    const supabase = await createClient()

    const { data: strengthAssessment } = await supabase
      .from('assessments')
      .select('*')
      .eq('client_id', client_id)
      .eq('assessment_type', 'strength')
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const data = strengthAssessment?.data || {}

    const weight = Number(data.weight || 0)
    const goal = data.weight_goal || ''

    const baseCalories = weight ? Math.round(weight * 12) : 2000
    const calories =
      goal === 'fat-loss'
        ? baseCalories - 250
        : goal === 'muscle-building'
          ? baseCalories + 250
          : baseCalories

    const protein = weight ? Math.round(weight * 0.8) : 150
    const fats = Math.round((calories * 0.28) / 9)
    const carbs = Math.round((calories - protein * 4 - fats * 9) / 4)
    const water = weight ? Math.round(weight * 0.6) : 100

    return NextResponse.json({
      client_id,
      program,
      tdee: baseCalories,
      calories,
      protein,
      carbs,
      fats,
      water,
      micros:
        'Prioritize magnesium, potassium, sodium, calcium, iron, B vitamins, vitamin D, and omega-3 rich foods.',
      recipes: [],
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Nutrition route failed',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
