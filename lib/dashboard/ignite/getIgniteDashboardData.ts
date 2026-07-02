import type { IgniteDashboardData, IgnitePlanBlock, IgniteTrend } from './types'

function number(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function percentChange(current: number | null, previous: number | null) {
  if (current === null || previous === null || previous === 0) return null
  return Math.round(((current - previous) / previous) * 100)
}

function average(values: Array<number | null>) {
  const present = values.filter((value): value is number => value !== null)
  return present.length ? present.reduce((total, value) => total + value, 0) / present.length : null
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

function datesEnding(offsetDays: number) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date()
    date.setUTCHours(0, 0, 0, 0)
    date.setUTCDate(date.getUTCDate() - offsetDays - (6 - index))
    return dateKey(date)
  })
}

function streak(client: any) {
  // TODO: Replace client-field fallbacks with durable daily-completion history.
  return Math.max(0, Math.round(number(client.current_streak ?? client.execution_streak ?? client.streak)))
}

function planBlocks({
  waterPercent,
  nutritionLogged,
  proteinPercent,
  workoutAssigned,
  workoutCompleted,
  assessmentCompleted,
  recoveryCompleted,
}: {
  waterPercent: number
  nutritionLogged: boolean
  proteinPercent: number
  workoutAssigned: boolean
  workoutCompleted: boolean
  assessmentCompleted: boolean
  recoveryCompleted: boolean
}): IgnitePlanBlock[] {
  return [
    {
      id: 'morning', title: 'Morning', focus: 'Hydrate + fuel',
      tasks: [
        { id: 'morning-water', label: 'Build hydration momentum', href: '/dashboard/nutrition', complete: waterPercent >= 35, autoTracked: true },
        { id: 'morning-breakfast', label: 'Protein-focused first meal', href: '/dashboard/nutrition', complete: nutritionLogged, autoTracked: true },
        { id: 'morning-assessment', label: 'Morning assessment', href: '/dashboard/assessment', complete: assessmentCompleted, autoTracked: true },
      ],
    },
    {
      id: 'midday', title: 'Midday', focus: 'Stay on track',
      tasks: [
        { id: 'midday-protein', label: 'Protect your protein target', href: '/dashboard/nutrition', complete: proteinPercent >= 60, autoTracked: true },
        { id: 'midday-walk', label: '10 minute walk', href: '/dashboard/day/midday', complete: false, autoTracked: false },
        { id: 'midday-lunch', label: 'Check in + log lunch', href: '/dashboard/nutrition', complete: nutritionLogged, autoTracked: true },
      ],
    },
    {
      id: 'evening', title: 'Evening', focus: 'Recover + reflect',
      tasks: [
        { id: 'evening-workout', label: workoutAssigned ? 'Complete workout' : 'Honor recovery day', href: '/dashboard/program/ignite/workout', complete: !workoutAssigned || workoutCompleted, autoTracked: true },
        { id: 'evening-nutrition', label: 'Post-workout nutrition', href: '/dashboard/nutrition', complete: nutritionLogged, autoTracked: true },
        { id: 'evening-recovery', label: 'Evening check-in', href: '/dashboard/recovery', complete: recoveryCompleted, autoTracked: true },
      ],
    },
  ]
}

