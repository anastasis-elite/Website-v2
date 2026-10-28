import { invalidateDailyPlan } from '@/lib/dashboard/invalidateDailyPlan'
import { getClientLocalDate } from '@/lib/timezone'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateMicronutrientTargets } from '@/lib/nutrition/calculateMicronutrientTargets'
import { calculateClientNutritionTargets, normalizeCyclePhase, nutritionLogAuditFields } from '@/lib/nutrition/targetService'
import { canTrackMicronutrients, memberNutritionLog } from '@/lib/nutrition/memberNutrition'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { clientId, ounces, submissionId, logDate } = await request.json()

    if (!clientId || typeof ounces !== 'number' || !Number.isFinite(ounces) || ounces <= 0) {
      return NextResponse.json(
        { error: 'Missing client or ounces.' },
        { status: 400 }
      )
    }
    if (typeof submissionId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(submissionId)) {
      return NextResponse.json({ error: 'A valid water submission identifier is required.' }, { status: 400 })
    }
    if (typeof logDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(logDate)) {
      return NextResponse.json({ error: 'A water log date is required.' }, { status: 400 })
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

    const today = getClientLocalDate(client)
    const staleDate = () => NextResponse.json({ error: 'This water submission belongs to another local day. Review that day’s saved hydration before logging again.' }, { status: 409 })
    if (logDate !== today) return staleDate()
    const { data: log, error: logError } = await supabase
      .from('nutrition_logs')
      .select('*')
      .eq('client_id', clientId)
      .eq('log_date', today)
      .maybeSingle()

    if (logError) {
      return NextResponse.json({ error: logError.message }, { status: 500 })
    }
    if (getClientLocalDate(client) !== today) return staleDate()

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
      const micronutrientTargets = canTrackMicronutrients(client.program) ? calculateMicronutrientTargets({
        age,
        calories: target.calories,
        weightLbs,
        waterOz: water,
        cyclePhase: normalizeCyclePhase(nutrition.phase),
        trainingLevel: 'general_fitness',
      }) : {}

      if (getClientLocalDate(client) !== today) return staleDate()

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

      if (getClientLocalDate(client) !== today) return staleDate()
      const { data: added, error: addError } = await supabase.rpc('add_daily_water', { p_log_id: newLog.id, p_ounces: ounces, p_submission_id: submissionId })
      if (addError) return NextResponse.json({ error: addError.message, retryWithSameSubmission: true }, { status: 500 })
      invalidateDailyPlan()
      return NextResponse.json({ success: true, nutritionLog: memberNutritionLog(added, client.program) })
    }

    // A pre-existing day can predate hydration targets. Repair only an invalid
    // target during this explicit save, and never overwrite a concurrent valid
    // saved target. Merely opening the water screen remains read-only.
    const savedWater = Number(log.water_oz)
    if (!Number.isFinite(savedWater) || savedWater <= 0) {
      const { water } = await calculateClientNutritionTargets({ supabase, clientId, failOnReadError: true })
      if (getClientLocalDate(client) !== today) return staleDate()
      const repair = supabase.from('nutrition_logs').update({ water_oz: water })
        .eq('id', log.id).eq('client_id', clientId).eq('auth_user_id', user.id).eq('log_date', today)
      const unchanged = log.water_oz === null || log.water_oz === undefined
        ? repair.is('water_oz', null) : repair.eq('water_oz', log.water_oz)
      const { data: repaired, error: repairError } = await unchanged.select('id,water_oz').maybeSingle()
      if (repairError) return NextResponse.json({ error: 'Today’s water target could not be saved.' }, { status: 500 })
      // A concurrent change makes the comparison fail. Confirm its target
      // rather than replacing it with this request's calculated value.
      const confirmed = repaired || (await supabase.from('nutrition_logs').select('id,water_oz')
        .eq('id', log.id).eq('auth_user_id', user.id).eq('log_date', today).maybeSingle()).data
      if (!confirmed || !Number.isFinite(Number(confirmed.water_oz)) || Number(confirmed.water_oz) <= 0) {
        return NextResponse.json({ error: 'Today’s water target could not be confirmed.' }, { status: 500 })
      }
    }

    if (getClientLocalDate(client) !== today) return staleDate()
    const { data, error } = await supabase.rpc('add_daily_water', { p_log_id: log.id, p_ounces: ounces, p_submission_id: submissionId })

    if (error) {
      return NextResponse.json({ error: error.message, retryWithSameSubmission: true }, { status: 500 })
    }

    invalidateDailyPlan()

    return NextResponse.json({
      success: true,
      nutritionLog: memberNutritionLog(data, client.program),
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
