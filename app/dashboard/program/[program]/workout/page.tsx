import { redirect } from 'next/navigation'

import WorkoutDashboard from '@/components/workout-dashboard/WorkoutDashboard'

import { getAssessmentWindow } from '@/lib/assessments/getAssessmentWindow'
import { getCycleStatus } from '@/lib/cycle/getCycleStatus'
import { getDailyExecutionPlan } from '@/lib/day/getDailyExecutionPlan'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { getProgramLogicEngine } from '@/lib/dashboard/logic/getProgramLogicEngine'
import type { ProgramTier } from '@/lib/dashboard/logic/types'
import { getProgramWorkout } from '@/lib/program/getProgramWorkout'
import { getRecentSafetyFlags } from '@/lib/safety/getRecentSafetyFlags'
import { buildMuscleReadiness } from '@/lib/workout/muscleReadiness'

const SUPPORTED_PROGRAMS: ProgramTier[] = [
  'ember',
  'ignite',
  'phoenix',
]

type ProgramWorkoutPageProps = {
  params: Promise<{
    program: string
  }>
}

type AssignedExercise = {
  id?: string | number
  exercise?: string
  name?: string
  display_name?: string

  sets?: number | string

  reps?: number | string
  target_reps?: number
  recommended_reps?: number
  cycle_adjusted_reps?: number
  baseline_reps?: number

  calculated_weight?: number
  recommended_weight?: number
  cycle_adjusted_weight?: number
  baseline_weight?: number

  selected_variant_id?: string
  selected_variant_name?: string
  selected_equipment?: string
  load_type?: string
  primary_muscles?: string[]
  secondary_muscles?: string[]
  intended_muscles?: string[]
  compensatory_muscles?: string[]

  available_variants?: Array<{
    id: string
    name: string
    equipment: string
    load_type: string
    equipment_modifier: number
  }>

  cycle_adjustment_label?: string
  cycle_adjustment_note?: string
  cycle_caution_active?: boolean
  client_cues?: string[]
  rest_seconds?: number
  rpe_target?: string
  duration_label?: string
}

function isSupportedProgram(
  program: string,
): program is ProgramTier {
  return SUPPORTED_PROGRAMS.includes(
    program as ProgramTier,
  )
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

function getAssessmentWindowStart(
  date: string,
): string {
  return `${date}T00:00:00.000Z`
}

function getAssessmentWindowEnd(
  date: string,
): string {
  return `${date}T23:59:59.999Z`
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

  const clientProgram = (
    client.program || 'ignite'
  ) as ProgramTier

  if (!isSupportedProgram(clientProgram)) {
    redirect('/dashboard')
  }

  if (clientProgram !== routeProgram) {
    redirect(
      `/dashboard/program/${clientProgram}/workout`,
    )
  }

  const strengthAssessmentWindow =
    getAssessmentWindow(client)

  const strengthWindowStart =
    strengthAssessmentWindow.estimatedStartDate
      ? getAssessmentWindowStart(
          strengthAssessmentWindow.estimatedStartDate,
        )
      : null

  const strengthWindowEnd =
    strengthAssessmentWindow.estimatedEndDate
      ? getAssessmentWindowEnd(
          strengthAssessmentWindow.estimatedEndDate,
        )
      : null

  const [
    outputResult,
    safetyFlags,
    dailyPlan,
    strengthAssessmentResult,
    workoutHistoryResult,
    recoverySignalsResult,
  ] = await Promise.all([
    supabase
      .from('program_outputs')
      .select('*')
      .eq('client_id', client.client_id)
      .eq('program', clientProgram)
      .order('generated_at', {
        ascending: false,
      })
      .limit(1)
      .maybeSingle(),

    getRecentSafetyFlags(
      supabase,
      client.client_id,
    ),

    getDailyExecutionPlan({
      supabase,
      client,
    }),

    strengthAssessmentWindow.isOpen &&
    strengthWindowStart &&
    strengthWindowEnd
      ? supabase
          .from('assessments')
          .select('id, submitted_at')
          .eq('client_id', client.client_id)
          .eq(
            'assessment_type',
            'strength',
          )
          .gte(
            'submitted_at',
            strengthWindowStart,
          )
          .lte(
            'submitted_at',
            strengthWindowEnd,
          )
          .order('submitted_at', {
            ascending: false,
          })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({
          data: null,
          error: null,
        }),

    supabase
      .from('workout_logs')
      .select(
        'id,workout_date,day_name,completed,exercise_logs',
      )
      .eq('client_id', client.client_id)
      .order('workout_date', {
        ascending: false,
      })
      .limit(30),

    supabase
      .from('recovery_logs')
      .select(
        'log_date,soreness_level,soreness_regions,check_in_completed_at',
      )
      .eq('client_id', client.client_id)
      .order('log_date', {
        ascending: false,
      })
      .limit(7),
  ])

  const output = outputResult.data

  const strengthAssessmentCompletedThisWindow =
    Boolean(strengthAssessmentResult.data)

  const showStrengthAssessmentOffer =
    strengthAssessmentWindow.isOpen &&
    !strengthAssessmentCompletedThisWindow

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
    (assignedWorkout?.exercises ??
      []) as AssignedExercise[]

  const workoutStateLabel =
    getWorkoutStateLabel(
      assignedWorkout?.workout_state,
    )

  const workoutTitle =
    assignedWorkout?.day_name ||
    logic.workout.title ||
    workoutStateLabel

  const hasSafetyFlags =
    safetyFlags.length > 0

  const hasAssignedExercises =
    assignedExercises.length > 0

  const showInteractiveWorkout =
    hasAssignedExercises &&
    logic.workoutDecision.displayWorkout &&
    logic.workoutDecision.canTrain &&
    !hasSafetyFlags

  const previewTitle =
    hasSafetyFlags ||
    !logic.workoutDecision.canTrain
      ? 'Safety support first'
      : 'Recovery movement'

  const previewMessage = hasSafetyFlags
    ? 'The assigned plan is listed below, but completion is paused until the safety message is resolved.'
    : logic.workoutDecision
        .reasonForModification

  const workoutHistory =
    workoutHistoryResult.data || []

  const recoverySignals =
    recoverySignalsResult.data || []

  const muscleReadiness =
    buildMuscleReadiness({
      tier: clientProgram,
      todaysExercises: assignedExercises,
      workoutHistory,
      recoverySignals,
    })

  return (
    <main className="aos-workout-page">
      <div className="aos-workout-shell">
        <WorkoutDashboard
          clientId={client.client_id}
          authUserId={client.auth_user_id}
          program={clientProgram}
          workoutTitle={workoutTitle}
          workoutStateLabel={workoutStateLabel}
          assignedWorkoutId={String(
            assignedWorkout?.id ||
              logic.workout.title,
          )}
          assignedDayName={
            assignedWorkout?.day_name ||
            workoutTitle
          }
          assignedExercises={assignedExercises}
          showInteractiveWorkout={
            showInteractiveWorkout
          }
          hasSafetyFlags={hasSafetyFlags}
          safetyFlags={safetyFlags}
          previewTitle={previewTitle}
          previewMessage={previewMessage}
          logic={logic}
          outputProgram={output?.program}
          muscleReadiness={muscleReadiness}
          workoutHistory={workoutHistory}
          showStrengthAssessmentOffer={
            showStrengthAssessmentOffer
          }
          strengthAssessmentWindowEndDate={
            strengthAssessmentWindow.estimatedEndDate
          }
        />
      </div>
    </main>
  )
}
