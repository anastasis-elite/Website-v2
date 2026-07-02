import { redirect } from 'next/navigation'
import EmberDashboard from '@/components/program-dashboard/EmberDashboard'
import IgniteDashboard from '@/components/program-dashboard/IgniteDashboard'
import PhoenixDashboard from '@/components/program-dashboard/PhoenixDashboard'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { getDailyExecutionPlan } from '@/lib/day/getDailyExecutionPlan'
import { getCycleStatus } from '@/lib/cycle/getCycleStatus'
import { getAdaptiveDashboard } from '@/lib/dashboard/getAdaptiveDashboard'
import { generateDailyInsight } from '@/lib/messaging/engine'
import type { CapacityState, CyclePhase } from '@/lib/messaging/types'
import { getProgramWorkout } from '@/lib/program/getProgramWorkout'
import { getRecentSafetyFlags } from '@/lib/safety/getRecentSafetyFlags'
import SafetyEscalationNotice from '@/components/legal/SafetyEscalationNotice'
import { logRecommendationAudit } from '@/lib/legal/logRecommendationAudit'
import { getEmberDashboardData } from '@/lib/dashboard/ember/getEmberDashboardData'
import { getIgniteDashboardData } from '@/lib/dashboard/ignite/getIgniteDashboardData'
import { getPhoenixDashboardData } from '@/lib/dashboard/phoenix/getPhoenixDashboardData'

const supportedPrograms = ['ember', 'ignite', 'phoenix'] as const

function getCapacityState(client: any): CapacityState {
  const rawCapacity = client?.capacity_state || client?.capacity || 'low'

  return rawCapacity === 'high' ||
    rawCapacity === 'medium' ||
    rawCapacity === 'low'
    ? rawCapacity
    : 'low'
}

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

  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const monthStartDate = monthStart.toISOString().split('T')[0]
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data: monthlyAssessment } = await supabase
    .from('assessments')
    .select('id')
    .eq('client_id', client.client_id)
    .gte('submitted_at', thirtyDaysAgo.toISOString())
    .limit(1)
    .maybeSingle()

  const { data: monthlyMeasurements } = await supabase
    .from('measurement_logs')
    .select('id')
    .eq('client_id', client.client_id)
    .gte('log_date', monthStartDate)
    .limit(1)
    .maybeSingle()

  const dailyStructureReviewedThisMonth = client.daily_structure_reviewed_at
    ? new Date(client.daily_structure_reviewed_at) >= monthStart
    : false

  const monthlyAssessmentsDueCount = [
    !monthlyAssessment,
    !dailyStructureReviewedThisMonth,
    !monthlyMeasurements,
  ].filter(Boolean).length
  const adaptiveDashboard = await getAdaptiveDashboard({
    client,
    monthlyAssessmentsDueCount,
  })

  const { data: output } = await supabase
    .from('program_outputs')
    .select('*')
    .eq('client_id', client.client_id)
    .eq('program', program)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { programJson, todaysWorkout, cycleAdjustment } =
    getProgramWorkout({ client, output })

  const emberDashboardData = program === 'ember'
    ? await getEmberDashboardData({
        supabase,
        client,
        dailyPlan,
        todaysWorkout,
      })
    : null

  const completions = [
    dailyPlan?.workoutCompleted,
    dailyPlan?.nutritionLogged,
    dailyPlan?.macroTargetsMet,
  ].filter(Boolean).length

  const insight = generateDailyInsight({
    cyclePhase: (cycleStatus?.phase || 'none') as CyclePhase | 'none',
    capacity: getCapacityState(client),
    completions,
    belief: client.current_belief || undefined,
  })

  const igniteDashboardData = program === 'ignite'
    ? await getIgniteDashboardData({
        supabase,
        client,
        dailyPlan,
        todaysWorkout,
        cycleStatus,
        cycleAdjustment,
        monthlyAssessmentsDueCount,
        insight,
      })
    : null

  const phoenixDashboardData = program === 'phoenix'
    ? await getPhoenixDashboardData({
        supabase,
        user,
        client,
        dailyPlan,
        todaysWorkout,
        phoenixTrackLabel: getPhoenixTrackLabel({ client, programJson }),
      })
    : null

  await Promise.all([
    logRecommendationAudit({
      supabase, userId: user.id, recommendationType: 'daily_insight',
      inputSnapshot: { program, cyclePhase: cycleStatus?.phase || 'none', capacity: getCapacityState(client), completions },
      engineVersion: 'daily_insight_v1.0', recommendationOutput: insight, confidenceLevel: 'rules_based',
    }),
    logRecommendationAudit({
      supabase, userId: user.id, recommendationType: 'adaptive_dashboard',
      inputSnapshot: { program, monthlyAssessmentsDueCount }, engineVersion: 'adaptive_dashboard_v1.0',
      recommendationOutput: adaptiveDashboard, confidenceLevel: 'rules_based',
    }),
  ])

  return (
    <main>
      {program === 'ember' && (
        <EmberDashboard initialData={emberDashboardData!} />
      )}

      {program === 'ignite' && (
        <IgniteDashboard initialData={igniteDashboardData!} />
        )}

        {program === 'phoenix' && (
         <PhoenixDashboard initialData={phoenixDashboardData!} />
        )}
    </main>
  )
}
