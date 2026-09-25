import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateMicronutrientTargets } from '@/lib/nutrition/calculateMicronutrientTargets'
import { calculateClientNutritionTargets, normalizeCyclePhase } from '@/lib/nutrition/targetService'
import { safeErrorResponse } from '@/lib/security/http'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)

    const client_id = searchParams.get('client_id') || ''
    const program = searchParams.get('program') || ''

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return safeErrorResponse('Unauthorized', 401)

    const { data: client } = await supabase
      .from('clients')
      .select('client_id,program')
      .eq('client_id', client_id)
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (!client) return safeErrorResponse('Client not found.', 404)

    const nutrition = await calculateClientNutritionTargets({
      supabase,
      clientId: client.client_id,
      program: client.program || program,
    })
    const { target, water, weightLbs } = nutrition
    const resolvedProgram = client.program || program
    const trainingLevel = resolvedProgram === 'phoenix'
      ? 'recovery'
      : resolvedProgram === 'ignite' || resolvedProgram === 'ember'
        ? 'strength_hypertrophy'
        : 'general_fitness'
    const micronutrientTargets = calculateMicronutrientTargets({
      age: target.inputs.age || 35,
      calories: target.calories,
      weightLbs,
      waterOz: water,
      cyclePhase: normalizeCyclePhase(nutrition.phase),
      trainingLevel,
    })

    return NextResponse.json({
      client_id: client.client_id,
      program: resolvedProgram,
      calories: target.calories,
      protein: target.protein,
      carbs: target.carbs,
      fats: target.fats,
      water,
      calculationStatus: target.calculationStatus,
      statusLabel: target.statusLabel,
      statusDescription: target.statusDescription,
      lastCalculatedAt: target.lastCalculatedAt,
      ...micronutrientTargets,
      micros:
        'Prioritize magnesium, potassium, sodium, calcium, iron, B vitamins, vitamin D, and omega-3 rich foods.',
      recipes: [],
    })
  } catch (error) {
    return safeErrorResponse('Nutrition route failed', 500, error)
  }
}
