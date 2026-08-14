import { NextResponse } from 'next/server'
import { calculateMicronutrientTargets } from '@/lib/nutrition/calculateMicronutrientTargets'
import { getClientLocalDateOffset } from '@/lib/timezone'
import { createMobileRequestContext } from '@/lib/mobile/auth'

export async function POST(request: Request) {
  try {
    const context = await createMobileRequestContext(request)

    if ('error' in context) {
      return NextResponse.json(
        { error: context.error },
        { status: context.status },
      )
    }

    const body = await request.json().catch(() => ({}))
    const ounces = Math.max(1, Math.min(64, Number(body.ounces || 8)))
    const today = getClientLocalDateOffset(context.client)

    const { data: existingLog, error: logError } = await context.supabase
      .from('nutrition_logs')
      .select('*')
      .eq('client_id', context.client.client_id)
      .eq('log_date', today)
      .maybeSingle()

    if (logError) {
      return NextResponse.json({ error: logError.message }, { status: 500 })
    }

    if (existingLog) {
      const { data, error } = await context.supabase
        .from('nutrition_logs')
        .update({
          water_consumed_oz:
            Number(existingLog.water_consumed_oz || 0) + ounces,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingLog.id)
        .eq('auth_user_id', context.user.id)
        .select('*')
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ success: true, nutritionLog: data })
    }

    const { data: strengthAssessment } = await context.supabase
      .from('assessments')
      .select('*')
      .eq('client_id', context.client.client_id)
      .eq('assessment_type', 'strength')
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const weight = Number(strengthAssessment?.data?.weight || 0)
    const calories = weight ? Math.round(weight * 12) : 2000
    const protein = weight ? Math.round(weight * 0.8) : 150
    const fats = Math.round((calories * 0.28) / 9)
    const carbs = Math.round((calories - protein * 4 - fats * 9) / 4)
    const water = weight ? Math.round(weight * 0.6) : 100
    const birthdate = context.client.birthdate
      ? new Date(context.client.birthdate)
      : null
    const now = new Date()
    const age =
      birthdate && !Number.isNaN(birthdate.getTime())
        ? now.getFullYear() -
          birthdate.getFullYear() -
          (now <
          new Date(now.getFullYear(), birthdate.getMonth(), birthdate.getDate())
            ? 1
            : 0)
        : 35

    const { data, error } = await context.supabase
      .from('nutrition_logs')
      .insert({
        client_id: context.client.client_id,
        auth_user_id: context.user.id,
        log_date: today,
        calories,
        protein,
        carbs,
        fats,
        water_oz: water,
        water_consumed_oz: ounces,
        ...calculateMicronutrientTargets({
          age,
          calories,
          weightLbs: weight || Math.max(100, Math.round(water / 0.6)),
          waterOz: water,
          cyclePhase: 'unknown',
          trainingLevel: 'general_fitness',
        }),
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, nutritionLog: data })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Water quick add failed.',
      },
      { status: 500 },
    )
  }
}
