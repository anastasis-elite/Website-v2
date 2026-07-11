import { redirect } from 'next/navigation'
import WorkoutTracker from '@/components/WorkoutTracker'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { getProgramWorkout } from '@/lib/program/getProgramWorkout'
import { getDailyExecutionPlan } from '@/lib/day/getDailyExecutionPlan'
import { getCycleStatus } from '@/lib/cycle/getCycleStatus'
import { getProgramLogicEngine } from '@/lib/dashboard/logic/getProgramLogicEngine'
import type { ProgramTier } from '@/lib/dashboard/logic/types'
import { getRecentSafetyFlags } from '@/lib/safety/getRecentSafetyFlags'
import SafetyEscalationNotice from '@/components/legal/SafetyEscalationNotice'
import WorkoutFeedback from '@/components/workout-feedback/WorkoutFeedback'
import { AOSCard } from '@/components/aos-ui/AOSCard'

const supportedPrograms = ['ember', 'ignite', 'phoenix']

export default async function ProgramWorkoutPage({ params }: { params: Promise<{ program: string }> }) {
  const { program: routeProgram } = await params
  if (!supportedPrograms.includes(routeProgram)) redirect('/dashboard')

  const { supabase, client, user } = await getDashboardContext()
  const program = client.program || 'ignite'
  if (program !== routeProgram) redirect(`/dashboard/program/${program}/workout`)

  const { data: output } = await supabase
    .from('program_outputs').select('*')
    .eq('client_id', client.client_id).eq('program', program)
    .order('generated_at', { ascending: false }).limit(1).maybeSingle()
  const safetyFlags = await getRecentSafetyFlags(supabase, client.client_id)

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
  const workoutStateLabel = assignedWorkout?.workout_state === 'starter'
    ? 'Starter Workout'
    : assignedWorkout?.workout_state === 'recovery'
      ? 'Recovery Day'
      : 'Today’s Workout'
  const showInteractiveWorkout =
    Boolean(assignedExercises.length) &&
    logic.workoutDecision.displayWorkout &&
    logic.workoutDecision.canTrain &&
    safetyFlags.length === 0

  return (
    <main className="aos-workout-page">
      <div className="aos-workout-shell">
        <header className="aos-workout-header"><div><p className="aos-eyebrow">{program} · {workoutStateLabel}</p><h1>{assignedWorkout?.day_name || logic.workout.title || workoutStateLabel}</h1><p>{logic.workoutDecision.intensityTarget}. {logic.workoutDecision.reasonForModification}</p></div><WorkoutFeedback clientId={client.client_id} program={program as ProgramTier} assignedWorkoutId={String(assignedWorkout?.id||logic.workout.title)} workoutTitle={assignedWorkout?.day_name||logic.workout.title} workoutHref={`/dashboard/program/${program}/workout`}/></header>
        {safetyFlags.length?<SafetyEscalationNotice flags={safetyFlags} embedded/>:null}
        <div className="aos-workout-guidance"><AOSCard><p className="aos-eyebrow">Fuel first</p><h2>{logic.fuelReadiness.displayStatus}</h2><p>{logic.workoutDecision.preWorkoutFuelPrompt||logic.fuelReadiness.preWorkoutAction}</p></AOSCard><AOSCard><p className="aos-eyebrow">Today&apos;s adjustment</p><h2>{logic.workoutDecision.adjustmentLevel.replaceAll('_',' ')}</h2><p>{logic.workoutDecision.modifications.join(' ')||'Use the planned workout.'}</p></AOSCard></div>
        <section className="aos-workout-tracker-shell">
          {showInteractiveWorkout ? (
            <>
              <WorkoutTracker clientId={client.client_id} authUserId={client.auth_user_id} program={output?.program || program} dayName={assignedWorkout.day_name} exercises={assignedExercises} />
            </>
          ) : <div className="aos-workout-preview"><p className="aos-eyebrow">Plan remains visible</p><h2>{safetyFlags.length || !logic.workoutDecision.canTrain ? 'Safety support first' : 'Recovery movement'}</h2><p>{safetyFlags.length ? 'The assigned plan is listed below, but completion is paused until the safety message is resolved.' : logic.workoutDecision.reasonForModification}</p>{assignedExercises.length?<div>{assignedExercises.map((exercise:any,index:number)=><article key={`${exercise.id||exercise.name||exercise.exercise}-${index}`}><span>{index+1}</span><div><strong>{exercise.display_name||exercise.name||exercise.exercise||'Exercise'}</strong><small>{exercise.duration_label || `${exercise.sets||'—'} sets · ${exercise.recommended_reps||exercise.reps||'—'} reps · ${Math.round(Number(exercise.recommended_weight||exercise.calculated_weight||0))||'Bodyweight'} load`}</small></div></article>)}</div>:null}</div>}
        </section>
      </div>
    </main>
  )
}
