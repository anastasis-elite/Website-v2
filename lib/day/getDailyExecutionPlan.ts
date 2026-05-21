import { getRecoveryTools } from '@/lib/recovery/getRecoveryTools'

type DailyCard = {
  id: string
  title: string
  timing: string
  status: 'current' | 'upcoming' | 'complete' | 'late' | 'flex'
  body: string
  macroTarget?: {
    protein?: number
    carbs?: number
    fats?: number
    water?: number
  }
  items?: string[]
  buttonHref?: string
  buttonLabel?: string
}

function parseTimeToMinutes(time?: string | null) {
  if (!time) return null

  const [hours, minutes] = time.split(':').map(Number)

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null
  }

  return hours * 60 + minutes
}

function formatTime(time?: string | null) {
  if (!time) return null

  const [hourString, minuteString] = time.split(':')
  const hour = Number(hourString)
  const minute = Number(minuteString)

  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return null
  }

  const suffix = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  const displayMinute = String(minute).padStart(2, '0')

  return `${displayHour}:${displayMinute} ${suffix}`
}

function roundMacro(value: number) {
  return Math.max(0, Math.round(value))
}

function getStatus({
  nowMinutes,
  targetMinutes,
  executionStyle,
  completed = false,
  windowMinutes = 60,
}: {
  nowMinutes: number
  targetMinutes: number | null
  executionStyle: string
  completed?: boolean
  windowMinutes?: number
}): DailyCard['status'] {
  if (completed) return 'complete'

  if (executionStyle !== 'schedule' || targetMinutes === null) {
    return 'flex'
  }

  if (nowMinutes > targetMinutes + windowMinutes) {
    return 'late'
  }

  if (
    nowMinutes >= targetMinutes - windowMinutes &&
    nowMinutes <= targetMinutes + windowMinutes
  ) {
    return 'current'
  }

  return 'upcoming'
}

function pickCurrentCard(cards: DailyCard[]) {
  return (
    cards.find((card) => card.status === 'current') ||
    cards.find((card) => card.status === 'late') ||
    cards.find((card) => card.status === 'flex') ||
    cards.find((card) => card.status === 'upcoming') ||
    cards[0]
  )
}

