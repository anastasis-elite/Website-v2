export async function getRecoveryRecommendation({
  supabase,
  client,
  user,
}: {
  supabase: any
  client: any
  user: any
}) {
  const today = new Date().toISOString().split('T')[0]

  const { data: todayRecoveryLog } = await supabase
    .from('recovery_logs')
    .select('*')
    .eq('client_id', client.client_id)
    .eq('log_date', today)
    .maybeSingle()

  const { data: todayWorkoutLog } = await supabase
    .from('workout_logs')
    .select('*')
    .eq('client_id', client.client_id)
    .gte('workout_date', `${today}T00:00:00.000Z`)
    .lte('workout_date', `${today}T23:59:59.999Z`)
    .maybeSingle()

  const { data: todayNutritionLog } = await supabase
    .from('nutrition_logs')
    .select('*')
    .eq('client_id', client.client_id)
    .eq('log_date', today)
    .maybeSingle()

  const sleepQuality = Number(todayRecoveryLog?.sleep_quality || 0)
  const sorenessLevel = Number(todayRecoveryLog?.soreness_level || 0)
  const stressLevel = Number(todayRecoveryLog?.stress_level || 0)
  const energyLevel = Number(todayRecoveryLog?.energy_level || 0)
  const hydrationLevel = Number(todayRecoveryLog?.hydration_level || 0)

  const sick = !!todayRecoveryLog?.sick
  const dizzy = !!todayRecoveryLog?.dizzy
  const cycleSymptoms = !!todayRecoveryLog?.cycle_symptoms
  const unusuallyFatigued = !!todayRecoveryLog?.unusually_fatigued

  const workoutCompleted = !!todayWorkoutLog?.completed

  const nutritionLogged =
    !!todayNutritionLog &&
    (
      Number(todayNutritionLog.protein || 0) > 0 ||
      Number(todayNutritionLog.carbs || 0) > 0 ||
      Number(todayNutritionLog.fats || 0) > 0 ||
      Number(todayNutritionLog.water_oz || 0) > 0
    )

  let recoveryFocus = 'baseline'
  let title = 'Baseline recovery'
  let recommendation =
    'Keep your recovery simple today. Hydrate, eat enough to support your training, and give your body a clear rhythm to adapt to.'
  let saunaAllowed = false
  let intensity = 'normal'

  if (sick || dizzy) {
    recoveryFocus = 'rest'
    title = 'Recovery comes first today'
    recommendation =
      'Your system is showing a clear recovery flag today. Skip sauna, avoid extra intensity, hydrate steadily, and let your body stabilize before asking more from it.'
    saunaAllowed = false
    intensity = 'low'
  } else if (unusuallyFatigued || energyLevel > 0 && energyLevel <= 3) {
    recoveryFocus = 'nervous_system'
    title = 'Downshift before you push'
    recommendation =
      'Your body may need regulation more than intensity today. Keep movement gentle, prioritize food and hydration, and use breathwork, stretching, or a quiet walk before adding extra stress.'
    saunaAllowed = false
    intensity = 'low'
  } else if (hydrationLevel > 0 && hydrationLevel <= 4) {
    recoveryFocus = 'hydration'
    title = 'Hydration is the recovery priority'
    recommendation =
      'Before adding sauna or extra recovery stress, stabilize hydration. Aim for steady water and electrolytes first so your system has enough fluid support to recover well.'
    saunaAllowed = false
    intensity = 'normal'
  } else if (sorenessLevel >= 7) {
    recoveryFocus = 'mobility'
    title = 'Soreness needs movement, not force'
    recommendation =
      'Today is a good day for gentle mobility, walking, and blood flow. Avoid turning recovery into another workout. Let the body receive instead of perform.'
    saunaAllowed = false
    intensity = 'low'
  } else if (stressLevel >= 7) {
    recoveryFocus = 'nervous_system'
    title = 'Your nervous system is part of the program'
    recommendation =
      'High stress changes how your body responds to training. Prioritize a downshift today: slower breathing, a calmer pace, food, hydration, and reduced pressure.'
    saunaAllowed = false
    intensity = 'low'
  } else if (cycleSymptoms) {
    recoveryFocus = 'cycle_support'
    title = 'Support the phase you are in'
    recommendation =
      'Cycle symptoms are useful data. Keep recovery supportive today with hydration, minerals, enough food, and lower-pressure movement if your body is asking for it.'
    saunaAllowed = false
    intensity = 'moderate'
  } else if (workoutCompleted && nutritionLogged) {
    recoveryFocus = 'sauna_available'
    title = 'Sauna may be available today'
    recommendation =
      'Your main recovery inputs look supported today. Sauna may be an option if you feel hydrated, steady, well-fed, and not dizzy, sick, overheated, or medically restricted.'
    saunaAllowed = true
    intensity = 'normal'
  } else if (workoutCompleted && !nutritionLogged) {
    recoveryFocus = 'nutrition_first'
    title = 'Refuel before adding recovery tools'
    recommendation =
      'Training is only one part of the signal. Before adding sauna or extra recovery stress, give your body food, water, and minerals so it can actually adapt.'
    saunaAllowed = false
    intensity = 'normal'
  }

  return {
    date: today,
    recoveryFocus,
    title,
    recommendation,
    saunaAllowed,
    intensity,
    workoutCompleted,
    nutritionLogged,
    hasRecoveryCheckIn: !!todayRecoveryLog,
  }
}
