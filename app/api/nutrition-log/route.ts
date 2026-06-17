import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateMicronutrientTargets } from '@/lib/nutrition/calculateAdaptiveMicronutrientTargets'

function calculateAge(birthdate?: string | null) {
  if (!birthdate) return 35

  const today = new Date()
  const birth = new Date(birthdate)

  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birth.getDate())
  ) {
    age -= 1
  }

  return age
}

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
      cyclePhase,
      trainingLevel,
    } = body

    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('client_id, auth_user_id, birthdate')
      .eq('client_id', client_id)
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (clientError) {
      return NextResponse.json(
        { error: clientError.message },
        { status: 500 }
      )
    }

    if (!client) {
      return NextResponse.json(
        { error: 'Client not found.' },
        { status: 404 }
      )
    }

    const age = calculateAge(client.birthdate)
    const safeCalories = Number(calories || 2000)
    const safeProtein = Number(protein || 0)
    const safeCarbs = Number(carbs || 0)
    const safeFats = Number(fats || 0)
    const safeWaterOz = Number(water_oz || 90)

    const estimatedWeightLbs = Math.max(
      100,
      Math.round(safeWaterOz / 0.6)
    )

    const micronutrientTargets = calculateMicronutrientTargets({
      age,
      calories: safeCalories,
      weightLbs: estimatedWeightLbs,
      waterOz: safeWaterOz,
      cyclePhase: cyclePhase || 'unknown',
      trainingLevel: trainingLevel || 'general_fitness',
    })

    const { error } = await supabase
      .from('nutrition_logs')
      .upsert(
        {
          client_id,
          auth_user_id: user.id,
          log_date,
          protein: safeProtein,
          carbs: safeCarbs,
          fats: safeFats,
          calories: safeCalories,
          water_oz: safeWaterOz,
          meals: meals || [],
          completed: completed ?? false,
          ...micronutrientTargets,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'client_id,log_date',
        }
      )

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
