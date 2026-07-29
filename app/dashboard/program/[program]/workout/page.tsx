import { redirect } from 'next/navigation'

import WorkoutTracker from '@/components/WorkoutTracker'
import { AOSCard } from '@/components/aos-ui/AOSCard'
import SafetyEscalationNotice from '@/components/legal/SafetyEscalationNotice'
import WorkoutFeedback from '@/components/workout-feedback/WorkoutFeedback'

import { getCycleStatus } from '@/lib/cycle/getCycleStatus'
import { getDailyExecutionPlan } from '@/lib/day/getDailyExecutionPlan'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { getProgramLogicEngine } from '@/lib/dashboard/logic/getProgramLogicEngine'
import type { ProgramTier } from '@/lib/dashboard/logic/types'
import { getProgramWorkout } from '@/lib/program/getProgramWorkout'
import { getRecentSafetyFlags } from '@/lib/safety/getRecentSafetyFlags'

const SUPPORTED_PROGRAMS: ProgramTier[] = ['ember', 'ignite', 'phoenix']

type ProgramWorkoutPageProps = {
  params: Promise<{
    program: string
  }>
}

type AssignedExercise = {
  id?: string | number | null
  name?: string | null
  exercise?: string | null
  display_name?: string | null
  duration_label?: string | null
  sets?: number | string | null
  reps?: number | string | null
  recommended_reps?: number | string | null
  recommended_weight?: number | string | null
  calculated_weight?: number | string | null
}

function isSupportedProgram(program: string): program is ProgramTier {
  return SUPPORTED_PROGRAMS.includes(program as ProgramTier)
}

function getWorkoutStateLabel(
  workoutState?: string | null,
): string {
  if (workoutState === 'starter') {
    return 'Starter Workout'
  }

  if (workoutState === 'recovery') {
    return 'Recovery Day'
  }

  return 'Today’s Workout'
}

function getExerciseName(exercise: AssignedExercise): string {
  return (
    exercise.display_name ||
    exercise.name ||
    exercise.exercise ||
    'Exercise'
  )
}

function getExerciseLoadLabel(exercise: AssignedExercise): string {
  if (exercise.duration_label) {
    return exercise.duration_label
  }

  const sets = exercise.sets ?? '—'
  const reps =
    exercise.recommended_reps ??
    exercise.reps ??
    '—'

  const rawWeight =
    exercise.recommended_weight ??
    exercise.calculated_weight ??
    0

  const numericWeight = Number(rawWeight)
  const load =
    Number.isFinite(numericWeight) && numericWeight > 0
      ? `${Math.round(numericWeight)} load`
      : 'Bodyweight'

  return `${sets} sets · ${reps} reps · ${load}`
}

