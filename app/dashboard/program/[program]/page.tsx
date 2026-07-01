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
  const monthlyCheckInDue = !monthlyAssessment

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

  const { programJson, todaysWorkout, cycleAdjustment, adjustedExercises } =
    getProgramWorkout({ client, output })

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

  return (
    <main>
      {program === 'ember' && (
        <EmberDashboard
          client={client}
          dailyPlan={dailyPlan}
          insight={insight}
          todaysWorkout={todaysWorkout}
          adjustedExercises={adjustedExercises}
          output={output}
          cycleAdjustment={cycleAdjustment}
        />
      )}

      {program === 'ignite' && (
        <IgniteDashboard
          client={client}
          dailyPlan={dailyPlan}
          cycleStatus={cycleStatus}
          assessmentDueCount={monthlyAssessmentsDueCount}
          monthlyCheckInDue={monthlyCheckInDue}
          adaptiveDashboard={adaptiveDashboard}
          insight={insight}
          todaysWorkout={todaysWorkout}
          adjustedExercises={adjustedExercises}
          output={output}
          cycleAdjustment={cycleAdjustment}
        />
        )}

        {program === 'phoenix' && (
         <PhoenixDashboard
           client={client}
           dailyPlan={dailyPlan}
           insight={insight}
           todaysWorkout={todaysWorkout}
           adjustedExercises={adjustedExercises}
           cycleAdjustment={cycleAdjustment}
           phoenixTrackLabel={getPhoenixTrackLabel({ client, programJson })}
         />
        )}
    </main>
  )
}
