import type { PhoenixCapacity, PhoenixDashboardData, PhoenixPlanBlock } from './types'

function number(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function capacity(client: any): PhoenixCapacity {
  const raw = String(client.capacity_state || client.capacity || '').toLowerCase()
  if (raw === 'high' || raw === 'energized') return 'high'
  if (raw === 'medium' || raw === 'steady') return 'medium'
  return 'low'
}

function streak(client: any) {
  // TODO: Replace client-field fallbacks with durable completion-history calculation.
  return Math.max(0, Math.round(number(client.current_streak ?? client.execution_streak ?? client.streak)))
}

function buildPlan({
  capacityLevel,
  persisted,
  waterPercent,
  nutritionLogged,
  assessmentCompleted,
  recoveryCompleted,
}: {
  capacityLevel: PhoenixCapacity
  persisted: Set<string>
  waterPercent: number
  nutritionLogged: boolean
  assessmentCompleted: boolean
  recoveryCompleted: boolean
}): PhoenixPlanBlock[] {
  const complete = (id: string, tracked = false) => persisted.has(id) || tracked
  const blocks: PhoenixPlanBlock[] = [
    { id: 'morning', title: 'Morning', focus: 'Hydrate + fuel', tasks: [
      { id: 'morning-water', label: 'Drink water', detail: 'One glass is enough to start.', href: '/dashboard/nutrition', complete: complete('morning-water', waterPercent >= 20) },
      { id: 'morning-breakfast', label: 'Simple breakfast', detail: 'Add protein when you can.', href: '/dashboard/nutrition', complete: complete('morning-breakfast', nutritionLogged) },
      { id: 'morning-checkin', label: 'Morning check-in', detail: 'How are you feeling?', href: '/dashboard/assessment', complete: complete('morning-checkin', assessmentCompleted), secondary: capacityLevel === 'high' },
    ] },
    { id: 'midday', title: 'Midday', focus: 'Stay on track', tasks: [
      { id: 'midday-lunch', label: 'Eat lunch', detail: 'Balance + protein.', href: '/dashboard/nutrition', complete: complete('midday-lunch', nutritionLogged) },
      { id: 'midday-movement', label: 'Move your body', detail: 'Ten easy minutes.', href: '/dashboard/recovery', complete: complete('midday-movement') },
      { id: 'midday-checkin', label: 'Midday check-in', detail: 'Energy + stress.', href: '/dashboard/recovery', complete: complete('midday-checkin', recoveryCompleted), secondary: capacityLevel === 'high' },
    ] },
    { id: 'evening', title: 'Evening', focus: 'Reset + reflect', tasks: [
      { id: 'evening-dinner', label: 'Eat dinner', detail: 'Keep it simple.', href: '/dashboard/nutrition', complete: complete('evening-dinner', nutritionLogged) },
      { id: 'evening-wind-down', label: 'Wind down', detail: 'Calm your mind.', href: '/dashboard/recovery', complete: complete('evening-wind-down') },
      { id: 'evening-checkin', label: 'Evening check-in', detail: 'How was your day?', href: '/dashboard/recovery', complete: complete('evening-checkin', recoveryCompleted), secondary: capacityLevel === 'high' },
    ] },
  ]
  const limit = capacityLevel === 'low' ? 2 : 3
  return blocks.map((block) => ({ ...block, tasks: block.tasks.slice(0, limit) }))
}

export async function getPhoenixDashboardData({
  supabase,
  user,
  client,
  dailyPlan,
  todaysWorkout,
  phoenixTrackLabel,
}: {
  supabase: any
  user: any
  client: any
  dailyPlan: any
  todaysWorkout: any
  phoenixTrackLabel: string
}): Promise<PhoenixDashboardData> {
  const today = new Date().toISOString().slice(0, 10)
  const start = `${today}T00:00:00.000Z`
  const end = `${today}T23:59:59.999Z`
  const [
    { data: taskRows },
    { data: assessment },
    { data: recovery },
    { data: symptom },
  ] = await Promise.all([
    supabase.from('phoenix_daily_task_completions').select('task_id').eq('user_id', user.id).eq('client_id', client.client_id).eq('log_date', today),
    supabase.from('assessments').select('id').eq('client_id', client.client_id).gte('submitted_at', start).lte('submitted_at', end).limit(1).maybeSingle(),
    supabase.from('recovery_logs').select('*').eq('client_id', client.client_id).eq('log_date', today).limit(1).maybeSingle(),
    supabase.from('client_symptom_logs').select('id').eq('client_id', client.client_id).gte('created_at', start).lte('created_at', end).limit(1).maybeSingle(),
  ])

  const targets = dailyPlan?.dailyTargets || {}
  const remaining = dailyPlan?.dailyRemaining || {}
  const target = (key: string) => number(targets[key])
  const consumed = (key: string) => Math.max(0, target(key) - number(remaining[key]))
  const waterTarget = Math.max(1, target('water') || 100)
  const waterConsumed = consumed('water')
  const capacityLevel = capacity(client)
  const assessmentCompleted = Boolean(assessment)
  const recoveryCompleted = Boolean(recovery || symptom)
  const persisted = new Set<string>((taskRows || []).map((row: any) => row.task_id))
  // TODO: Prefer a dedicated sleep log when that integration/table is available.
  const sleepHours = nullableNumber(recovery?.sleep_hours ?? recovery?.sleep_duration_hours)
  const sleepQuality = nullableNumber(recovery?.sleep_quality)

  return {
    clientId: client.client_id,
    clientName: String(client.full_name || client.first_name || 'there').split(' ')[0],
    streak: streak(client),
    capacity: capacityLevel,
    trackLabel: phoenixTrackLabel,
    water: { consumed: waterConsumed, target: waterTarget, increment: Math.max(1, number(client.water_increment_oz, 8)) },
    macros: [
      { key: 'protein', label: 'Protein', consumed: consumed('protein'), target: target('protein') },
      { key: 'carbs', label: 'Carbs', consumed: consumed('carbs'), target: target('carbs') },
      { key: 'fats', label: 'Fats', consumed: consumed('fats'), target: target('fats') },
    ],
    workout: { assigned: Boolean(todaysWorkout), completed: Boolean(dailyPlan?.workoutCompleted), title: todaysWorkout?.day_name || 'Recovery walk' },
    assessment: { completed: assessmentCompleted },
    recovery: { completed: recoveryCompleted },
    sleep: { logged: sleepHours !== null || sleepQuality !== null, hours: sleepHours, quality: sleepQuality },
    plan: buildPlan({ capacityLevel, persisted, waterPercent: (waterConsumed / waterTarget) * 100, nutritionLogged: Boolean(dailyPlan?.nutritionLogged), assessmentCompleted, recoveryCompleted }),
    focus: capacityLevel === 'low'
      ? { message: 'Progress, not perfection. Small steps still count.', intention: 'Support my body with the next simple step.' }
      : capacityLevel === 'medium'
        ? { message: 'Steady choices create meaningful change.', intention: 'Take care of my body in three simple ways.' }
        : { message: 'You have room today. Keep the essentials first.', intention: 'Complete the plan, then choose one optional stretch.' },
  }
}
