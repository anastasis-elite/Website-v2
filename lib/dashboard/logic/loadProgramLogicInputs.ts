import 'server-only'

import { mergeDailySymptoms } from '@/lib/dashboard/dailySignals'
import type { ProgramLogicInputs, ProgramTier } from './types'
import { getSleepStatusForDashboard } from '@/lib/sleep/getSleepStatusForDashboard'
import { isSorenessRegionKey } from '@/lib/recovery/sorenessRegions'
import type { HistoricalRecoverySignal } from '@/lib/workout-os/types'
import { getClientDayRange } from '@/lib/schedule/time'
import { getClientTimeZone, recordLocalDate, getClientLocalDateOffset, addLocalDays } from '@/lib/timezone'
import { loadWorkoutHistory, workoutLocalDate } from '@/lib/workout/history'
import { getStrengthAssessmentStatus } from '@/lib/assessment/getStrengthAssessmentStatus'
import { recordedHistoryMacros } from '@/lib/nutrition/todayPacing'
import type { DashboardRequestReads } from '@/lib/dashboard/requestReads'

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeRecentRecovery(
  rows: any[] | null,
  dates: string[]
): HistoricalRecoverySignal[] {
  const rowsByDate = new Map<string, any>(
    (rows || []).map((row) => [String(row.log_date), row])
  )

  return dates.map((date) => {
    const row = rowsByDate.get(date)
    const sorenessRegions = Array.isArray(row?.soreness_regions)
      ? row.soreness_regions.filter(isSorenessRegionKey)
      : []

    return {
      date,
      checkInCompleted: Boolean(row?.check_in_completed_at),
      sleepHours: nullableNumber(row?.sleep_hours),
      stress: nullableNumber(row?.stress_level),
      energy: nullableNumber(row?.energy_level),
      soreness: nullableNumber(row?.soreness_level),
      sorenessRegions,
    }
  })
}

function metricValue(metrics: Record<string, any>, metricType: string) {
  return nullableNumber(metrics[metricType]?.value)
}

function mapMetricsByType(rows: any[] | null) {
  return (rows || []).reduce<Record<string, any>>((map, row) => {
    map[String(row.metric_type)] = row
    return map
  }, {})
}

export type ProgramLogicInputArgs = {
  supabase: any; user: any; client: any; program: ProgramTier; dailyPlan: any
  cycleStatus: any; cycleAdjustment: any; plannedWorkout: any
  plannedExercises: any[]; monthlyAssessmentsDueCount: number
  requestReads?: DashboardRequestReads
}

type ProgramLogicSourceArgs = Pick<ProgramLogicInputArgs, 'supabase' | 'user' | 'client' | 'program' | 'requestReads'>

export class DashboardLocalDayChangedError extends Error {
  constructor() {
    super('The member local day changed while loading Today.')
    this.name = 'DashboardLocalDayChangedError'
  }
}

export type PreparedProgramLogicInputs = {
  ready: Promise<void>
  resolve: (args: ProgramLogicInputArgs) => Promise<ProgramLogicInputs>
  assertCurrent: (args: ProgramLogicInputArgs) => void
}

/** Request-owned read preparation only. Attach rejection handling immediately,
 * then join the saved daily plan before assembling its dependent completion
 * signals or running any engine/persistence work. */