export default async function ProgramWorkoutPage({
  params,
}: ProgramWorkoutPageProps) {
  const { program: routeProgram } = await params

  if (!isSupportedProgram(routeProgram)) {
    redirect('/dashboard')
  }

  const { supabase, client, user } =
    await getDashboardContext()

  const clientProgram = (client.program || 'ignite') as ProgramTier

  if (!isSupportedProgram(clientProgram)) {
    redirect('/dashboard')
  }

  if (clientProgram !== routeProgram) {
    redirect(`/dashboard/program/${clientProgram}/workout`)
  }

  const { data: output } = await supabase
    .from('program_outputs')
    .select('*')
    .eq('client_id', client.client_id)
    .eq('program', clientProgram)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const [
    safetyFlags,
    dailyPlan,
  ] = await Promise.all([
    getRecentSafetyFlags(
      supabase,
      client.client_id,
    ),
    getDailyExecutionPlan({
      supabase,
      client,
    }),
  ])

  const cycleStatus = getCycleStatus(client)

  const {
    todaysWorkout,
    adjustedExercises,
    cycleAdjustment,
  } = getProgramWorkout({
    client,
    output,
  })

  const logic = await getProgramLogicEngine({
    supabase,
    user,
    client,
    program: clientProgram,
    dailyPlan,
    cycleStatus,
    cycleAdjustment,
    plannedWorkout: todaysWorkout,
    plannedExercises: adjustedExercises,
    monthlyAssessmentsDueCount: 0,
  })

  const assignedWorkout =
    logic.workoutDecision.assignedWorkout

  const assignedExercises =
    (assignedWorkout?.exercises ?? []) as AssignedExercise[]

  const workoutStateLabel = getWorkoutStateLabel(
    assignedWorkout?.workout_state,
  )

  const workoutTitle =
    assignedWorkout?.day_name ||
    logic.workout.title ||
    workoutStateLabel

  const hasSafetyFlags = safetyFlags.length > 0
  const hasAssignedExercises = assignedExercises.length > 0

  const showInteractiveWorkout =
    hasAssignedExercises &&
    logic.workoutDecision.displayWorkout &&
    logic.workoutDecision.canTrain &&
    !hasSafetyFlags

  const previewTitle =
    hasSafetyFlags || !logic.workoutDecision.canTrain
      ? 'Safety support first'
      : 'Recovery movement'

  const previewMessage = hasSafetyFlags
    ? 'The assigned plan is listed below, but completion is paused until the safety message is resolved.'
    : logic.workoutDecision.reasonForModification

  return (
    <main className="aos-workout-page">
      <div className="aos-workout-shell">
        <header className="aos-workout-header">
          <div>
            <p className="aos-eyebrow">
              {clientProgram} · {workoutStateLabel}
            </p>

            <h1>{workoutTitle}</h1>

            <p>
              {logic.workoutDecision.intensityTarget}.{' '}
              {logic.workoutDecision.reasonForModification}
            </p>
          </div>

          <WorkoutFeedback
            clientId={client.client_id}
            program={clientProgram}
            assignedWorkoutId={String(
              assignedWorkout?.id ||
                logic.workout.title,
            )}
            workoutTitle={workoutTitle}
            workoutHref={`/dashboard/program/${clientProgram}/workout`}
          />
        </header>

        {hasSafetyFlags ? (
          <SafetyEscalationNotice
            flags={safetyFlags}
            embedded
          />
        ) : null}

        <div className="aos-workout-guidance">
          <AOSCard>
            <p className="aos-eyebrow">
              Fuel first
            </p>

            <h2>
              {logic.fuelReadiness.displayStatus}
            </h2>

            <p>
              {logic.workoutDecision
                .preWorkoutFuelPrompt ||
                logic.fuelReadiness
                  .preWorkoutAction}
            </p>
          </AOSCard>

          <AOSCard>
            <p className="aos-eyebrow">
              Today&apos;s adjustment
            </p>

            <h2>
              {logic.workoutDecision.adjustmentLevel.replaceAll(
                '_',
                ' ',
              )}
            </h2>

            <p>
              {logic.workoutDecision.modifications.join(
                ' ',
              ) || 'Use the planned workout.'}
            </p>
          </AOSCard>
        </div>

        <section className="aos-workout-tracker-shell">
          {showInteractiveWorkout ? (
            <WorkoutTracker
              clientId={client.client_id}
              authUserId={client.auth_user_id}
              program={output?.program || clientProgram}
              dayName={
                assignedWorkout?.day_name ||
                workoutTitle
              }
              exercises={assignedExercises}
            />
          ) : (
            <div className="aos-workout-preview">
              <p className="aos-eyebrow">
                Plan remains visible
              </p>

              <h2>{previewTitle}</h2>

              <p>{previewMessage}</p>

              {hasAssignedExercises ? (
                <div>
                  {assignedExercises.map(
                    (exercise, index) => {
                      const exerciseName =
                        getExerciseName(exercise)

                      return (
                        <article
                          key={
                            exercise.id
                              ? String(exercise.id)
                              : `${exerciseName}-${index}`
                          }
                        >
                          <span>{index + 1}</span>

                          <div>
                            <strong>
                              {exerciseName}
                            </strong>

                            <small>
                              {getExerciseLoadLabel(
                                exercise,
                              )}
                            </small>
                          </div>
                        </article>
                      )
                    },
                  )}
                </div>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
