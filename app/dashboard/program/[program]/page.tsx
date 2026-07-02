import { redirect } from 'next/navigation'
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
}: {
  params: { program: string }
}) {
  const program = params.program

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
    await logRecommendationAudit({
      supabase, userId: user.id, recommendationType: 'dashboard_safety_escalation',
      inputReference: `client_symptom_logs:${client.client_id}`, engineVersion: 'safety_v1.0',
      recommendationOutput: { blocked: true }, safetyFlags,
    })
    return <SafetyEscalationNotice flags={safetyFlags} />
  }

  const dailyPlan = await getDailyExecutionPlan({ supabase, client })
  const cycleStatus = getCycleStatus(client)

  const monthlyAssessment = await getMonthlyAssessmentStatus(supabase, client.client_id)
  const monthlyAssessmentsDueCount = monthlyAssessment.due ? 1 : 0
  const { data: output } = await supabase
    .from('program_outputs')
    .select('*')
    .eq('client_id', client.client_id)
    .eq('program', program)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

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

  await logRecommendationAudit({
    supabase,
    userId: user.id,
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
  })

  return (
    <main>
      {program === 'ember' && (
        <EmberDashboard logic={logic} />
      )}

      {program === 'ignite' && (
        <IgniteDashboard logic={logic} />
      )}

      {program === 'phoenix' && (
        <PhoenixDashboard logic={logic} trackLabel={getPhoenixTrackLabel({ client, programJson })} />
      )}
    </main>
  )
}
