import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateMicronutrientTargets } from '@/lib/nutrition/calculateMicronutrientTargets'
import { getClientLocalDate } from '@/lib/timezone'

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

    if (!client_id) {
      return NextResponse.json(
        { error: 'Client ID is required.' },
        { status: 400 }
      )
    }

    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select(
        'client_id, auth_user_id, birthdate, timezone, state, onboarding_data'
      )
      .eq('client_id', client_id)
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (clientError) {
      return NextResponse.json(
        {
          error: 'Unable to load client profile.',
          details: clientError.message,
        },
        { status: 500 }
      )
    }

    if (!client) {
      return NextResponse.json(
        { error: 'Client not found.' },
        { status: 404 }
      )
    }

    const logDate = getClientLocalDate(client)
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

    const { data: nutritionLog, error: nutritionLogError } = await supabase
      .from('nutrition_logs')
      .upsert(
        {
          client_id: client.client_id,
          auth_user_id: user.id,
          log_date: logDate,
          protein: safeProtein,
          carbs: safeCarbs,
          fats: safeFats,
          calories: safeCalories,
          water_oz: safeWaterOz,
          meals: Array.isArray(meals) ? meals : [],
          completed: completed ?? false,
          ...micronutrientTargets,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'client_id,log_date',
        }
      )
      .select('*')
      .single()

    if (nutritionLogError) {
      console.error('NUTRITION LOG UPSERT ERROR:', nutritionLogError)

      return NextResponse.json(
        {
          error: 'Unable to prepare today’s nutrition log.',
          details: nutritionLogError.message,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      nutritionLog,
    })
  } catch (error) {
    console.error('NUTRITION LOG ERROR:', error)

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
