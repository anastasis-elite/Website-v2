import { calculatePercentageExecutionScore } from '@/lib/dashboard/logic/calculateExecutionScore'
import type { AccountData, AccountProgram, JourneyMetric } from './types'

const supportedPrograms = new Set(['ember', 'ignite', 'phoenix'])

function dateDaysAgo(days: number) {
  const value = new Date()
  value.setUTCHours(0, 0, 0, 0)
  value.setUTCDate(value.getUTCDate() - days)
  return value.toISOString()
}

function number(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function percent(completed: number, target: number) {
  return target > 0 ? Math.min(100, Math.round((completed / target) * 100)) : 0
}

function normalizeWorkoutTarget(value: unknown) {
  if (Array.isArray(value)) return Math.max(1, Math.min(7, value.length))
  if (typeof value === 'string') {
    const matches = value.match(/\d+/)
    if (matches) return Math.max(1, Math.min(7, Number(matches[0])))
    const days = value.split(',').filter(Boolean).length
    if (days) return Math.max(1, Math.min(7, days))
  }
  return Math.max(1, Math.min(7, number(value, 3)))
}

function recoveryPercent(row: any) {
  const available = [
    row?.energy_level ? number(row.energy_level) * 10 : null,
    row?.sleep_quality ? number(row.sleep_quality) * 10 : null,
    row?.stress_level ? 100 - number(row.stress_level) * 10 : null,
    row?.soreness_level ? 100 - number(row.soreness_level) * 10 : null,
  ].filter((value): value is number => value !== null)
  return available.length ? Math.max(0, Math.min(100, Math.round(available.reduce((sum, value) => sum + value, 0) / available.length))) : null
}

function goalProgress(strengthAssessments: any[]) {
  const latest = strengthAssessments[0]?.data || {}
  const oldest = strengthAssessments.at(-1)?.data || {}
  const current = number(latest.weight, NaN)
  const starting = number(oldest.weight, NaN)
  const target = number(latest.goal_weight ?? latest.target_weight, NaN)
  if (![current, starting, target].every(Number.isFinite) || starting === target) return null
  return Math.max(0, Math.min(100, Math.round(((starting - current) / (starting - target)) * 100)))
}

function metric(key: JourneyMetric['key'], label: string, completed: number, target: number): JourneyMetric {
  return { key, label, completed, target, percent: percent(completed, target) }
}

export async function getAccountData({ supabase, user, client }: { supabase: any; user: any; client: any }): Promise<AccountData> {
  const weekStart = dateDaysAgo(6)
  const monthStart = dateDaysAgo(29)
  const [{ data: workouts }, { data: nutrition }, { data: recovery }, { data: assessments }, { data: strengthAssessments }, { data: recommendations }] = await Promise.all([
    supabase.from('workout_logs').select('workout_date,completed').eq('client_id', client.client_id).eq('completed', true),
    supabase.from('nutrition_logs').select('log_date,water_consumed_oz,water_oz').eq('client_id', client.client_id).gte('log_date', monthStart.slice(0, 10)),
    supabase.from('recovery_logs').select('log_date,energy_level,sleep_quality,stress_level,soreness_level').eq('client_id', client.client_id).gte('log_date', monthStart.slice(0, 10)),
    supabase.from('assessments').select('submitted_at,assessment_type').eq('client_id', client.client_id).gte('submitted_at', monthStart),
    supabase.from('assessments').select('data,submitted_at').eq('client_id', client.client_id).eq('assessment_type', 'strength').order('submitted_at', { ascending: false }).limit(12),
    supabase.from('dashboard_daily_recommendations').select('log_date,recommendation_output').eq('user_id', user.id).eq('client_id', client.client_id).gte('log_date', monthStart.slice(0, 10)).order('log_date', { ascending: false }),
  ])

  const workoutRows = workouts || []
  const nutritionRows = nutrition || []
  const recoveryRows = recovery || []
  const assessmentRows = assessments || []
  const recommendationRows = recommendations || []
  const weekWorkouts = workoutRows.filter((row: any) => String(row.workout_date) >= weekStart)
  const weekNutrition = nutritionRows.filter((row: any) => String(row.log_date) >= weekStart.slice(0, 10))
  const weekRecovery = recoveryRows.filter((row: any) => String(row.log_date) >= weekStart.slice(0, 10))
  const weekAssessments = assessmentRows.filter((row: any) => String(row.submitted_at) >= weekStart)
  const workoutTarget = normalizeWorkoutTarget(client.workout_days_available ?? client.workout_days)
  const hydrationTarget = Math.max(1, number(client.hydration_target ?? client.water_target, 100))
  const hydrationComplete = weekNutrition.filter((row: any) => number(row.water_consumed_oz) >= number(row.water_oz, hydrationTarget) * .9).length
  const metrics = [
    metric('workouts', 'Workouts', weekWorkouts.length, workoutTarget),
    metric('nutrition', 'Nutrition', weekNutrition.length, 7),
    metric('hydration', 'Hydration', hydrationComplete, 7),
    metric('assessments', 'Assessments', new Set(weekAssessments.map((row: any) => String(row.submitted_at).slice(0, 10))).size, 7),
    metric('recovery', 'Recovery', weekRecovery.length, 7),
  ]
  const byKey = Object.fromEntries(metrics.map((item) => [item.key, item.percent]))
  const averageCompletionPercent = calculatePercentageExecutionScore({
    hydration: byKey.hydration,
    nutrition: byKey.nutrition,
    workout: byKey.workouts,
    assessment: byKey.assessments,
    recovery: byKey.recovery,
  })
  const waterValues = nutritionRows.map((row: any) => number(row.water_consumed_oz)).filter((value: number) => value > 0)
  const recoveryValues: number[] = recoveryRows.map(recoveryPercent).filter((value: number | null): value is number => value !== null)
  const completedDates = new Set<string>()
  recommendationRows.forEach((row: any) => {
    if (number(row.recommendation_output?.flameState?.dailyScore) >= 75) completedDates.add(row.log_date)
  })
  if (!completedDates.size) workoutRows.forEach((row: any) => completedDates.add(String(row.workout_date).slice(0, 10)))
  const program = supportedPrograms.has(client.program) ? client.program as AccountProgram : 'ignite'
  const score = averageCompletionPercent
  const flame = score >= 100 ? ['roaring_flame', 'Week complete'] : score >= 75 ? ['strong_flame', 'Almost complete'] : score >= 50 ? ['steady_flame', 'Momentum is building'] : score >= 25 ? ['small_flame', 'You’re moving'] : ['spark', 'Start small']

  return {
    profile: {
      clientId: String(client.client_id),
      name: String(client.full_name || client.first_name || user.email?.split('@')[0] || 'Member'),
      email: String(client.email || client.login_email || user.email || ''),
      program,
      avatarUrl: client.avatar_url || client.profile_photo_url || null,
      capacityStatement: client.capacity_statement || 'Expanding my capacity every day. Stronger body. Clearer mind. Unstoppable me.',
      memberSince: client.subscription_started_at || client.created_at || user.created_at || null,
      subscriptionStatus: client.subscription_status || client.status || null,
    },
    streak: Math.max(0, Math.round(number(client.current_streak ?? client.execution_streak ?? client.streak))),
    flame: { score, state: flame[0], message: flame[1] },
    summary: {
      totalCompletedDays: completedDates.size,
      goalProgressPercent: goalProgress(strengthAssessments || []),
      workoutsCompleted: workoutRows.length,
      waterAverageOz: waterValues.length ? Math.round(waterValues.reduce((sum: number, value: number) => sum + value, 0) / waterValues.length) : null,
      recoveryAveragePercent: recoveryValues.length ? Math.round(recoveryValues.reduce((sum: number, value: number) => sum + value, 0) / recoveryValues.length) : null,
    },
    journey: { averageCompletionPercent, metrics },
  }
}