export function prepareProgramLogicInputs(args: ProgramLogicSourceArgs): PreparedProgramLogicInputs {
  const { supabase, user, client, program, requestReads } = args
  if (!supabase || !user?.id || !client?.client_id || client.auth_user_id !== user.id || (client.program || 'ignite') !== program) {
    throw new Error('Prepared Today inputs require the verified member owner and program.')
  }
  const userId = user.id, clientId = client.client_id
  const effectiveClient = JSON.stringify(client)
  const timeZone = getClientTimeZone(client), now = new Date()
  const date = getClientLocalDateOffset(client, 0, now)
  const settled = readProgramLogicSources(args, now).then(
    value => ({ ok: true as const, value }),
    error => ({ ok: false as const, error }),
  )
  function assertCurrent(current: ProgramLogicInputArgs) {
    if (current.supabase !== supabase || current.user !== user || current.user?.id !== userId ||
      current.client !== client || current.client?.client_id !== clientId || current.client?.auth_user_id !== userId ||
      current.program !== program || (current.client.program || 'ignite') !== program || current.requestReads !== requestReads ||
      JSON.stringify(current.client) !== effectiveClient || getClientTimeZone(current.client) !== timeZone) {
      throw new Error('Prepared Today input scope changed.')
    }
    if (current.dailyPlan?.date !== date || getClientLocalDateOffset(current.client) !== date) {
      throw new DashboardLocalDayChangedError()
    }
  }
  return {
    // Timing may observe completion without accessing source data or swallowing
    // the original failure, which is rethrown only when resolve joins the plan.
    ready: settled.then(() => undefined),
    assertCurrent,
    async resolve(current) {
      assertCurrent(current)
      const result = await settled
      assertCurrent(current)
      if (!result.ok) throw result.error
      const inputs = assembleProgramLogicInputs(current, result.value)
      assertCurrent(current)
      return inputs
    },
  }
}

export async function loadProgramLogicInputs(args: ProgramLogicInputArgs): Promise<ProgramLogicInputs> {
  return assembleProgramLogicInputs(args, await readProgramLogicSources(args))
}