export async function getIgniteDashboardData({
  supabase,
  client,
  dailyPlan,
  todaysWorkout,
  cycleStatus,
  cycleAdjustment,
  monthlyAssessmentsDueCount,
  insight,
}: {
  supabase: any
  client: any
  dailyPlan: any
  todaysWorkout: any
  cycleStatus: any
  cycleAdjustment: { label: string; note: string }
  monthlyAssessmentsDueCount: number
  insight: any
}): Promise<IgniteDashboardData> {
  const today = dateKey(new Date())
  const todayStart = `${today}T00:00:00.000Z`
  const todayEnd = `${today}T23:59:59.999Z`
  const thisWeek = datesEnding(0)
  const lastWeek = datesEnding(7)
  const fourteenDaysAgo = lastWeek[0]

  const [
    { data: todayAssessment },
    { data: recoveryLog },
    { data: symptomLog },
    { data: nutritionLogs },
    { data: workoutLogs },
    { data: strengthAssessments },
    { data: photoRecord },
  ] = await Promise.all([
    supabase.from('assessments').select('id').eq('client_id', client.client_id).gte('submitted_at', todayStart).lte('submitted_at', todayEnd).limit(1).maybeSingle(),
    supabase.from('recovery_logs').select('*').eq('client_id', client.client_id).eq('log_date', today).limit(1).maybeSingle(),
    supabase.from('client_symptom_logs').select('id').eq('client_id', client.client_id).gte('created_at', todayStart).lte('created_at', todayEnd).limit(1).maybeSingle(),
    supabase.from('nutrition_logs').select('id,log_date,water_consumed_oz').eq('client_id', client.client_id).gte('log_date', fourteenDaysAgo).lte('log_date', today).order('log_date'),
    supabase.from('workout_logs').select('workout_date,completed').eq('client_id', client.client_id).gte('workout_date', `${fourteenDaysAgo}T00:00:00.000Z`).lte('workout_date', todayEnd),
    supabase.from('assessments').select('data,submitted_at').eq('client_id', client.client_id).eq('assessment_type', 'strength').order('submitted_at', { ascending: false }).limit(2),
    supabase.from('assessment_photos').select('*').eq('client_id', client.client_id).order('uploaded_at', { ascending: false }).limit(1).maybeSingle(),
  ])

  const nutritionIds = (nutritionLogs || []).map((log: any) => log.id)
  const { data: nutritionTotals } = nutritionIds.length
    ? await supabase.from('nutrition_log_totals_by_block').select('nutrition_log_id,calories_eaten,protein_eaten_g').in('nutrition_log_id', nutritionIds)
    : { data: [] }

  const totalsByLog = (nutritionTotals || []).reduce((map: Record<string, { calories: number; protein: number }>, row: any) => {
    const current = map[row.nutrition_log_id] || { calories: 0, protein: 0 }
    current.calories += number(row.calories_eaten)
    current.protein += number(row.protein_eaten_g)
    map[row.nutrition_log_id] = current
    return map
  }, {})

  const nutritionByDate = new Map<string, { calories: number | null; protein: number | null; water: number | null }>((nutritionLogs || []).map((log: any) => [log.log_date, {
    calories: totalsByLog[log.id]?.calories ?? null,
    protein: totalsByLog[log.id]?.protein ?? null,
    water: nullableNumber(log.water_consumed_oz),
  }]))
  const workoutDates = new Set((workoutLogs || []).filter((log: any) => log.completed).map((log: any) => String(log.workout_date).slice(0, 10)))

  function trend(key: IgniteTrend['key'], label: string, unit: string, getter: (date: string) => number | null): IgniteTrend {
    const current = thisWeek.map(getter)
    const previous = lastWeek.map(getter)
    const currentAverage = key === 'workouts'
      ? current.reduce<number>((sum, value) => sum + (value || 0), 0)
      : average(current)
    const previousAverage = key === 'workouts'
      ? previous.reduce<number>((sum, value) => sum + (value || 0), 0)
      : average(previous)
    return { key, label, unit, values: current, currentAverage, comparisonPercent: percentChange(currentAverage, previousAverage) }
  }

  const trends = [
    trend('calories', 'Calories', 'avg', (date) => nutritionByDate.get(date)?.calories ?? null),
    trend('protein', 'Protein', 'g avg', (date) => nutritionByDate.get(date)?.protein ?? null),
    trend('water', 'Water', 'oz avg', (date) => nutritionByDate.get(date)?.water ?? null),
    trend('workouts', 'Workouts', 'days', (date) => workoutDates.has(date) ? 1 : 0),
  ]

  const targets = dailyPlan?.dailyTargets || {}
  const remaining = dailyPlan?.dailyRemaining || {}
  const macro = (key: 'protein' | 'carbs' | 'fats' | 'calories', label: string, target: number, unit: 'g' | 'cal') => ({
    key, label, target, consumed: Math.max(0, target - number(remaining[key])), unit,
  })
  const macros = [
    macro('protein', 'Protein', number(targets.protein), 'g'),
    macro('carbs', 'Carbs', number(targets.carbs), 'g'),
    macro('fats', 'Fats', number(targets.fats), 'g'),
    macro('calories', 'Calories', number(dailyPlan?.calories), 'cal'),
  ]
  const waterTarget = Math.max(1, number(targets.water, 100))
  const waterConsumed = Math.max(0, waterTarget - number(remaining.water))
  const proteinPercent = macros[0].target ? (macros[0].consumed / macros[0].target) * 100 : 0
  const recoveryCompleted = Boolean(recoveryLog || symptomLog)

  const latestStrength = strengthAssessments?.[0]?.data || {}
  const previousStrength = strengthAssessments?.[1]?.data || {}
  const weight = nullableNumber(latestStrength.weight)
  const previousWeight = nullableNumber(previousStrength.weight)
  const bodyFat = nullableNumber(latestStrength.body_fat ?? latestStrength.bodyFat)
  const previousBodyFat = nullableNumber(previousStrength.body_fat ?? previousStrength.bodyFat)
  const photoPaths = ['front_photo_url', 'back_photo_url', 'left_photo_url', 'right_photo_url']
    .map((key) => photoRecord?.[key]).filter(Boolean) as string[]
  const signedPhotos = await Promise.all(photoPaths.slice(0, 3).map(async (path) => {
    const { data } = await supabase.storage.from('assessment_photos').createSignedUrl(path, 60 * 30)
    return data?.signedUrl || null
  }))
  const photosDue = !photoRecord?.uploaded_at || Date.now() - new Date(photoRecord.uploaded_at).getTime() > 30 * 86400000

  const dailyCompleted = Boolean(todayAssessment)
  const assessmentTotal = 1 + monthlyAssessmentsDueCount
  const assessmentCompleted = dailyCompleted ? 1 : 0

  return {
    clientId: client.client_id,
    clientName: String(client.full_name || client.first_name || 'there').split(' ')[0],
    streak: streak(client),
    water: { consumed: waterConsumed, target: waterTarget },
    macros,
    workout: {
      assigned: Boolean(todaysWorkout),
      completed: Boolean(dailyPlan?.workoutCompleted),
      title: todaysWorkout?.day_name || 'Recovery day',
      type: todaysWorkout?.workout_type || todaysWorkout?.focus || (todaysWorkout ? 'Training' : 'No training assigned'),
      durationMinutes: nullableNumber(todaysWorkout?.duration_minutes ?? todaysWorkout?.estimated_duration),
    },
    assessment: {
      dailyCompleted,
      monthlyDueCount: monthlyAssessmentsDueCount,
      completedPercent: Math.round((assessmentCompleted / assessmentTotal) * 100),
    },
    recovery: {
      completed: recoveryCompleted,
      energy: nullableNumber(recoveryLog?.energy_level),
      stress: nullableNumber(recoveryLog?.stress_level),
      sleep: nullableNumber(recoveryLog?.sleep_quality),
      soreness: nullableNumber(recoveryLog?.soreness_level),
    },
    cycle: {
      enabled: Boolean(cycleStatus?.enabled),
      phase: cycleStatus?.phase || null,
      day: nullableNumber(cycleStatus?.cycleDay),
      recommendation: cycleStatus?.enabled ? cycleAdjustment.note : null,
    },
    plan: planBlocks({
      waterPercent: (waterConsumed / waterTarget) * 100,
      nutritionLogged: Boolean(dailyPlan?.nutritionLogged),
      proteinPercent,
      workoutAssigned: Boolean(todaysWorkout),
      workoutCompleted: Boolean(dailyPlan?.workoutCompleted),
      assessmentCompleted: dailyCompleted,
      recoveryCompleted,
    }),
    trends,
    progress: {
      weight,
      weightChange: weight !== null && previousWeight !== null ? Math.round((weight - previousWeight) * 10) / 10 : null,
      bodyFat,
      bodyFatChange: bodyFat !== null && previousBodyFat !== null ? Math.round((bodyFat - previousBodyFat) * 10) / 10 : null,
      photosDue,
      photoUrls: signedPhotos.filter((url): url is string => Boolean(url)),
    },
    baseInsight: insight?.nextStep || insight?.observation || null,
  }
}
