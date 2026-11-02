import { NextResponse } from 'next/server'
import { membershipCan } from '@/lib/membership/policy'
import { createClient } from '@/lib/supabase/server'
import { calculateMicronutrientTargets } from '@/lib/nutrition/calculateMicronutrientTargets'
import { calculateClientNutritionTargets, normalizeCyclePhase } from '@/lib/nutrition/targetService'
import { safeErrorResponse } from '@/lib/security/http'
import { canTrackMicronutrients } from '@/lib/nutrition/memberNutrition'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)

    const client_id = searchParams.get('client_id') || ''

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return safeErrorResponse('Unauthorized', 401)

    const { data: client } = await supabase
      .from('clients')
      .select('client_id,program,access,active,verified_purchase,subscription_ends_at,membership_expires_at,onboarding_data,state,timezone')
      .eq('client_id', client_id)
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (!client) return safeErrorResponse('Client not found.', 404)
    if (!membershipCan(client, 'generatedCoaching')) return safeErrorResponse('Personalized nutrition targets are not included in this membership.', 403)

    // Access normalizes the stored tier separately. Preserve the existing
    // calculation input for legacy stored values; a query cannot replace it.
    const resolvedProgram = client.program
    const nutrition = await calculateClientNutritionTargets({
      supabase,
      clientId: client.client_id,
      program: resolvedProgram,
    })
    const { target, water, weightLbs } = nutrition
    const trainingLevel = resolvedProgram === 'phoenix'
      ? 'recovery'
      : resolvedProgram === 'ignite' || resolvedProgram === 'ember'
        ? 'strength_hypertrophy'
        : 'general_fitness'
    const micronutrientTargets = canTrackMicronutrients(client.program) ? calculateMicronutrientTargets({
      age: target.inputs.age || 35,
      calories: target.calories,
      weightLbs,
      waterOz: water,
      cyclePhase: normalizeCyclePhase(nutrition.phase),
      trainingLevel,
    }) : {}

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
      ...(canTrackMicronutrients(client.program) ? { micros:
        'Prioritize magnesium, potassium, sodium, calcium, iron, B vitamins, vitamin D, and omega-3 rich foods.' } : {}),
      recipes: [],
    })
  } catch (error) {
    return safeErrorResponse('Nutrition route failed', 500, error)
  }
}
