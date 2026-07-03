import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { analyzeSymptomSignal } from '@/lib/symptoms/analyzeSymptomSignal'

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()

  const {
    clientId,
    symptomTypeId,
    bodyRegionId,
    severity,
    notes,
    startedMinutesAfterMeal,
    durationMinutes,
  } = body

  if (!clientId || !symptomTypeId) {
    return NextResponse.json(
      { error: 'Missing client or symptom.' },
      { status: 400 }
    )
  }

  const { data: ownedClient } = await supabase
    .from('clients')
    .select('client_id')
    .eq('client_id', clientId)
    .eq('auth_user_id', user.id)
    .maybeSingle()
  if (!ownedClient) return NextResponse.json({ error: 'Client not found.' }, { status: 404 })

  const { data: symptomType, error: symptomError } = await supabase
    .from('symptom_types')
    .select('id, name, category')
    .eq('id', symptomTypeId)
    .single()

  if (symptomError || !symptomType) {
    return NextResponse.json(
      { error: 'Symptom type not found.' },
      { status: 404 }
    )
  }

  const today = new Date().toISOString().split('T')[0]

  const { data: todayCycleLog } = await supabase
    .from('cycle_logs')
    .select('*')
    .eq('client_id', clientId)
    .eq('log_date', today)
    .maybeSingle()

  const { data: nutritionLogs } = await supabase.from('nutrition_logs').select('id').eq('client_id', clientId).order('log_date', { ascending: false }).limit(14)
  const nutritionLogIds = (nutritionLogs || []).map((log: any) => log.id)
  const { data: recentMeals } = nutritionLogIds.length ? await supabase
    .from('meal_entries')
    .select(`
      id,
      created_at,
      food_id,
      foods (
        name
      ),
      food_tags (
        contains_gluten,
        contains_dairy,
        contains_lactose,
        contains_soy,
        contains_egg,
        fodmap_risk,
        sodium_level,
        additive_risk
      )
    `)
    .in('nutrition_log_id', nutritionLogIds)
    .order('created_at', { ascending: false }).limit(10) : { data: [] }

  const recentFoodTags =
    recentMeals?.flatMap((meal: any) => {
      const tags = meal.food_tags

      if (!tags) return []

      return [
        tags.contains_gluten ? 'contains_gluten' : null,
        tags.contains_dairy ? 'contains_dairy' : null,
        tags.contains_lactose ? 'contains_lactose' : null,
        tags.contains_soy ? 'contains_soy' : null,
        tags.contains_egg ? 'contains_egg' : null,
        tags.fodmap_risk === 'high' ? 'high_fodmap' : null,
        tags.sodium_level === 'high' ? 'high_sodium' : null,
        tags.additive_risk === 'high' ? 'additive_risk' : null,
      ].filter(Boolean)
    }) || []

  const analysis = analyzeSymptomSignal({
    symptomName: symptomType.name,
    symptomCategory: symptomType.category,
    severity: severity ? Number(severity) : null,

    cyclePhase: todayCycleLog?.phase || 'unknown',
    cycleDay: todayCycleLog?.cycle_day || null,
    repeatedInSameCycleWindow: false,

    minutesAfterMeal: startedMinutesAfterMeal
      ? Number(startedMinutesAfterMeal)
      : null,
    repeatedAfterSameFoodOrTag: false,
    recentFoodTags: recentFoodTags as string[],

    caffeineMgToday: null,
    minutesAfterCaffeine: null,

    trainingToday: false,
    highOutputBlockToday: false,
    stressRating: null,
    sleepHours: null,
  })

  const { data: symptomLog, error } = await supabase
    .from('client_symptom_logs')
    .insert({
      client_id: clientId,
      auth_user_id: user.id,
      symptom_type_id: symptomTypeId,
      body_region_id: bodyRegionId || null,
      severity: severity ? Number(severity) : null,
      started_minutes_after_meal: startedMinutesAfterMeal
        ? Number(startedMinutesAfterMeal)
        : null,
      duration_minutes: durationMinutes ? Number(durationMinutes) : null,
      notes: notes || null,

      likely_cycle_related: analysis.likelyCycleRelated,
      likely_food_related: analysis.likelyFoodRelated,
      likely_caffeine_related: analysis.likelyCaffeineRelated,
      likely_load_related: analysis.likelyLoadRelated,
      confidence_score: analysis.confidenceScore,
      analysis_note: analysis.analysisNote,
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    symptomLog,
    analysis,
  })
}