async function readProgramLogicSources({ supabase, user, client, requestReads }: ProgramLogicSourceArgs, now?: Date) {
  const today = getClientLocalDateOffset(client, 0, now)
  const yesterday = getClientLocalDateOffset(client, -1, now)
  const fourteenDaysAgo = getClientLocalDateOffset(client, -13, now)
  const fourDaysAgo = getClientLocalDateOffset(client, -4, now)
  const sevenDaysAgo = getClientLocalDateOffset(client, -7, now)
  const recentRecoveryDates = Array.from({ length: 7 }, (_, index) =>
    getClientLocalDateOffset(client, -(index + 1), now)
  )
  const ninetyDaysAgo = getClientLocalDateOffset(client, -90, now)
  const dayRange = getClientDayRange(client, today)
  const start = dayRange.start.toISOString(), end = dayRange.end.toISOString()
  const timeZone = getClientTimeZone(client)

  const [
    { data: todayAssessment }, { data: rawTodayRecovery, error: recoveryLogError }, { data: recentSymptoms },
    { data: nutritionLogs, error: nutritionLogsError }, { data: workoutHistory, error: workoutHistoryError }, { data: strengthAssessments },
    { data: initialAssessment }, { data: measurementLogs }, { data: photoRecord },
    { data: phoenixTasks }, { data: recentTasks }, { data: todayWorkoutFeedback },
    { data: recoveryActivities, error: recoveryActivitiesError }, { data: rawRecentRecovery }, { data: executionHistory, error: executionHistoryError },
    { data: dailyHealthMetrics }, { data: latestBodySessions }, { data: activeBodySession },
    sleepStatus, { data: todayCycle }, strengthAssessment,
  ] = await Promise.all([
    supabase.from('assessments').select('*').eq('client_id', client.client_id).gte('submitted_at', start).lt('submitted_at', end).limit(1).maybeSingle(),
    supabase.from('recovery_logs').select('*').eq('client_id', client.client_id).eq('log_date', today).limit(1).maybeSingle(),
    supabase.from('client_symptom_logs').select('*, symptom_types(name,category)').eq('client_id', client.client_id).gte('created_at', `${ninetyDaysAgo}T00:00:00.000Z`).order('created_at', { ascending: false }).limit(100),
    supabase.from('nutrition_logs').select('*').eq('client_id', client.client_id).gte('log_date', fourteenDaysAgo).lte('log_date', today).order('log_date'),
    loadWorkoutHistory({ supabase, client, startDate: ninetyDaysAgo, endDateExclusive: addLocalDays(today, 1), authUserId: user.id, limit: 100 }),
    supabase.from('assessments').select('*').eq('client_id', client.client_id).eq('assessment_type', 'strength').order('submitted_at', { ascending: false }).limit(5),
    requestReads ? requestReads.readLatestInitialAssessment({ supabase, clientId: client.client_id }) : supabase.from('assessments').select('*').eq('client_id', client.client_id).eq('assessment_type', 'initial').order('submitted_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('measurement_logs').select('*').eq('client_id', client.client_id).order('log_date', { ascending: false }).limit(2),
    supabase.from('assessment_photos').select('*').eq('client_id', client.client_id).order('uploaded_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('phoenix_daily_task_completions').select('task_id').eq('user_id', user.id).eq('client_id', client.client_id).eq('log_date', today),
    supabase.from('phoenix_daily_task_completions').select('task_id,log_date').eq('user_id', user.id).eq('client_id', client.client_id).gte('log_date', fourDaysAgo).lt('log_date', today),
    supabase.from('workout_plan_feedback').select('*').eq('user_id', user.id).eq('client_id', client.client_id).eq('feedback_date', today).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('recovery_activity_logs').select('*').eq('user_id', user.id).eq('client_id', client.client_id).eq('log_date', today),
    supabase
      .from('recovery_logs')
      .select('log_date,check_in_completed_at,sleep_hours,sleep_quality,stress_level,soreness_level,soreness_regions,energy_level')
      .eq('client_id', client.client_id)
      .gte('log_date', sevenDaysAgo)
      .lt('log_date', today),
    supabase.from('daily_execution_status').select('log_date,streak_eligible').eq('user_id',user.id).eq('client_id',client.client_id).lt('log_date',today).order('log_date',{ascending:false}).limit(30),
    supabase
      .from('daily_health_metrics')
      .select('*')
      .eq('user_id', user.id)
      .eq('client_id', client.client_id)
      .gte('metric_date', sevenDaysAgo)
      .lte('metric_date', today),
    supabase
      .from('body_assessment_sessions')
      .select('id,assessment_type,status,started_at,completed_at')
      .eq('user_id', user.id)
      .eq('client_id', client.client_id)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(20),
    supabase
      .from('body_assessment_sessions')
      .select('id,assessment_type,status,started_at')
      .eq('user_id', user.id)
      .eq('client_id', client.client_id)
      .eq('status', 'draft')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    getSleepStatusForDashboard(supabase, client.client_id, today),
    supabase.from('cycle_logs').select('*').eq('client_id', client.client_id).eq('log_date', today).maybeSingle(),
    getStrengthAssessmentStatus(supabase, client, now),
  ])

  const nutritionIds = (nutritionLogs || []).map((row: any) => row.id)
  const todayHealthMetrics = mapMetricsByType(
    (dailyHealthMetrics || []).filter((row: any) => String(row.metric_date) === today && ['measured','aggregated'].includes(row.status) && Number(row.sample_count) > 0 && row.source_providers?.length && row.computed_at && recordLocalDate(String(row.computed_at), timeZone) === today),
  )
  const passiveSleepHours = metricValue(todayHealthMetrics, 'sleep_duration')
  const todayRecovery=sleepStatus.logged?{...(rawTodayRecovery||{}),sleep_hours:sleepStatus.durationHours,sleep_quality:sleepStatus.quality,sleep_bedtime:sleepStatus.bedtime,sleep_wake_time:sleepStatus.wakeTime}:passiveSleepHours!==null?{...(rawTodayRecovery||{}),sleep_hours:passiveSleepHours,passive_source:'health_integration'}:rawTodayRecovery
  const paths = ['front_photo_url','back_photo_url','left_photo_url','right_photo_url'].map((key) => photoRecord?.[key]).filter(Boolean)
  const [{ data: nutritionTotals, error: nutritionTotalsError }, { data: allMealEntries, error: mealEntriesError }, { data: allMacroEntries, error: macroEntriesError }, photoUrls] = await Promise.all([
    nutritionIds.length
    ? supabase.from('nutrition_log_totals_by_block').select('*').in('nutrition_log_id', nutritionIds)
    : { data: [] },
  nutritionIds.length
  ? supabase
      .from('meal_entries')
      .select(
        'id,nutrition_log_id,meal_name,day_block,created_at,food_id'
      )
      .in('nutrition_log_id', nutritionIds)
      .eq('entry_state', 'confirmed')
      .order('created_at', { ascending: false })
  : { data: [] },
  nutritionIds.length
  ? supabase
      .from('macro_entries')
      .select('id,nutrition_log_id,calories,protein_g,carbs_g,fat_g,day_block,created_at')
      .in('nutrition_log_id', nutritionIds)
      .order('created_at', { ascending: false })
  : { data: [] },
  Promise.all(paths.slice(0, 3).map(async (path: string) => {
    try {
      const { data } = await supabase.storage.from('assessment_photos').createSignedUrl(path, 1800)
      return data?.signedUrl || null
    } catch {
      return null // Optional photo previews must not prevent daily logging.
    }
  })).then(urls => urls.filter((url): url is string => Boolean(url))),
  ])

  return {
    today, yesterday, recentRecoveryDates, timeZone, todayHealthMetrics, todayRecovery,
    todayAssessment, todayCycle, recentSymptoms, nutritionLogs, nutritionLogsError, workoutHistory,
    rawTodayRecovery, recoveryLogError, workoutHistoryError,
    strengthAssessments, initialAssessment, measurementLogs, photoRecord, phoenixTasks,
    recentTasks, todayWorkoutFeedback, recoveryActivities, recoveryActivitiesError,
    rawRecentRecovery, executionHistory, executionHistoryError, dailyHealthMetrics,
    latestBodySessions, activeBodySession, strengthAssessment, nutritionTotals,
    nutritionTotalsError, allMealEntries, mealEntriesError, allMacroEntries, macroEntriesError, photoUrls,
  }
}

function assembleProgramLogicInputs({ user, client, program, dailyPlan, cycleStatus, cycleAdjustment,
  plannedWorkout, plannedExercises, monthlyAssessmentsDueCount }: ProgramLogicInputArgs,
  sources: Awaited<ReturnType<typeof readProgramLogicSources>>): ProgramLogicInputs {
  const {
    today, yesterday, recentRecoveryDates, timeZone, todayHealthMetrics, todayRecovery,
    todayAssessment, todayCycle, recentSymptoms, nutritionLogs, nutritionLogsError, workoutHistory,
    rawTodayRecovery, recoveryLogError, workoutHistoryError,
    strengthAssessments, initialAssessment, measurementLogs, photoRecord, phoenixTasks,
    recentTasks, todayWorkoutFeedback, recoveryActivities, recoveryActivitiesError,
    rawRecentRecovery, executionHistory, executionHistoryError, dailyHealthMetrics,
    latestBodySessions, activeBodySession, strengthAssessment, nutritionTotals,
    nutritionTotalsError, allMealEntries, mealEntriesError, allMacroEntries, macroEntriesError, photoUrls,
  } = sources

  const todayNutrition = (nutritionLogs || []).find((row: any) => String(row.log_date) === today)

const mealEntries = todayNutrition?.id
  ? (allMealEntries || []).filter(
      (entry: any) => entry.nutrition_log_id === todayNutrition.id
    )
  : []

const macroEntries = todayNutrition?.id
  ? (allMacroEntries || []).filter(
      (entry: any) => entry.nutrition_log_id === todayNutrition.id
    )
  : []

const recentFuelingHistory = [-1, -2, -3].map((offset) => {
  const date = addLocalDays(today, offset)

  const nutritionLog = (nutritionLogs || []).find(
    (row: any) => String(row.log_date) === date
  )

  if (!nutritionLog) {
    return {
      date,
      nutritionLogId: null,
      mealCount: 0,
      targetCalories: 0,
      consumedCalories: 0,
      targetProtein: 0,
      consumedProtein: 0,
      targetCarbs: 0,
      consumedCarbs: 0,
      targetFats: 0,
      consumedFats: 0,
      completionPercent: 0,
      adequatelyFueled: false,
    }
  }

  const totalsForDay = (nutritionTotals || []).filter(
    (row: any) => row.nutrition_log_id === nutritionLog.id
  )

  const macroEntriesForDay = (allMacroEntries || []).filter(
    (entry: any) => entry.nutrition_log_id === nutritionLog.id
  )

  const consumed = totalsForDay.reduce(
    (total: any, row: any) => ({
      calories:
        total.calories + Number(row.calories_eaten || 0),
      protein:
        total.protein + Number(row.protein_eaten_g || 0),
      carbs:
        total.carbs + Number(row.carbs_eaten_g || 0),
      fats:
        total.fats + Number(row.fat_eaten_g || 0),
    }),
    {
      calories: 0,
      protein: 0,
      carbs: 0,
      fats: 0,
    }
  )

  for (const entry of macroEntriesForDay) {
    consumed.calories += Number(entry.calories || 0)
    consumed.protein += Number(entry.protein_g || 0)
    consumed.carbs += Number(entry.carbs_g || 0)
    consumed.fats += Number(entry.fat_g || 0)
  }

  const targetCalories = Number(nutritionLog.calories || 0)
  const targetProtein = Number(nutritionLog.protein || 0)
  const targetCarbs = Number(nutritionLog.carbs || 0)
  const targetFats = Number(nutritionLog.fats || 0)

  const percentages = [
    targetCalories > 0
      ? Math.min(100, (consumed.calories / targetCalories) * 100)
      : null,
    targetProtein > 0
      ? Math.min(100, (consumed.protein / targetProtein) * 100)
      : null,
    targetCarbs > 0
      ? Math.min(100, (consumed.carbs / targetCarbs) * 100)
      : null,
    targetFats > 0
      ? Math.min(100, (consumed.fats / targetFats) * 100)
      : null,
  ].filter((value): value is number => value !== null)

  const completionPercent = percentages.length
    ? Math.round(
        percentages.reduce((sum, value) => sum + value, 0) /
          percentages.length
      )
    : 0

  const mealCount = (allMealEntries || []).filter(
    (entry: any) => entry.nutrition_log_id === nutritionLog.id
  ).length + macroEntriesForDay.length

  return {
    date,
    nutritionLogId: nutritionLog.id,
    mealCount,
    targetCalories,
    consumedCalories: Math.round(consumed.calories),
    targetProtein,
    consumedProtein: Math.round(consumed.protein),
    targetCarbs,
    consumedCarbs: Math.round(consumed.carbs),
    targetFats,
    consumedFats: Math.round(consumed.fats),
    completionPercent,
    adequatelyFueled:
      mealCount > 0 && completionPercent >= 70,
    recordedMacros: recordedHistoryMacros(totalsForDay, macroEntriesForDay),
  }
})

  const yesterdayWorkout = (workoutHistory || []).find((row: any) => workoutLocalDate(row, timeZone) === yesterday)
  const todaySymptoms = mergeDailySymptoms((recentSymptoms || []).filter((row: any) => recordLocalDate(String(row.created_at), timeZone) === today), todayCycle)
  const automaticTaskIds = new Set<string>((phoenixTasks || []).map((row: any) => row.task_id))
  const mealMatches = (terms: string[]) => (mealEntries || []).some((meal: any) => terms.some((term) => `${meal.meal_name || ''} ${meal.day_block || ''}`.toLowerCase().includes(term)))
  if (mealMatches(['breakfast','morning'])) automaticTaskIds.add('morning-breakfast')
  if (mealMatches(['lunch','midday'])) automaticTaskIds.add('midday-lunch')
  if (mealMatches(['dinner','supper','evening'])) automaticTaskIds.add('evening-dinner')
  if (todayRecovery?.check_in_completed_at) ['morning-checkin','midday-checkin','evening-checkin'].forEach((id) => automaticTaskIds.add(id))
  if (Array.isArray(todayRecovery?.daily_tasks)) todayRecovery.daily_tasks.forEach((id: string) => automaticTaskIds.add(id))
  if ((recoveryActivities || []).length) automaticTaskIds.add('evening-wind-down')
  if (dailyPlan?.workoutCompleted || metricValue(todayHealthMetrics, 'workout')) automaticTaskIds.add('midday-movement')
  const waterTarget = Number(dailyPlan?.dailyTargets?.water || 0)
  const waterRemaining = Number(dailyPlan?.dailyRemaining?.water ?? waterTarget)
  if (waterTarget > 0 && ((waterTarget - waterRemaining) / waterTarget) >= .8) automaticTaskIds.add('morning-water')

  const activityByDate = new Map<string, number>()
  for (const row of recentTasks || []) activityByDate.set(String(row.log_date), (activityByDate.get(String(row.log_date)) || 0) + 1)
  for (const row of rawRecentRecovery || []) if (row.check_in_completed_at || row.sleep_hours || row.sleep_quality) activityByDate.set(String(row.log_date), (activityByDate.get(String(row.log_date)) || 0) + 1)
  for (const row of nutritionLogs || []) if (String(row.log_date) < today) activityByDate.set(String(row.log_date), (activityByDate.get(String(row.log_date)) || 0) + 1)
  for (const row of workoutHistory || []) { const logDate=workoutLocalDate(row, timeZone); if(row.completed&&logDate<today) activityByDate.set(logDate,(activityByDate.get(logDate)||0)+1) }
  let missedDayCount=0
  for (let offset = 1; offset <= 4; offset++) {
  const date = addLocalDays(today, -offset)

  const recorded = (executionHistory || []).find(
    (row: any) => String(row.log_date) === date
  )

  if (
    recorded?.streak_eligible ||
    (!recorded && (activityByDate.get(date) || 0) > 0)
  ) {
    break
  }

  missedDayCount++
}
  const recentRecovery = normalizeRecentRecovery(rawRecentRecovery || [], recentRecoveryDates)
  const completedBodySessions = latestBodySessions || []
  const latestMonthlySession = completedBodySessions.find((row: any) =>
    ['monthly', 'full'].includes(String(row.assessment_type))
  )
  const latestStructuralSession = completedBodySessions.find((row: any) =>
    ['structural', 'full'].includes(String(row.assessment_type))
  )

  return {
    date: today, userId: user.id, client, program, dailyPlan, cycleStatus, cycleAdjustment,
    plannedWorkout, plannedExercises, todayWorkoutFeedback, todayAssessment, todayRecovery,
    recoveryRewardSources: { recoveryLog: rawTodayRecovery, recoveryAvailable: !recoveryLogError,
      workoutsAvailable: !workoutHistoryError && Array.isArray(workoutHistory) },
    recentRecovery,
    todaySymptoms, recentSymptoms: recentSymptoms || [], nutritionLogs: nutritionLogs || [],
    nutritionTotals: nutritionTotals || [],
    macroEntries,
    mealEntries,
    recentFuelingHistory,
    nutritionHistoryAvailable: !nutritionLogsError && !nutritionTotalsError && !mealEntriesError && !macroEntriesError,
    hydrationHistoryAvailable: !nutritionLogsError,
    workoutHistory: workoutHistory || [],
    strengthAssessments: strengthAssessments || [], initialAssessment, measurementLogs: measurementLogs || [],
    photoRecord, photoUrls, phoenixTaskIds: Array.from(automaticTaskIds), todayRecoveryActivities: recoveryActivities || [],
    recoveryActivitiesAvailable: !recoveryActivitiesError && Array.isArray(recoveryActivities), missedDayCount, executionHistory: executionHistory || [],
    executionHistoryAvailable: !executionHistoryError && Array.isArray(executionHistory),
    yesterday: {
  workoutComplete: Boolean(yesterdayWorkout?.completed),
  nutritionLogged:
    recentFuelingHistory.find((day) => day.date === yesterday)
      ?.adequatelyFueled || false,
  taskCount: activityByDate.get(yesterday) || 0,
},
    monthlyAssessmentsDueCount,
    strengthAssessment,
    bodyAssessment: {
      latestMonthlyCompletedAt: latestMonthlySession?.completed_at || null,
      latestStructuralCompletedAt: latestStructuralSession?.completed_at || null,
      activeSession: activeBodySession
        ? {
            id: String(activeBodySession.id),
            assessment_type: String(activeBodySession.assessment_type),
            status: String(activeBodySession.status),
            started_at: activeBodySession.started_at || null,
          }
        : null,
    },
    healthMetrics: {
      today: todayHealthMetrics,
      recent: dailyHealthMetrics || [],
    },
  }
}
