import type { ProgramLogicInputs, ProgramTier } from './types'
import { getSleepStatusForDashboard } from '@/lib/sleep/getSleepStatusForDashboard'

function day(offset = 0) {
  const date = new Date()
  date.setUTCHours(0, 0, 0, 0)
  date.setUTCDate(date.getUTCDate() + offset)
  return date.toISOString().slice(0, 10)
}

export async function loadProgramLogicInputs({
  supabase, user, client, program, dailyPlan, cycleStatus, cycleAdjustment,
  plannedWorkout, plannedExercises, monthlyAssessmentsDueCount,
}: {
  supabase: any; user: any; client: any; program: ProgramTier; dailyPlan: any
  cycleStatus: any; cycleAdjustment: any; plannedWorkout: any
  plannedExercises: any[]; monthlyAssessmentsDueCount: number
}): Promise<ProgramLogicInputs> {
  const today = day()
  const yesterday = day(-1)
  const fourteenDaysAgo = day(-13)
  const fourDaysAgo = day(-4)
  const ninetyDaysAgo = day(-90)
  const start = `${today}T00:00:00.000Z`, end = `${today}T23:59:59.999Z`
  const yesterdayStart = `${yesterday}T00:00:00.000Z`, yesterdayEnd = `${yesterday}T23:59:59.999Z`

  const [
    { data: todayAssessment }, { data: rawTodayRecovery }, { data: recentSymptoms },
    { data: nutritionLogs }, { data: workoutHistory }, { data: strengthAssessments },
    { data: initialAssessment }, { data: measurementLogs }, { data: photoRecord },
    { data: phoenixTasks }, { data: recentTasks }, { data: todayWorkoutFeedback },
    { data: recoveryActivities }, { data: recentRecovery }, { data: executionHistory },
  ] = await Promise.all([
    supabase.from('assessments').select('*').eq('client_id', client.client_id).gte('submitted_at', start).lte('submitted_at', end).limit(1).maybeSingle(),
    supabase.from('recovery_logs').select('*').eq('client_id', client.client_id).eq('log_date', today).limit(1).maybeSingle(),
    supabase.from('client_symptom_logs').select('*, symptom_types(name,category)').eq('client_id', client.client_id).gte('created_at', `${ninetyDaysAgo}T00:00:00.000Z`).order('created_at', { ascending: false }).limit(100),
    supabase.from('nutrition_logs').select('*').eq('client_id', client.client_id).gte('log_date', fourteenDaysAgo).lte('log_date', today).order('log_date'),
    supabase.from('workout_logs').select('*').eq('client_id', client.client_id).gte('workout_date', `${ninetyDaysAgo}T00:00:00.000Z`).lte('workout_date', end).order('workout_date', { ascending: false }).limit(100),
    supabase.from('assessments').select('*').eq('client_id', client.client_id).eq('assessment_type', 'strength').order('submitted_at', { ascending: false }).limit(5),
    supabase.from('assessments').select('*').eq('client_id', client.client_id).eq('assessment_type', 'initial').order('submitted_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('measurement_logs').select('*').eq('client_id', client.client_id).order('log_date', { ascending: false }).limit(2),
    supabase.from('assessment_photos').select('*').eq('client_id', client.client_id).order('uploaded_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('phoenix_daily_task_completions').select('task_id').eq('user_id', user.id).eq('client_id', client.client_id).eq('log_date', today),
    supabase.from('phoenix_daily_task_completions').select('task_id,log_date').eq('user_id', user.id).eq('client_id', client.client_id).gte('log_date', fourDaysAgo).lt('log_date', today),
    supabase.from('workout_plan_feedback').select('*').eq('user_id', user.id).eq('client_id', client.client_id).eq('feedback_date', today).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('recovery_activity_logs').select('*').eq('user_id', user.id).eq('client_id', client.client_id).eq('log_date', today),
    supabase.from('recovery_logs').select('log_date,check_in_completed_at,sleep_hours,sleep_quality').eq('client_id', client.client_id).gte('log_date', fourDaysAgo).lt('log_date', today),
    supabase.from('daily_execution_status').select('log_date,streak_eligible').eq('user_id',user.id).eq('client_id',client.client_id).lt('log_date',today).order('log_date',{ascending:false}).limit(30),
  ])

  const nutritionIds = (nutritionLogs || []).map((row: any) => row.id)
  const sleepStatus=await getSleepStatusForDashboard(supabase,client.client_id,today)
  const todayRecovery=sleepStatus.logged?{...(rawTodayRecovery||{}),sleep_hours:sleepStatus.durationHours,sleep_quality:sleepStatus.quality,sleep_bedtime:sleepStatus.bedtime,sleep_wake_time:sleepStatus.wakeTime}:rawTodayRecovery
  const { data: nutritionTotals } = nutritionIds.length
    ? await supabase.from('nutrition_log_totals_by_block').select('*').in('nutrition_log_id', nutritionIds)
    : { data: [] }
  const todayNutrition = (nutritionLogs || []).find((row: any) => row.log_date === today)
  const { data: mealEntries } = todayNutrition?.id
    ? await supabase.from('meal_entries').select('id,meal_name,day_block,created_at,food_id').eq('nutrition_log_id', todayNutrition.id).order('created_at', { ascending: false })
    : { data: [] }

  const paths = ['front_photo_url','back_photo_url','left_photo_url','right_photo_url'].map((key) => photoRecord?.[key]).filter(Boolean)
  const photoUrls = (await Promise.all(paths.slice(0, 3).map(async (path: string) => {
    const { data } = await supabase.storage.from('assessment_photos').createSignedUrl(path, 1800)
    return data?.signedUrl || null
  }))).filter((url): url is string => Boolean(url))

  const yesterdayWorkout = (workoutHistory || []).find((row: any) => String(row.workout_date).slice(0, 10) === yesterday)
  const yesterdayNutrition = (nutritionLogs || []).find((row: any) => row.log_date === yesterday)
  const todaySymptoms = (recentSymptoms || []).filter((row: any) => String(row.created_at).slice(0, 10) === today)
  const automaticTaskIds = new Set<string>((phoenixTasks || []).map((row: any) => row.task_id))
  const mealMatches = (terms: string[]) => (mealEntries || []).some((meal: any) => terms.some((term) => `${meal.meal_name || ''} ${meal.day_block || ''}`.toLowerCase().includes(term)))
  if (mealMatches(['breakfast','morning'])) automaticTaskIds.add('morning-breakfast')
  if (mealMatches(['lunch','midday'])) automaticTaskIds.add('midday-lunch')
  if (mealMatches(['dinner','supper','evening'])) automaticTaskIds.add('evening-dinner')
  if (todayRecovery?.check_in_completed_at) ['morning-checkin','midday-checkin','evening-checkin'].forEach((id) => automaticTaskIds.add(id))
  if (Array.isArray(todayRecovery?.daily_tasks)) todayRecovery.daily_tasks.forEach((id: string) => automaticTaskIds.add(id))
  if ((recoveryActivities || []).length) automaticTaskIds.add('evening-wind-down')
  if (dailyPlan?.workoutCompleted) automaticTaskIds.add('midday-movement')
  const waterTarget = Number(dailyPlan?.dailyTargets?.water || 0)
  const waterRemaining = Number(dailyPlan?.dailyRemaining?.water ?? waterTarget)
  if (waterTarget > 0 && ((waterTarget - waterRemaining) / waterTarget) >= .8) automaticTaskIds.add('morning-water')

  const activityByDate = new Map<string, number>()
  for (const row of recentTasks || []) activityByDate.set(String(row.log_date), (activityByDate.get(String(row.log_date)) || 0) + 1)
  for (const row of recentRecovery || []) if (row.check_in_completed_at || row.sleep_hours || row.sleep_quality) activityByDate.set(String(row.log_date), (activityByDate.get(String(row.log_date)) || 0) + 1)
  for (const row of nutritionLogs || []) if (String(row.log_date) < today) activityByDate.set(String(row.log_date), (activityByDate.get(String(row.log_date)) || 0) + 1)
  for (const row of workoutHistory || []) { const logDate=String(row.workout_date).slice(0,10); if(row.completed&&logDate<today) activityByDate.set(logDate,(activityByDate.get(logDate)||0)+1) }
  let missedDayCount=0
  for(let offset=1;offset<=4;offset++){const date=day(-offset);const recorded=(executionHistory||[]).find((row:any)=>String(row.log_date)===date);if(recorded?.streak_eligible||(!recorded&&(activityByDate.get(date)||0)>0))break;missedDayCount++}

  return {
    date: today, userId: user.id, client, program, dailyPlan, cycleStatus, cycleAdjustment,
    plannedWorkout, plannedExercises, todayWorkoutFeedback, todayAssessment, todayRecovery,
    todaySymptoms, recentSymptoms: recentSymptoms || [], nutritionLogs: nutritionLogs || [],
    nutritionTotals: nutritionTotals || [], mealEntries: mealEntries || [], workoutHistory: workoutHistory || [],
    strengthAssessments: strengthAssessments || [], initialAssessment, measurementLogs: measurementLogs || [],
    photoRecord, photoUrls, phoenixTaskIds: Array.from(automaticTaskIds), todayRecoveryActivities: recoveryActivities || [], missedDayCount, executionHistory: executionHistory || [],
    yesterday: { workoutComplete: Boolean(yesterdayWorkout?.completed), nutritionLogged: Boolean(yesterdayNutrition), taskCount: activityByDate.get(yesterday) || 0 },
    monthlyAssessmentsDueCount,
  }
}
