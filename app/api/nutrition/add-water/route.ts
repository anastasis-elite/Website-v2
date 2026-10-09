import { invalidateDailyPlan } from '@/lib/dashboard/invalidateDailyPlan'
import { getClientLocalDate } from '@/lib/timezone'
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

    const { clientId, ounces, submissionId } = await request.json()

    if (!clientId || typeof ounces !== 'number' || !Number.isFinite(ounces) || ounces <= 0) {
      return NextResponse.json(
        { error: 'Missing client or ounces.' },
        { status: 400 }
      )
    }


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

    if (submissionId && !/^[0-9a-f-]{36}$/i.test(submissionId)) return NextResponse.json({ error: 'Invalid water submission.' }, { status: 400 })
    const requestId = submissionId || crypto.randomUUID()
    const today = getClientLocalDate(client)
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

      let { data: newLog, error: insertError } = await supabase
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
          water_consumed_oz: 0,
          ...micronutrientTargets,
          ...nutritionLogAuditFields(target),
          updated_at: new Date().toISOString(),
        })
        .select('*')
        .single()

      if (insertError?.code === '23505') {
        const retry = await supabase.from('nutrition_logs').select('*').eq('client_id', clientId).eq('log_date', today).single()
        newLog = retry.data; insertError = retry.error
      }
      if (insertError || !newLog) {
        return NextResponse.json(
          { error: insertError?.message || 'Today’s water log could not be opened.' },
          { status: 500 }
        )
      }

      const { data: added, error: addError } = await supabase.rpc('add_daily_water', { p_log_id: newLog.id, p_ounces: ounces, p_submission_id: requestId })
      if (addError) return NextResponse.json({ error: 'Water could not be saved. Your intake was not added; try again.' }, { status: 500 })
      invalidateDailyPlan()
      return NextResponse.json({ success: true, nutritionLog: added })
    }

    const { data, error } = await supabase.rpc('add_daily_water', { p_log_id: log.id, p_ounces: ounces, p_submission_id: requestId })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    invalidateDailyPlan()

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
