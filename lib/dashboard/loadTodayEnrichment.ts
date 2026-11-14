import 'server-only'

import { after } from 'next/server'
import { getDailyExecutionPlan } from '@/lib/day/getDailyExecutionPlan'
import { getCycleStatus } from '@/lib/cycle/getCycleStatus'
import { getCurrentProgramWorkout } from '@/lib/program/getProgramWorkout'
import { getSavedPlanState, type SavedPlanState } from '@/lib/program/getSavedPlanState'
import { logRecommendationAudit } from '@/lib/legal/logRecommendationAudit'
import { getProgramLogicEngine } from '@/lib/dashboard/logic/getProgramLogicEngine'
import type { ProgramLogicOutput, ProgramTier } from '@/lib/dashboard/logic/types'
import { getMonthlyAssessmentStatus } from '@/lib/assessment/getMonthlyAssessmentStatus'
import { getDailyScheduleState, loadDailyScheduleSources } from '@/lib/schedule/service'
import type { DailyScheduleState } from '@/lib/schedule/types'
import { createDashboardRequestReads } from '@/lib/dashboard/requestReads'
import { DashboardLocalDayChangedError, prepareProgramLogicInputs } from '@/lib/dashboard/logic/loadProgramLogicInputs'
import { createDashboardRequestTiming, type DashboardRequestTiming } from '@/lib/performance/dashboardRequest'
import type { DashboardTimingEntry } from '@/lib/performance/dashboardTimingTypes'
import { getClientLocalDate, getClientTimeZone } from '@/lib/timezone'

export type TodayEnrichment = {
  version: 1
  ownerUserId: string
  clientId: string
  program: ProgramTier
  date: string
  timezone: string
  generatedAt: string
  logic: ProgramLogicOutput
  schedule: DailyScheduleState
  savedPlanState: SavedPlanState
  timings: DashboardTimingEntry[]
}

/** Full, current recommendations are separate from the small check-in bootstrap.
 * All existing plan, assessment, safety, pacing and completion calculations stay
 * together; a partially populated logic object is never returned to the client. */
export async function loadTodayEnrichment({
  supabase, user, client, program, timings = createDashboardRequestTiming(), includePhotoPreviews = true,
}: {
  supabase: any
  user: any
  client: any
  program: ProgramTier
  timings?: DashboardRequestTiming
  includePhotoPreviews?: boolean
}): Promise<TodayEnrichment> {
  if (!user?.id || !client?.client_id || client.auth_user_id !== user.id || (client.program || 'ignite') !== program) {
    throw new Error('Today recommendations require the verified member and program.')
  }
  const date = getClientLocalDate(client)
  const timezone = getClientTimeZone(client)
  const requestReads = createDashboardRequestReads({ supabase, user, client })
  const stopSourceTiming = timings.start('logic-sources')
  const preparedInputs = prepareProgramLogicInputs({ supabase, user, client, program, requestReads, includePhotoPreviews })
  void preparedInputs.ready.then(stopSourceTiming)
  const scheduleSources = timings.measure('schedule-sources', () => loadDailyScheduleSources({ supabase, user, client, sourceTimeoutMs: 2000 }))
  const cycleStatus = getCycleStatus(client)
  const [dailyPlan, monthlyAssessment, outputResult] = await Promise.all([
    timings.measure('plan', () => getDailyExecutionPlan({ supabase, client, requestReads })),
    getMonthlyAssessmentStatus(supabase, client),
    supabase.from('program_outputs').select('*').eq('client_id', client.client_id).eq('program', program)
      .order('generated_at', { ascending: false }).limit(1).maybeSingle(),
  ])
  if (outputResult.error) throw new Error('We couldn’t load your saved training plan. Please retry.')
  const output = outputResult.data
  const savedPlanState = getSavedPlanState(output)
  const { todaysWorkout, cycleAdjustment, adjustedExercises } = await getCurrentProgramWorkout({ supabase, user, client, output })
  const logic = await timings.measure('logic', () => getProgramLogicEngine({
    supabase, user, client, program, dailyPlan, cycleStatus, cycleAdjustment,
    plannedWorkout: todaysWorkout, plannedExercises: adjustedExercises,
    monthlyAssessmentsDueCount: monthlyAssessment.due ? 1 : 0,
    requestReads, preparedInputs, timings,
  }))

  const auditNutrition = { ...logic.nutrition }
  delete auditNutrition.pacing
  delete auditNutrition.macroReminder
  after(() => logRecommendationAudit({
    supabase, userId: user.id, clientId: client.client_id, recommendationType: 'daily_program_logic',
    inputSnapshot: {
      program, capacity: logic.capacityStatus.status, recovery: logic.recoveryStatus.status,
      fuel: logic.fuelReadiness.status, symptomSeverity: logic.symptoms.severity,
    },
    engineVersion: logic.engineVersion,
    recommendationOutput: {
      workoutDecision: logic.workoutDecision, hydration: logic.hydration, nutrition: auditNutrition,
      cycle: logic.cycle, insight: logic.insight, flameState: logic.flameState,
    },
    confidenceLevel: 'rules_based',
  }))

  const schedule = await timings.measure('schedule', () => getDailyScheduleState({
    supabase, user, client, logic, dailyPlan, sourceTimeoutMs: 2000, sources: scheduleSources,
  }))
  if (getClientLocalDate(client) !== date || getClientTimeZone(client) !== timezone || schedule.date !== date || schedule.timezone !== timezone) {
    throw new DashboardLocalDayChangedError()
  }
  return {
    version: 1, ownerUserId: user.id, clientId: client.client_id, program, date, timezone,
    generatedAt: schedule.now, logic, schedule, savedPlanState, timings: timings.snapshot(),
  }
}