export async function getDailyExecutionPlan({
  supabase,
  client,
}: {
  supabase: any
  client: any
}) {
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  const executionStyle = client.execution_style || 'flow'

  const wakeTime = client.wake_time || null
  const bedTime = client.bed_time || null
  const workoutTime = client.preferred_workout_time || null
  const workStartTime = client.work_start_time || null

  const wakeMinutes = parseTimeToMinutes(wakeTime)
  const bedMinutes = parseTimeToMinutes(bedTime)
  const workoutMinutes = parseTimeToMinutes(workoutTime)
  const workStartMinutes = parseTimeToMinutes(workStartTime)

  const firstMealMinutes =
    wakeMinutes !== null ? wakeMinutes + 120 : null

  const carbWindowMinutes =
    workoutMinutes !== null
      ? workoutMinutes
      : workStartMinutes !== null
      ? workStartMinutes
      : null

  const carbCutoffMinutes =
    bedMinutes !== null ? bedMinutes - 240 : null

  const eveningAnchorMinutes =
    bedMinutes !== null ? bedMinutes - 120 : null

  const { data: strengthAssessment } = await supabase
    .from('assessments')
    .select('*')
    .eq('client_id', client.client_id)
    .eq('assessment_type', 'strength')
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const assessmentData = strengthAssessment?.data || {}
  const weight = Number(assessmentData.weight || 0)

  const calories = weight ? Math.round(weight * 12) : 2000
  const protein = weight ? Math.round(weight * 0.8) : 150
  const fats = Math.round((calories * 0.28) / 9)
  const carbs = Math.round((calories - protein * 4 - fats * 9) / 4)
  const water = weight ? Math.round(weight * 0.6) : 100

  const { data: todayNutritionLog } = await supabase
    .from('nutrition_logs')
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

  const { data: todayRecoveryLog } = await supabase
    .from('recovery_logs')
    .select('*')
    .eq('client_id', client.client_id)
    .eq('log_date', today)
    .maybeSingle()

  const workoutCompleted = !!todayWorkoutLog?.completed

  const nutritionLogged =
    !!todayNutritionLog &&
    (
      Number(todayNutritionLog.protein || 0) > 0 ||
      Number(todayNutritionLog.carbs || 0) > 0 ||
      Number(todayNutritionLog.fats || 0) > 0 ||
      Number(todayNutritionLog.water_oz || 0) > 0
    )

  const recoveryTools = getRecoveryTools({
    client,
    recoveryLog: todayRecoveryLog,
    workoutCompleted,
    nutritionLogged,
  })

  const firstMealTarget = {
    protein: roundMacro(protein * 0.35),
    carbs: 0,
    fats: roundMacro(fats * 0.35),
    water: roundMacro(water * 0.25),
  }

  const carbMealTarget = {
    protein: roundMacro(protein * 0.25),
    carbs: roundMacro(carbs * 0.5),
    fats: roundMacro(fats * 0.15),
    water: roundMacro(water * 0.25),
  }

  const lunchTarget = {
    protein: roundMacro(protein * 0.2),
    carbs: roundMacro(carbs * 0.25),
    fats: roundMacro(fats * 0.25),
    water: roundMacro(water * 0.25),
  }

  const dinnerTarget = {
    protein: roundMacro(protein * 0.2),
    carbs: roundMacro(carbs * 0.25),
    fats: roundMacro(fats * 0.25),
    water: roundMacro(water * 0.25),
  }

  const cards: DailyCard[] = [
    {
      id: 'wake-anchor',
      title: 'Wake Anchor',
      timing: wakeTime
        ? `After waking around ${formatTime(wakeTime)}`
        : 'After waking',
      status: getStatus({
        nowMinutes,
        targetMinutes: wakeMinutes,
        executionStyle,
        windowMinutes: 90,
      }),
      body:
        'Begin with a small fat/protein-forward anchor if your body does better with steadier energy before your first full meal.',
      buttonHref: '/dashboard/nutrition',
      buttonLabel: 'Log Anchor',
    },
    {
      id: 'first-meal',
      title: 'First Meal Anchor',
      timing: 'Within 2 hours of waking',
      status: getStatus({
        nowMinutes,
        targetMinutes: firstMealMinutes,
        executionStyle,
        completed: nutritionLogged,
        windowMinutes: 90,
      }),
      body:
        'This is your larger stabilizing meal. Protein and fats lead here. Carbs stay held until training or your work-entry fuel window when possible.',
      macroTarget: firstMealTarget,
      buttonHref: '/dashboard/nutrition',
      buttonLabel: 'Log First Meal',
    },
    {
      id: 'carb-window',
      title: workoutTime ? 'Training Fuel' : 'Work-Entry Fuel',
      timing: workoutTime
        ? `Around training${formatTime(workoutTime) ? ` near ${formatTime(workoutTime)}` : ''}`
        : workStartTime
        ? `Before work near ${formatTime(workStartTime)}`
        : 'Around training or before your highest-demand window',
      status: getStatus({
        nowMinutes,
        targetMinutes: carbWindowMinutes,
        executionStyle,
        windowMinutes: 90,
      }),
      body:
        'This is where healthier carbs belong: fruit, oats, rice, potatoes, sweet potatoes, or other simple whole-food sources that support performance and momentum.',
      macroTarget: carbMealTarget,
      buttonHref: '/dashboard/nutrition',
      buttonLabel: 'Log Fuel Meal',
    },
    {
      id: 'training',
      title: 'Training Window',
      timing: workoutTime
        ? `Target: ${formatTime(workoutTime)}`
        : 'Complete when your day opens',
      status: getStatus({
        nowMinutes,
        targetMinutes: workoutMinutes,
        executionStyle,
        completed: workoutCompleted,
        windowMinutes: 75,
      }),
      body:
        executionStyle === 'schedule'
          ? 'This is your planned training window. If you are late, do not spiral. Redirect into the next best available opening.'
          : 'Your training is assigned for today. Complete it when your day gives you the cleanest opening.',
      buttonHref: `/dashboard/program/${client.program || 'ignite'}/plan`,
      buttonLabel: workoutCompleted ? 'Workout Complete' : 'Open Workout',
    },
    {
      id: 'lunch',
      title: 'Midday Support',
      timing: 'Midday',
      status: 'upcoming',
      body:
        'Lunch is designed to protect your afternoon momentum. The goal is steady energy, not a crash-and-recover cycle.',
      macroTarget: lunchTarget,
      buttonHref: '/dashboard/nutrition',
      buttonLabel: 'Log Lunch',
    },
    {
      id: 'dinner',
      title: 'Dinner / Recovery Meal',
      timing: carbCutoffMinutes
        ? 'Finish carbs before the final 4-hour sleep window when possible'
        : 'Evening recovery meal',
      status: 'upcoming',
      body:
        'Dinner supports recovery without overloading the end of the day. When possible, stop carb-heavy meals about 4 hours before bed.',
      macroTarget: dinnerTarget,
      buttonHref: '/dashboard/nutrition',
      buttonLabel: 'Log Dinner',
    },
    {
      id: 'evening-anchor',
      title: 'Evening Anchor',
      timing: 'About 2 hours before bed',
      status: getStatus({
        nowMinutes,
        targetMinutes: eveningAnchorMinutes,
        executionStyle,
        windowMinutes: 75,
      }),
      body:
        'A small fat/protein-forward snack may help some women feel steadier overnight and reduce bedtime hunger without turning the night into another full meal.',
      buttonHref: '/dashboard/nutrition',
      buttonLabel: 'Log Evening Anchor',
    },
  ]

  if (recoveryTools.saunaRecommended) {
    cards.push({
      id: 'sauna',
      title: 'Sauna Recovery',
      timing: 'After training or later today',
      status: 'upcoming',
      body:
        'Sauna is available today if you feel hydrated, steady, well-fed, and not dizzy, sick, overheated, or medically restricted.',
      buttonHref: '/dashboard/recovery/sauna',
      buttonLabel: 'Open Sauna Check',
    })
  }

  if (recoveryTools.tubSoakRecommended) {
  cards.push({
    id: 'tub-soak',
    title: 'Tub Soak',
    timing: bedTime
      ? `About 30–60 minutes before bed${formatTime(bedTime) ? ` near ${formatTime(bedTime)}` : ''}`
      : 'About 30–60 minutes before bed',
    status: getStatus({
      nowMinutes,
      targetMinutes:
        bedMinutes !== null ? bedMinutes - 60 : null,
      executionStyle,
      windowMinutes: 60,
    }),
    body:
      'A warm soak may be a better recovery fit today if your system needs downshifting, soreness support, or lower-pressure recovery before sleep.',
    buttonHref: '/dashboard/recovery',
    buttonLabel: 'Open Recovery',
  })
}

  if (recoveryTools.mobilityRecommended) {
  cards.push({
    id: 'gentle-movement',
    title: 'Gentle Movement',
    timing: 'When your body needs space',
    status: 'upcoming',
    body:
      'Choose low-pressure movement today: a light walk, gentle bike ride, taking the kids to the park, easy swimming, or another calm form of movement that helps your body recover without turning recovery into another workout.',
    buttonHref: '/dashboard/recovery',
    buttonLabel: 'Open Recovery',
  })
}

  const currentCard = pickCurrentCard(cards)

  return {
    date: today,
    executionStyle,
    calories,
    dailyTargets: {
      protein,
      carbs,
      fats,
      water,
    },
    timing: {
      wakeTime,
      bedTime,
      workoutTime,
      workStartTime,
    },
    currentCard,
    cards,
    workoutCompleted,
    nutritionLogged,
    recoveryTools,
  }
}
