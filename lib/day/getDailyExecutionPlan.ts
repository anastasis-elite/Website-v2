import { getRecoveryTools } from '@/lib/recovery/getRecoveryTools'
import {
  getNutritionBlockTargets,
  type NutritionBlockKey,
} from '@/lib/nutrition/getNutritionBlockTargets'

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
    calories?: number
  }
  items?: string[]
  buttonHref?: string
  buttonLabel?: string
}

function parseTimeToMinutes(time?: string | null) {
  if (!time) return null
  const [hours, minutes] = time.split(':').map(Number)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null
  return hours * 60 + minutes
}

function formatTime(time?: string | null) {
  if (!time) return null

  const [hourString, minuteString] = time.split(':')
  const hour = Number(hourString)
  const minute = Number(minuteString)

  if (Number.isNaN(hour) || Number.isNaN(minute)) return null

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

  if (nowMinutes > targetMinutes + windowMinutes) return 'late'

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

  const fallbackCalories = weight ? Math.round(weight * 12) : 2000
  const fallbackProtein = weight ? Math.round(weight * 0.8) : 150
  const fallbackFats = Math.round((fallbackCalories * 0.28) / 9)
  const fallbackCarbs = Math.round(
    (fallbackCalories - fallbackProtein * 4 - fallbackFats * 9) / 4
  )
  const water = weight ? Math.round(weight * 0.6) : 100

  const { data: todayNutritionLog } = await supabase
    .from('nutrition_logs')
    .select('*')
    .eq('client_id', client.client_id)
    .eq('log_date', today)
    .maybeSingle()

  const calories = Number(todayNutritionLog?.calories || fallbackCalories)
  const protein = Number(todayNutritionLog?.protein || fallbackProtein)
  const carbs = Number(todayNutritionLog?.carbs || fallbackCarbs)
  const fats = Number(todayNutritionLog?.fats || fallbackFats)

  let blockRemaining: Record<NutritionBlockKey, any> | null = null

  let dailyRemaining = {
    calories,
    protein,
    carbs,
    fats,
    water,
  }

  if (todayNutritionLog?.id) {
    const blockTargets = getNutritionBlockTargets({
      calories,
      protein,
      carbs,
      fats,
      fiber_target_g: todayNutritionLog.fiber_target_g,
      sodium_target_mg: todayNutritionLog.sodium_target_mg,
      potassium_target_mg: todayNutritionLog.potassium_target_mg,
      magnesium_target_mg: todayNutritionLog.magnesium_target_mg,
      calcium_target_mg: todayNutritionLog.calcium_target_mg,
      iron_target_mg: todayNutritionLog.iron_target_mg,
      choline_target_mg: todayNutritionLog.choline_target_mg,
    })

    const { data: eatenByBlock } = await supabase
      .from('nutrition_log_totals_by_block')
      .select('*')
      .eq('nutrition_log_id', todayNutritionLog.id)

    const totalEaten = (eatenByBlock || []).reduce(
      (acc: any, row: any) => {
        acc.calories += Number(row.calories_eaten || 0)
        acc.protein += Number(row.protein_eaten_g || 0)
        acc.carbs += Number(row.carbs_eaten_g || 0)
        acc.fats += Number(row.fat_eaten_g || 0)
        return acc
      },
      {
        calories: 0,
        protein: 0,
        carbs: 0,
        fats: 0,
      }
    )

    dailyRemaining = {
      calories: roundMacro(calories - totalEaten.calories),
      protein: roundMacro(protein - totalEaten.protein),
      carbs: roundMacro(carbs - totalEaten.carbs),
      fats: roundMacro(fats - totalEaten.fats),
      water: roundMacro(
        water - Number(todayNutritionLog.water_consumed_oz || 0)
      ),
    }

    blockRemaining = Object.fromEntries(
      Object.entries(blockTargets).map(([block, target]) => {
        const eaten = eatenByBlock?.find(
          (row: any) => row.day_block === block
        )

        return [
          block,
          {
            calories: roundMacro(
              target.calories - Number(eaten?.calories_eaten || 0)
            ),
            protein: roundMacro(
              target.protein_g - Number(eaten?.protein_eaten_g || 0)
            ),
            carbs: roundMacro(
              target.carbs_g - Number(eaten?.carbs_eaten_g || 0)
            ),
            fats: roundMacro(
              target.fat_g - Number(eaten?.fat_eaten_g || 0)
            ),
            water:
              block === 'morning'
                ? roundMacro(water * 0.35)
                : block === 'midday'
                  ? roundMacro(water * 0.4)
                  : block === 'evening'
                    ? roundMacro(water * 0.25)
                    : 0,
          },
        ]
      })
    ) as Record<NutritionBlockKey, any>
  }

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
  const nutritionLogged = !!todayNutritionLog

  const recoveryTools = getRecoveryTools({
    client,
    recoveryLog: todayRecoveryLog,
    workoutCompleted,
    nutritionLogged,
  })

  const morningTarget = blockRemaining?.morning || {
    calories: roundMacro(calories * 0.3),
    protein: roundMacro(protein * 0.3),
    carbs: roundMacro(carbs * 0.3),
    fats: roundMacro(fats * 0.3),
    water: roundMacro(water * 0.35),
  }

  const middayTarget = blockRemaining?.midday || {
    calories: roundMacro(calories * 0.35),
    protein: roundMacro(protein * 0.35),
    carbs: roundMacro(carbs * 0.35),
    fats: roundMacro(fats * 0.35),
    water: roundMacro(water * 0.4),
  }

  const eveningTarget = blockRemaining?.evening || {
    calories: roundMacro(calories * 0.25),
    protein: roundMacro(protein * 0.25),
    carbs: roundMacro(carbs * 0.25),
    fats: roundMacro(fats * 0.25),
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

  if (
    workoutMinutes !== null &&
    workoutMinutes >= 12 * 60 &&
    workoutMinutes < 17 * 60
  ) {
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
    dailyRemaining.protein <= protein * 0.1 &&
    dailyRemaining.carbs <= carbs * 0.15 &&
    dailyRemaining.fats <= fats * 0.15 &&
    dailyRemaining.water <= water * 0.15

  const dayFullyComplete = workoutCompleted && macroTargetsMet

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
        completed: false,
        windowMinutes: 180,
      }),
      body:
        'This block is designed to help you start steady instead of immediately carrying the whole day.',
      macroTarget: morningTarget,
      items: morningItems,
      buttonHref: '/dashboard/day/morning',
      buttonLabel: 'Open Morning Flow',
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
      buttonHref: '/dashboard/day/midday',
      buttonLabel: 'Open Midday Flow',
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
      buttonHref: '/dashboard/day/evening',
      buttonLabel: dayFullyComplete ? 'Receive Today' : 'Open Evening Flow',
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
    dailyRemaining,
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
