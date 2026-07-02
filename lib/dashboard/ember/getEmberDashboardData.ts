import type { EmberDashboardData, EmberMacro } from './types'

function safeNumber(value: unknown, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function consumed(target: number, remaining: unknown) {
  return Math.max(0, target - safeNumber(remaining))
}

function getStreak(client: any) {
  // TODO: Replace this fallback chain with the completion-history table once it exists.
  return Math.max(
    0,
    Math.round(
      safeNumber(
        client.current_streak ?? client.execution_streak ?? client.streak,
        0
      )
    )
  )
}

function recoveryRequired() {
  // TODO: Let adaptive recovery rules make this conditional when that signal is persisted.
  return true
}

export async function getEmberDashboardData({
  supabase,
  client,
  dailyPlan,
  todaysWorkout,
}: {
  supabase: any
  client: any
  dailyPlan: any
  todaysWorkout: any
}): Promise<EmberDashboardData> {
  const today = new Date().toISOString().slice(0, 10)
  const start = `${today}T00:00:00.000Z`
  const end = `${today}T23:59:59.999Z`

  const [{ data: assessment }, { data: recovery }, { data: symptom }] =
    await Promise.all([
      supabase
        .from('assessments')
        .select('id')
        .eq('client_id', client.client_id)
        .gte('submitted_at', start)
        .lte('submitted_at', end)
        .limit(1)
        .maybeSingle(),
      supabase
        .from('recovery_logs')
        .select('id')
        .eq('client_id', client.client_id)
        .eq('log_date', today)
        .limit(1)
        .maybeSingle(),
      supabase
        .from('client_symptom_logs')
        .select('id')
        .eq('client_id', client.client_id)
        .gte('created_at', start)
        .lte('created_at', end)
        .limit(1)
        .maybeSingle(),
    ])

  const targets = dailyPlan?.dailyTargets || {}
  const remaining = dailyPlan?.dailyRemaining || {}
  const protein = safeNumber(targets.protein)
  const carbs = safeNumber(targets.carbs)
  const fats = safeNumber(targets.fats)
  const calories = safeNumber(dailyPlan?.calories)
  const waterTarget = Math.max(1, safeNumber(targets.water, 100))
  const waterConsumed = consumed(waterTarget, remaining.water)

  const macros: EmberMacro[] = [
    { key: 'protein', label: 'Protein', consumed: consumed(protein, remaining.protein), target: protein, unit: 'g' },
    { key: 'carbs', label: 'Carbs', consumed: consumed(carbs, remaining.carbs), target: carbs, unit: 'g' },
    { key: 'fats', label: 'Fats', consumed: consumed(fats, remaining.fats), target: fats, unit: 'g' },
    { key: 'calories', label: 'Calories', consumed: consumed(calories, remaining.calories), target: calories, unit: 'cal' },
  ]

  return {
    clientId: client.client_id,
    clientName: String(client.full_name || client.first_name || 'there').split(' ')[0],
    streak: getStreak(client),
    water: {
      consumed: waterConsumed,
      target: waterTarget,
      increment: Math.max(1, safeNumber(client.water_increment_oz, 8)),
    },
    macros,
    workout: {
      name: todaysWorkout?.day_name || 'Recovery day',
      type: todaysWorkout?.workout_type || todaysWorkout?.focus || (todaysWorkout ? 'Training' : 'No training assigned'),
      assigned: Boolean(todaysWorkout),
      completed: Boolean(dailyPlan?.workoutCompleted),
    },
    assessment: {
      required: true,
      completed: Boolean(assessment),
      label: 'Daily assessment',
    },
    recovery: {
      required: recoveryRequired(),
      completed: Boolean(recovery || symptom),
      label: 'How do you feel?',
    },
  }
}
