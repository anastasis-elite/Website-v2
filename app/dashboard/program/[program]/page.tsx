import { redirect } from 'next/navigation'
import Link from 'next/link'
import PlanOverview from '@/components/program-dashboard/PlanOverview'
import EmberDashboard from '@/components/program-dashboard/EmberDashboard'
import IgniteDashboard from '@/components/program-dashboard/IgniteDashboard'
import PhoenixDashboard from '@/components/program-dashboard/PhoenixDashboard'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { getDailyExecutionPlan } from '@/lib/day/getDailyExecutionPlan'
import { getCycleStatus } from '@/lib/cycle/getCycleStatus'
import { getCurrentProgramWorkout } from '@/lib/program/getProgramWorkout'
import { getSavedPlanState } from '@/lib/program/getSavedPlanState'
import { getRecentSafetyFlags } from '@/lib/safety/getRecentSafetyFlags'
import SafetyEscalationNotice from '@/components/legal/SafetyEscalationNotice'
import { logRecommendationAudit } from '@/lib/legal/logRecommendationAudit'
import { getProgramLogicEngine } from '@/lib/dashboard/logic/getProgramLogicEngine'
import type { ProgramTier } from '@/lib/dashboard/logic/types'
import { getMonthlyAssessmentStatus } from '@/lib/assessment/getMonthlyAssessmentStatus'
import { getDailyScheduleState, loadDailyScheduleSources } from '@/lib/schedule/service'
import { createDashboardRequestReads } from '@/lib/dashboard/requestReads'
import { DashboardLocalDayChangedError, prepareProgramLogicInputs } from '@/lib/dashboard/logic/loadProgramLogicInputs'
import { createDashboardRequestTiming } from '@/lib/performance/dashboardRequest'
import { getPhoenixRecipeRecommendations } from '@/lib/nutrition/recipes/getPhoenixRecipeRecommendations'
import { Suspense } from 'react'
import { after } from 'next/server'
import DashboardReadyShell from '@/components/program-dashboard/DashboardReadyShell'
import DashboardPerformance from '@/components/DashboardPerformance'
import styles from '@/components/program-dashboard/TodayPlanTheme.module.css'

const supportedPrograms = ['ember', 'ignite', 'phoenix'] as const

function getPhoenixTrackLabel({
  client,
  programJson,
}: {
  client: any
  programJson: any
}) {
  const phoenixTrackLabels: Record<string, string> = {
    phoenixStrength: 'Strength',
    phoenixHypertrophy: 'Hypertrophy',
    phoenixBodybuilding: 'Bodybuilding',
    phoenixRecomposition: 'Recomposition',
    phoenixEndurance: 'Endurance',
    phoenixGluteSculpt: 'Glute Sculpt',
    phoenixWaistCincher: 'Waist Cincher',
    phoenixFullTransformation: 'Full Transformation',
  }

  const phoenixTrack = programJson?.phoenix_track || client?.phoenix_track || ''

  return phoenixTrackLabels[phoenixTrack] || 'Personalized'
}

export default async function ProgramPage({
  params,
  searchParams,
}: {
  params: Promise<{ program: string }>
  searchParams?: Promise<{ view?: string }>
}) {
  const timings = createDashboardRequestTiming()
  const { program, view } = await timings.measure('routing', async () => ({
    ...(await params), view: (await searchParams)?.view === 'plan' ? 'plan' as const : 'today' as const,
  }))

  if (!supportedPrograms.includes(program as any)) {
    redirect('/dashboard')
  }

  const { supabase, user, client } = await timings.measure('context', () => getDashboardContext())
  const subscribedProgram = client.program || 'ignite'

  if (program !== subscribedProgram) {
    redirect(`/dashboard/program/${subscribedProgram}`)
  }

  const safetyFlags = await timings.measure('safety', () => getRecentSafetyFlags(supabase, client.client_id))
  if (safetyFlags.length) {
    after(() => logRecommendationAudit({
      supabase, userId: user.id, clientId: client.client_id, recommendationType: 'dashboard_safety_escalation',
      inputReference: `client_symptom_logs:${client.client_id}`, engineVersion: 'safety_v1.0',
      recommendationOutput: { blocked: true }, safetyFlags,
    }))
    return <SafetyEscalationNotice flags={safetyFlags} />
  }

  return <main className={styles.page}><Suspense fallback={<DashboardReadyShell program={program as ProgramTier} showStreak={view === 'today'} />}>
    <PersonalizedDashboard supabase={supabase} user={user} client={client} program={program as ProgramTier} view={view} timings={timings} />
  </Suspense></main>
}

type PersonalizedDashboardProps = {
  supabase: any; user: any; client: any; program: ProgramTier; view: 'today' | 'plan'
  timings: ReturnType<typeof createDashboardRequestTiming>
}

async function PersonalizedDashboard(props: PersonalizedDashboardProps) {
  // A request that crosses local midnight must reload the plan and its sources
  // together. Never combine yesterday's saved targets with today's checkoffs.
  try { return await loadPersonalizedDashboard(props) }
  catch (error) {
    if (!(error instanceof DashboardLocalDayChangedError)) throw error
    return loadPersonalizedDashboard(props)
  }
}

