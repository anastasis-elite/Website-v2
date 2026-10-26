import { redirect } from 'next/navigation'
import PlanOverview from '@/components/program-dashboard/PlanOverview'
import EmberDashboard from '@/components/program-dashboard/EmberDashboard'
import IgniteDashboard from '@/components/program-dashboard/IgniteDashboard'
import PhoenixDashboard from '@/components/program-dashboard/PhoenixDashboard'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { getDailyExecutionPlan } from '@/lib/day/getDailyExecutionPlan'
import { getCycleStatus } from '@/lib/cycle/getCycleStatus'
import { getProgramWorkout } from '@/lib/program/getProgramWorkout'
import { getRecentSafetyFlags } from '@/lib/safety/getRecentSafetyFlags'
import SafetyEscalationNotice from '@/components/legal/SafetyEscalationNotice'
import { logRecommendationAudit } from '@/lib/legal/logRecommendationAudit'
import { getProgramLogicEngine } from '@/lib/dashboard/logic/getProgramLogicEngine'
import type { ProgramTier } from '@/lib/dashboard/logic/types'
import { getMonthlyAssessmentStatus } from '@/lib/assessment/getMonthlyAssessmentStatus'
import { getDailyScheduleState } from '@/lib/schedule/service'
import { getPhoenixRecipeRecommendations } from '@/lib/nutrition/recipes/getPhoenixRecipeRecommendations'
import { Suspense } from 'react'
import { after } from 'next/server'
import DashboardReadyShell from '@/components/program-dashboard/DashboardReadyShell'
import DashboardPerformance from '@/components/DashboardPerformance'

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
  const { program } = await params
  const view = (await searchParams)?.view === 'plan' ? 'plan' : 'today'

  if (!supportedPrograms.includes(program as any)) {
    redirect('/dashboard')
  }

  const { supabase, user, client } = await getDashboardContext()
  const subscribedProgram = client.program || 'ignite'

  if (program !== subscribedProgram) {
    redirect(`/dashboard/program/${subscribedProgram}`)
  }

  const safetyFlags = await getRecentSafetyFlags(supabase, client.client_id)
  if (safetyFlags.length) {
    after(() => logRecommendationAudit({
      supabase, userId: user.id, clientId: client.client_id, recommendationType: 'dashboard_safety_escalation',
      inputReference: `client_symptom_logs:${client.client_id}`, engineVersion: 'safety_v1.0',
      recommendationOutput: { blocked: true }, safetyFlags,
    }))
    return <SafetyEscalationNotice flags={safetyFlags} />
  }

  return <main><Suspense fallback={<DashboardReadyShell program={program as ProgramTier} />}>
    <PersonalizedDashboard supabase={supabase} user={user} client={client} program={program as ProgramTier} view={view} />
  </Suspense></main>
}

async function PersonalizedDashboard({ supabase, user, client, program, view }: {
  supabase: any; user: any; client: any; program: ProgramTier; view: 'today' | 'plan'
}) {

  const cycleStatus = getCycleStatus(client)
  const [dailyPlan, monthlyAssessment, { data: output }] = await Promise.all([
    getDailyExecutionPlan({ supabase, client }),
    getMonthlyAssessmentStatus(supabase, client.client_id),
    supabase
      .from('program_outputs')
      .select('*')
      .eq('client_id', client.client_id)
      .eq('program', program)
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])
  const monthlyAssessmentsDueCount = monthlyAssessment.due ? 1 : 0

  const { programJson, todaysWorkout, cycleAdjustment, adjustedExercises } =
    getProgramWorkout({ client, output })

  const logic = await getProgramLogicEngine({
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
  })

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
      nutrition: logic.nutrition,
      cycle: logic.cycle,
      insight: logic.insight,
      flameState: logic.flameState,
    },
    confidenceLevel: 'rules_based',
  }))

  const schedule = await getDailyScheduleState({
    supabase,
    user,
    client,
    logic,
    dailyPlan,
    sourceTimeoutMs: 2000,
  })
  if (view === 'plan') return <PlanOverview logic={logic} schedule={schedule} />
  const phoenixRecipes = program === 'phoenix' ? getPhoenixRecipeRecommendations({ logic, client }) : []

  return (
    <>
      <DashboardPerformance stage="shell" />
      <DashboardPerformance stage="primary" />
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
