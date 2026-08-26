import { NextResponse } from 'next/server'
import { calculateMicronutrientTargets } from '@/lib/nutrition/calculateMicronutrientTargets'
import { calculateClientNutritionTargets, normalizeCyclePhase, nutritionLogAuditFields } from '@/lib/nutrition/targetService'
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

    const nutrition = await calculateClientNutritionTargets({
      supabase: context.supabase,
      clientId: context.client.client_id,
    })
    const { target, water, weightLbs } = nutrition
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
        calories: target.calories,
        protein: target.protein,
        carbs: target.carbs,
        fats: target.fats,
        water_oz: water,
        water_consumed_oz: ounces,
        ...calculateMicronutrientTargets({
          age,
          calories: target.calories,
          weightLbs,
          waterOz: water,
          cyclePhase: normalizeCyclePhase(nutrition.phase),
          trainingLevel: 'general_fitness',
        }),
        ...nutritionLogAuditFields(target),
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
