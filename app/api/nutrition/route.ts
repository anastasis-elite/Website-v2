import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateMicronutrientTargets } from '@/lib/nutrition/calculateMicronutrientTargets'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)

    const client_id = searchParams.get('client_id') || ''
    const program = searchParams.get('program') || ''

    const supabase = await createClient()

    const [{ data: strengthAssessment }, { data: client }, { data: cycleLog }] = await Promise.all([
      supabase
        .from('assessments')
        .select('*')
        .eq('client_id', client_id)
        .eq('assessment_type', 'strength')
        .order('submitted_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('clients')
        .select('birthdate')
        .eq('client_id', client_id)
        .maybeSingle(),
      supabase
        .from('cycle_logs')
        .select('phase')
        .eq('client_id', client_id)
        .order('log_date', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

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
    const birthdate = client?.birthdate ? new Date(client.birthdate) : null
    const now = new Date()
    const age = birthdate && !Number.isNaN(birthdate.getTime())
      ? now.getFullYear() - birthdate.getFullYear() - (now < new Date(now.getFullYear(), birthdate.getMonth(), birthdate.getDate()) ? 1 : 0)
      : 35
    const trainingLevel = program === 'phoenix'
      ? 'recovery'
      : program === 'ignite' || program === 'ember'
        ? 'strength_hypertrophy'
        : 'general_fitness'
    const micronutrientTargets = calculateMicronutrientTargets({
      age,
      calories,
      weightLbs: weight || Math.max(100, Math.round(water / 0.6)),
      waterOz: water,
      cyclePhase: cycleLog?.phase || 'unknown',
      trainingLevel,
    })

    return NextResponse.json({
      client_id,
      program,
      tdee: baseCalories,
      calories,
      protein,
      carbs,
      fats,
      water,
      ...micronutrientTargets,
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
