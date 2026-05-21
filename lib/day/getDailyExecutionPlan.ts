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

  const morningMinutes = wakeMinutes
  const middayMinutes = workStartMinutes || 12 * 60
  const eveningMinutes = bedMinutes !== null ? bedMinutes - 240 : 18 * 60

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

  const morningTarget = {
    protein: roundMacro(protein * 0.35),
    carbs: 0,
    fats: roundMacro(fats * 0.35),
    water: roundMacro(water * 0.35),
  }

  const middayTarget = {
    protein: roundMacro(protein * 0.4),
    carbs: roundMacro(carbs * 0.65),
    fats: roundMacro(fats * 0.35),
    water: roundMacro(water * 0.4),
  }

  const eveningTarget = {
    protein: roundMacro(protein * 0.25),
    carbs: roundMacro(carbs * 0.35),
    fats: roundMacro(fats * 0.3),
    water: roundMacro(water * 0.25),
  }

  const morningItems = [
    'Start with a small fat/protein-forward wake anchor if it helps you feel steady.',
    'Complete your first full meal within 2 hours of waking when possible.',
    'Keep carbs held until training or your work-entry fuel window when possible.',
  ]

  if (workoutMinutes !== null && workoutMinutes < 12 * 60) {
    morningItems.push(
      'Training is planned in your morning window. Use your carb fuel close to training instead of forcing it early.'
    )
  }

  const middayItems = [
    'Use your midday meal to protect your afternoon momentum.',
    'Place most of your healthier carbs here if this is your training or work-entry fuel window.',
    'Aim for about 30 minutes of easy movement if your day allows.',
    'Movement can be a light walk, gentle bike ride, swimming, park time with the kids, or low-pressure mobility.',
  ]

  if (workoutMinutes !== null && workoutMinutes >= 12 * 60 && workoutMinutes < 17 * 60) {
    middayItems.push(
      'Training is planned in your midday window. Use this block to fuel and execute without overthinking.'
    )
  }

  const eveningItems = [
    'Use dinner as your recovery meal.',
    'Stop carb-heavy meals about 4 hours before bed when possible.',
    'Use an evening fat/protein-forward anchor about 2 hours before bed if it helps you feel steady overnight.',
  ]

  if (workoutMinutes !== null && workoutMinutes >= 17 * 60) {
    eveningItems.push(
      'Training is planned in your evening window. Keep the post-training meal supportive without turning the night into another stressor.'
    )
  }

  if (recoveryTools.saunaRecommended) {
    eveningItems.push(
      'Sauna is available today if you feel hydrated, steady, well-fed, and unrestricted.'
    )
  }

  if (recoveryTools.tubSoakRecommended) {
    eveningItems.push(
      'A warm tub soak is recommended about 30–60 minutes before bed.'
    )
  }

  if (recoveryTools.mobilityRecommended) {
    middayItems.push(
      'Gentle movement is recommended today to support recovery without adding pressure.'
    )
  }

  const macroTargetsMet =
    !!todayNutritionLog &&
    Number(todayNutritionLog.protein || 0) >= protein * 0.9 &&
    Number(todayNutritionLog.carbs || 0) >= carbs * 0.85 &&
    Number(todayNutritionLog.fats || 0) >= fats * 0.85 &&
    Number(todayNutritionLog.water_oz || 0) >= water * 0.85

  const dayFullyComplete =
    workoutCompleted &&
    macroTargetsMet

  if (dayFullyComplete) {
    eveningItems.push(
      'Your core targets are complete for today. Let the day count and let your body receive the work you gave it.'
    )
  } else {
    eveningItems.push(
      'If you did not get to everything today, it is okay. Tomorrow is a new day, and your effort was not lost.'
    )
  }

  const cards: DailyCard[] = [
    {
      id: 'morning',
      title: 'Morning',
      timing: wakeTime
        ? `After waking around ${formatTime(wakeTime)}`
        : 'After waking',
      status: getStatus({
        nowMinutes,
        targetMinutes: morningMinutes,
        executionStyle,
        completed: nutritionLogged,
        windowMinutes: 180,
      }),
      body:
        'This block is designed to help you start steady instead of immediately carrying the whole day.',
      macroTarget: morningTarget,
      items: morningItems,
      buttonHref: '/dashboard/nutrition',
      buttonLabel: 'Open Morning Support',
    },
    {
      id: 'midday',
      title: 'Midday',
      timing: 'Lunch through early afternoon',
      status: getStatus({
        nowMinutes,
        targetMinutes: middayMinutes,
        executionStyle,
        windowMinutes: 180,
      }),
      body:
        'This block protects your afternoon energy and gives your body a chance to wake back up instead of crashing.',
      macroTarget: middayTarget,
      items: middayItems,
      buttonHref: workoutTime
        ? `/dashboard/program/${client.program || 'ignite'}/plan`
        : '/dashboard/nutrition',
      buttonLabel: workoutTime ? 'Open Workout' : 'Open Midday Support',
    },
    {
      id: 'evening',
      title: dayFullyComplete ? 'Evening Complete' : 'Evening',
      timing: bedTime
        ? `Before bed near ${formatTime(bedTime)}`
        : 'Evening into bedtime',
      status: dayFullyComplete
        ? 'complete'
        : getStatus({
            nowMinutes,
            targetMinutes: eveningMinutes,
            executionStyle,
            windowMinutes: 180,
          }),
      body: dayFullyComplete
        ? 'Your system is complete for today. Close the day with pride, softness, and relief.'
        : 'This block is for recovery, sleep preparation, and a soft landing at the end of the day.',
      macroTarget: eveningTarget,
      items: eveningItems,
      buttonHref: dayFullyComplete ? '/dashboard' : '/dashboard/check-in',
      buttonLabel: dayFullyComplete ? 'Receive Today' : 'Close Today',
    },
  ]

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
    dayFullyComplete,
    macroTargetsMet,
  }
}
