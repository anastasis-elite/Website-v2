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
  const adjustedExercises: any[] = []
  const dailyPlan = {
  workoutCompleted: false,
  nutritionLogged: false,
  recoveryTools: {
    primaryTool: 'Breathwork',
  },
  cards: [],
  currentCard: null,
}

const cycleStatus = {
  enabled: true,
  cycleDay: 21,
  phase: 'luteal',
  label: 'Luteal Phase',
  recoveryCaution: true,
  recoveryNote: 'Recovery may need more support today.',
}

const monthlyAssessmentDueCount = 0

const insight = {
  observation: 'Your system is showing a lower-capacity signal today.',
  meaning:
    'This does not mean you are behind. It means today needs precision instead of pressure.',
  identityShift:
    'You are not proving discipline by overriding your body. You are building trust by responding to it.',
  beliefChallenge:
    'Doing less strategically is not the same as giving up.',
  nextStep:
    'Complete the smallest effective version of today’s workout, then log one full meal.',
}

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