async function loadPersonalizedDashboard({ supabase, user, client, program, view, timings }: PersonalizedDashboardProps) {

  const requestReads = createDashboardRequestReads({ supabase, user, client })
  const stopSourceTiming = timings.start('logic-sources')
  const preparedInputs = prepareProgramLogicInputs({ supabase, user, client, program, requestReads })
  void preparedInputs.ready.then(stopSourceTiming)
  const scheduleSources = timings.measure('schedule-sources', () => loadDailyScheduleSources({ supabase, user, client, sourceTimeoutMs: 2000 }))
  const cycleStatus = getCycleStatus(client)
  const [dailyPlan, monthlyAssessment, outputResult] = await Promise.all([
    timings.measure('plan', () => getDailyExecutionPlan({ supabase, client, requestReads })),
    getMonthlyAssessmentStatus(supabase, client),
    supabase
      .from('program_outputs')
      .select('*')
      .eq('client_id', client.client_id)
      .eq('program', program)
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])
  if (outputResult.error) throw new Error('We couldn’t load your saved training plan. Please retry.')
  const output = outputResult.data
  const savedPlanState = getSavedPlanState(output)
  const monthlyAssessmentsDueCount = monthlyAssessment.due ? 1 : 0

  const { programJson, todaysWorkout, cycleAdjustment, adjustedExercises } =
    await getCurrentProgramWorkout({ supabase, user, client, output })

  const logic = await timings.measure('logic', () => getProgramLogicEngine({
    supabase,
    user,
    client,
    program: program as ProgramTier,
    dailyPlan,
    cycleStatus,
    cycleAdjustment,
    plannedWorkout: todaysWorkout,
    plannedExercises: adjustedExercises,
    monthlyAssessmentsDueCount,
    requestReads,
    preparedInputs,
    timings,
  }))

  // These transient presentation hints are not additional audit/analytics data.
  const auditNutrition = { ...logic.nutrition }
  delete auditNutrition.pacing
  delete auditNutrition.macroReminder
  after(() => logRecommendationAudit({
    supabase,
    userId: user.id,
    clientId: client.client_id,
    recommendationType: 'daily_program_logic',
    inputSnapshot: {
      program,
      capacity: logic.capacityStatus.status,
      recovery: logic.recoveryStatus.status,
      fuel: logic.fuelReadiness.status,
      symptomSeverity: logic.symptoms.severity,
    },
    engineVersion: logic.engineVersion,
    recommendationOutput: {
      workoutDecision: logic.workoutDecision,
      hydration: logic.hydration,
      nutrition: auditNutrition,
      cycle: logic.cycle,
      insight: logic.insight,
      flameState: logic.flameState,
    },
    confidenceLevel: 'rules_based',
  }))

  const schedule = await timings.measure('schedule', () => getDailyScheduleState({
    supabase,
    user,
    client,
    logic,
    dailyPlan,
    sourceTimeoutMs: 2000,
    sources: scheduleSources,
  }))
  if (view === 'plan') return <PlanOverview logic={logic} schedule={schedule} />
  const phoenixRecipes = program === 'phoenix' ? getPhoenixRecipeRecommendations({ logic, client }) : []
  const todayModel = schedule.todayViewModel
  const actionable = todayModel?.version === 1 && todayModel.date === schedule.date && todayModel.timezone === schedule.timezone &&
    todayModel.generatedAt === schedule.now && todayModel.clientId === logic.client.id && todayModel.tier === logic.program

  return (
    <>
      {savedPlanState.status !== 'ready' ? <aside className="aos-card" role="status">
        <h2>{savedPlanState.status === 'incomplete' ? 'Your saved training plan needs a retry.' : 'Your training plan is not saved yet.'}</h2>
        <p>{savedPlanState.status === 'incomplete' ? 'Some training days are incomplete. Review your saved assessment and retry creating the plan. Your previous plans and workout history stay saved.' : 'Open plan setup to create your plan from your saved assessments.'}</p>
        <Link href="/dashboard/onboarding/plan">{savedPlanState.status === 'incomplete' ? 'Review and retry plan' : 'Open plan setup'}</Link>
      </aside> : null}
      <DashboardPerformance stage="shell" />
      <DashboardPerformance stage="primary" timings={timings.snapshot()} actionable={actionable} />
      <DashboardPerformance stage="secondary" snapshot={schedule.now} />
      {program === 'ember' && (
        <EmberDashboard logic={logic} schedule={schedule} />
      )}

      {program === 'ignite' && (
        <IgniteDashboard logic={logic} schedule={schedule} />
      )}

      {program === 'phoenix' && (
        <PhoenixDashboard logic={logic} schedule={schedule} trackLabel={getPhoenixTrackLabel({ client, programJson })} recipes={phoenixRecipes} />
      )}
    </>
  )
}
