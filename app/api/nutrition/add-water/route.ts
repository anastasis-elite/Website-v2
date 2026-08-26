import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateMicronutrientTargets } from '@/lib/nutrition/calculateMicronutrientTargets'
import { calculateClientNutritionTargets, normalizeCyclePhase, nutritionLogAuditFields } from '@/lib/nutrition/targetService'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { clientId, ounces } = await request.json()

    if (!clientId || !ounces) {
      return NextResponse.json(
        { error: 'Missing client or ounces.' },
        { status: 400 }
      )
    }

    const today = new Date().toISOString().split('T')[0]

    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('client_id', clientId)
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (clientError) {
      return NextResponse.json({ error: clientError.message }, { status: 500 })
    }

    if (!client) {
      return NextResponse.json({ error: 'Client not found.' }, { status: 404 })
    }

    const { data: log, error: logError } = await supabase
      .from('nutrition_logs')
      .select('*')
      .eq('client_id', clientId)
      .eq('log_date', today)
      .maybeSingle()

    if (logError) {
      return NextResponse.json({ error: logError.message }, { status: 500 })
    }

    if (!log) {
      const nutrition = await calculateClientNutritionTargets({
        supabase,
        clientId,
      })
      const { target, water, weightLbs } = nutrition
      const birthdate = client.birthdate ? new Date(client.birthdate) : null
      const now = new Date()
      const age = birthdate && !Number.isNaN(birthdate.getTime())
        ? now.getFullYear() - birthdate.getFullYear() - (now < new Date(now.getFullYear(), birthdate.getMonth(), birthdate.getDate()) ? 1 : 0)
        : 35
      const micronutrientTargets = calculateMicronutrientTargets({
        age,
        calories: target.calories,
        weightLbs,
        waterOz: water,
        cyclePhase: normalizeCyclePhase(nutrition.phase),
        trainingLevel: 'general_fitness',
      })

      const { data: newLog, error: insertError } = await supabase
        .from('nutrition_logs')
        .insert({
          client_id: clientId,
          auth_user_id: user.id,
          log_date: today,
          calories: target.calories,
          protein: target.protein,
          carbs: target.carbs,
          fats: target.fats,
          water_oz: water,
          water_consumed_oz: Number(ounces),
          ...micronutrientTargets,
          ...nutritionLogAuditFields(target),
          updated_at: new Date().toISOString(),
        })
        .select('*')
        .single()

      if (insertError) {
        return NextResponse.json(
          { error: insertError.message },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        nutritionLog: newLog,
      })
    }

    const newWaterTotal =
      Number(log.water_consumed_oz || 0) + Number(ounces)

    const { data, error } = await supabase
      .from('nutrition_logs')
      .update({
        water_consumed_oz: newWaterTotal,
        updated_at: new Date().toISOString(),
      })
      .eq('id', log.id)
      .eq('auth_user_id', user.id)
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      nutritionLog: data,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Water quick add failed',
      },
      { status: 500 }
    )
  }
}
