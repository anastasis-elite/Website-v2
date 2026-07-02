import type { ProgramLogicInputs, ProgramTier } from './types'

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
  const ninetyDaysAgo = day(-90)
  const start = `${today}T00:00:00.000Z`, end = `${today}T23:59:59.999Z`
  const yesterdayStart = `${yesterday}T00:00:00.000Z`, yesterdayEnd = `${yesterday}T23:59:59.999Z`

  const [
    { data: todayAssessment }, { data: todayRecovery }, { data: recentSymptoms },
    { data: nutritionLogs }, { data: workoutHistory }, { data: strengthAssessments },
    { data: initialAssessment }, { data: measurementLogs }, { data: photoRecord },
    { data: phoenixTasks }, { data: yesterdayTasks },
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
    supabase.from('phoenix_daily_task_completions').select('task_id').eq('user_id', user.id).eq('client_id', client.client_id).eq('log_date', yesterday),
  ])

  const nutritionIds = (nutritionLogs || []).map((row: any) => row.id)
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

  return {
    date: today, userId: user.id, client, program, dailyPlan, cycleStatus, cycleAdjustment,
    plannedWorkout, plannedExercises, todayAssessment, todayRecovery,
    todaySymptoms, recentSymptoms: recentSymptoms || [], nutritionLogs: nutritionLogs || [],
    nutritionTotals: nutritionTotals || [], mealEntries: mealEntries || [], workoutHistory: workoutHistory || [],
    strengthAssessments: strengthAssessments || [], initialAssessment, measurementLogs: measurementLogs || [],
    photoRecord, photoUrls, phoenixTaskIds: (phoenixTasks || []).map((row: any) => row.task_id),
    yesterday: { workoutComplete: Boolean(yesterdayWorkout?.completed), nutritionLogged: Boolean(yesterdayNutrition), taskCount: (yesterdayTasks || []).length },
    monthlyAssessmentsDueCount,
  }
}
