import { redirect } from 'next/navigation'
import Link from 'next/link'
import * as styles from '@/app/styles/globalstyles'
import WorkoutTracker from '@/components/WorkoutTracker'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { getProgramWorkout } from '@/lib/program/getProgramWorkout'
import { getDailyExecutionPlan } from '@/lib/day/getDailyExecutionPlan'
import { getCycleStatus } from '@/lib/cycle/getCycleStatus'
import { getProgramLogicEngine } from '@/lib/dashboard/logic/getProgramLogicEngine'
import type { ProgramTier } from '@/lib/dashboard/logic/types'
import { getRecentSafetyFlags } from '@/lib/safety/getRecentSafetyFlags'
import SafetyEscalationNotice from '@/components/legal/SafetyEscalationNotice'

const supportedPrograms = ['ember', 'ignite', 'phoenix']

export default async function ProgramWorkoutPage({ params }: { params: { program: string } }) {
  if (!supportedPrograms.includes(params.program)) redirect('/dashboard')

  const { supabase, client, user } = await getDashboardContext()
  const program = client.program || 'ignite'
  if (program !== params.program) redirect(`/dashboard/program/${program}/workout`)

  const { data: output } = await supabase
    .from('program_outputs').select('*')
    .eq('client_id', client.client_id).eq('program', program)
    .order('generated_at', { ascending: false }).limit(1).maybeSingle()
  const safetyFlags = await getRecentSafetyFlags(supabase, client.client_id)
  if (safetyFlags.length) return <SafetyEscalationNotice flags={safetyFlags} />

  const dailyPlan = await getDailyExecutionPlan({ supabase, client })
  const cycleStatus = getCycleStatus(client)
  const { todaysWorkout, adjustedExercises, cycleAdjustment } = getProgramWorkout({ client, output })
  const logic = await getProgramLogicEngine({
    supabase, user, client, program: program as ProgramTier, dailyPlan,
    cycleStatus, cycleAdjustment, plannedWorkout: todaysWorkout,
    plannedExercises: adjustedExercises, monthlyAssessmentsDueCount: 0,
  })
  const assignedWorkout = logic.workoutDecision.assignedWorkout
  const assignedExercises = assignedWorkout?.exercises || []

  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>{program} · Today’s Workout</p>
        <h1 style={styles.heroTitleStyle}>{assignedWorkout ? assignedWorkout.day_name : logic.workout.title}</h1>
        <p style={styles.heroTextStyle}>{logic.workoutDecision.intensityTarget}. {logic.workoutDecision.reasonForModification}</p>
        <section style={styles.cartBoxStyle}>
          {assignedWorkout && assignedExercises.length ? (
            <>
              {logic.workoutDecision.preWorkoutFuelPrompt ? <p style={styles.bodyStyle}>{logic.workoutDecision.preWorkoutFuelPrompt}</p> : null}
              <WorkoutTracker clientId={client.client_id} authUserId={client.auth_user_id} program={output?.program || program} dayName={assignedWorkout.day_name} exercises={assignedExercises} />
            </>
          ) : <p style={styles.bodyStyle}>{logic.workoutDecision.reasonForModification}</p>}
        </section>
        <Link href={`/dashboard/program/${program}`} style={styles.secondaryButtonStyle}>Back to Dashboard</Link>
      </div>
    </main>
  )
}
