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

  // keep whatever client/lesson logic already exists here
  const client = null
  const lesson = null

  return (
    <main>
      {program === 'ember' && (
        <EmberDashboard client={client} lesson={lesson} />
      )}

      {program === 'ignite' && (
        <IgniteDashboard client={client} lesson={lesson} />
      )}

      {program === 'phoenix' && (
  <PhoenixDashboard
    client={client}
    output={output}
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
