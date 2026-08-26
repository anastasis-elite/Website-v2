import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateMicronutrientTargets } from '@/lib/nutrition/calculateMicronutrientTargets'
import { calculateClientNutritionTargets, normalizeCyclePhase } from '@/lib/nutrition/targetService'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)

    const client_id = searchParams.get('client_id') || ''
    const program = searchParams.get('program') || ''

    const supabase = await createClient()
    const nutrition = await calculateClientNutritionTargets({
      supabase,
      clientId: client_id,
      program,
    })
    const { target, water, weightLbs } = nutrition
    const trainingLevel = program === 'phoenix'
      ? 'recovery'
      : program === 'ignite' || program === 'ember'
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
      client_id,
      program,
      tdee: target.estimatedTdee,
      calories: target.calories,
      protein: target.protein,
      carbs: target.carbs,
      fats: target.fats,
      water,
      formulaVersion: target.formulaVersion,
      calculationMode: target.calculationMode,
      calculationStatus: target.calculationStatus,
      statusLabel: target.statusLabel,
      statusDescription: target.statusDescription,
      bmr: target.bmr,
      estimatedTdee: target.estimatedTdee,
      goalAdjustedCalories: target.goalAdjustedCalories,
      bmi: target.bmi,
      bodyFatPercentUsed: target.bodyFatPercentUsed,
      leanBodyMassKg: target.leanBodyMassKg,
      fatMassKg: target.fatMassKg,
      activityFactor: target.activityFactor,
      rollingActiveEnergy: target.rollingActiveEnergy,
      rollingRestingEnergy: target.rollingRestingEnergy,
      goalModifier: target.goalModifier,
      defaultMacroPercentages: target.defaultMacroPercentages,
      finalMacroPercentages: target.finalMacroPercentages,
      safeguardAdjusted: target.safeguardAdjusted,
      safeguardsApplied: target.safeguardsApplied,
      dataDateRange: target.dataDateRange,
      lastCalculatedAt: target.lastCalculatedAt,
      nutritionCalculation: target,
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
