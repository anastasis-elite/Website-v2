// app/program/[program]/page.tsx

import EmberDashboard from '@/components/program-dashboard/EmberDashboard'
import IgniteDashboard from '@/components/program-dashboard/IgniteDashboard'
import PhoenixDashboard from '@/components/program-dashboard/PhoenixDashboard'

export default async function ProgramPage({
  params,
}: {
  params: { program: string }
}) {
  const program = params.program

  const client = {
    client_id: '',
    auth_user_id: '',
    full_name: '',
    program,
  }

  const lesson = null
  const l
  const adjustedExercises: any[] = []

  const cycleAdjustment = {
    label: 'Baseline',
    note: 'Today is being kept simple while your system calibrates.',
  }

  const phoenixTrackLabel = 'Personalized'

  return (
    <main>
      {program === 'ember' && (
        <EmberDashboard client={client} lesson={lesson} />
      )}

      {program === 'ignite' && (
        <IgniteDashboard 
          client={client} 
          dailyPlan={dailyPlan}
          cycleStatus={cycleStatus}
          assessmentDueCount={monthlyAssessmentDueCount}
          insight={insight}
        />
      )}

      {program === 'phoenix' && (
        <PhoenixDashboard
          client={client}
          todaysWorkout={todaysWorkout}
          adjustedExercises={adjustedExercises}
          cycleAdjustment={cycleAdjustment}
          phoenixTrackLabel={phoenixTrackLabel}
        />
      )}

      {!['ember', 'ignite', 'phoenix'].includes(program) && (
        <p>Program not found.</p>
      )}
    </main>
  )
}
