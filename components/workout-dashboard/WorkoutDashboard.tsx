'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'

import WorkoutTracker from '@/components/WorkoutTracker'
import SafetyEscalationNotice from '@/components/legal/SafetyEscalationNotice'
import WorkoutFeedback from '@/components/workout-feedback/WorkoutFeedback'
import MuscleReadinessMap from '@/components/workout-dashboard/MuscleReadinessMap'
import {
  getMuscleIdsForExercise,
  summarizeWorkoutMuscleFocus,
  type MuscleId,
  type MuscleReadiness,
} from '@/lib/workout/muscleReadiness'
import type { ProgramTier, ProgramLogicOutput } from '@/lib/dashboard/logic/types'

type Tab = 'progress' | 'strength' | 'recovery' | 'history'

type AssignedExercise = {
  id?: string | number
  exercise?: string
  name?: string
  display_name?: string
  sets?: number | string
  reps?: number | string
  target_reps?: number
  recommended_reps?: number
  calculated_weight?: number
  recommended_weight?: number
  cycle_adjusted_weight?: number
  baseline_weight?: number
  primary_muscles?: string[]
  secondary_muscles?: string[]
  intended_muscles?: string[]
  rest_seconds?: number
  rpe_target?: string
  duration_label?: string
  [key: string]: unknown
}

type WorkoutLogRow = {
  id?: string
  workout_date?: string
  day_name?: string
  completed?: boolean
  exercise_logs?: AssignedExercise[]
}

type Props = {
  clientId: string
  authUserId: string
  program: ProgramTier
  workoutTitle: string
  workoutStateLabel: string
  assignedWorkoutId: string
  assignedDayName: string
  assignedExercises: AssignedExercise[]
  showInteractiveWorkout: boolean
  hasSafetyFlags: boolean
  safetyFlags: any[]
  previewTitle: string
  previewMessage: string
  logic: ProgramLogicOutput
  outputProgram?: string | null
  muscleReadiness: MuscleReadiness[]
  workoutHistory: WorkoutLogRow[]
  showStrengthAssessmentOffer: boolean
  strengthAssessmentWindowEndDate?: string | null
}

function exerciseName(exercise: AssignedExercise) {
  return String(exercise.display_name || exercise.name || exercise.exercise || 'Exercise')
}

function exerciseDose(exercise: AssignedExercise) {
  if (exercise.duration_label) return exercise.duration_label
  const sets = exercise.sets ?? '-'
  const reps = exercise.recommended_reps ?? exercise.reps ?? exercise.target_reps ?? '-'
  const weight = Number(exercise.recommended_weight ?? exercise.calculated_weight ?? 0)
  return `${sets} sets · ${reps} reps${Number.isFinite(weight) && weight > 0 ? ` · ${Math.round(weight)} lb` : ''}`
}

function titleCaseMuscle(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

function formatAssessmentEnd(date?: string | null) {
  if (!date) return null
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
}

function WorkoutPreview({ exercises, previewTitle, previewMessage }: { exercises: AssignedExercise[]; previewTitle: string; previewMessage: string }) {
  return (
    <div className="aos-workout-preview">
      <p className="tier-dashboard-label">Plan remains visible</p>
      <h2>{previewTitle}</h2>
      <p>{previewMessage}</p>
      {exercises.length ? (
        <div>
          {exercises.map((exercise, index) => (
            <article key={exercise.id ? String(exercise.id) : `${exerciseName(exercise)}-${index}`}>
              <span>{index + 1}</span>
              <div>
                <strong>{exerciseName(exercise)}</strong>
                <small>{exerciseDose(exercise)}</small>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function ProgressTab({ logic, exercises }: { logic: ProgramLogicOutput; exercises: AssignedExercise[] }) {
  const totalSets = exercises.reduce((sum, exercise) => sum + Number(exercise.sets || 0), 0)
  const totalReps = exercises.reduce((sum, exercise) => sum + Number(exercise.recommended_reps ?? exercise.reps ?? 0) * Number(exercise.sets || 1), 0)

  return (
    <div className="workout-tab-grid" data-testid="workout-progress-tab">
      <article><span>Completion</span><strong>{logic.execution.workoutComplete ? 'Complete' : 'Open'}</strong><small>{logic.workout.assigned ? logic.workout.title : 'Recovery movement'}</small></article>
      <article><span>Session Volume</span><strong>{totalSets || '--'} sets</strong><small>{totalReps || '--'} prescribed repetitions</small></article>
      <article><span>Duration</span><strong>{logic.workout.durationMinutes ? `${logic.workout.durationMinutes} min` : 'Not set'}</strong><small>From the current workout source</small></article>
      <article><span>Progression</span><strong>{logic.workoutDecision.allowLoadProgression ? 'Open' : 'Hold'}</strong><small>{logic.workoutDecision.intensityTarget}</small></article>
    </div>
  )
}

function StrengthTab({ showOffer, endDate, logic }: { showOffer: boolean; endDate?: string | null; logic: ProgramLogicOutput }) {
  return (
    <div className="workout-tab-grid" data-testid="workout-strength-tab">
      <article>
        <span>Strength Assessment</span>
        <strong>{showOffer ? 'Window open' : logic.assessments.monthlyDueCount ? 'Due' : 'Current'}</strong>
        <small>{showOffer && formatAssessmentEnd(endDate) ? `Available through ${formatAssessmentEnd(endDate)}` : 'Baselines stay connected to the existing assessment system.'}</small>
        <Link href="/dashboard/assessment/start2" className="tier-secondary-action">Begin Assessment</Link>
      </article>
      <article><span>Load Direction</span><strong>{logic.workoutDecision.allowLoadProgression ? 'Progress allowed' : 'Conservative'}</strong><small>{logic.workoutDecision.reasonForModification}</small></article>
    </div>
  )
}

function RecoveryTab({ readiness, tier }: { readiness: MuscleReadiness[]; tier: ProgramTier }) {
  const rows = readiness
    .filter((item) => item.state !== 'unknown' || item.exercisesToday?.length)
    .slice(0, 8)

  return (
    <div className="workout-recovery-table" data-testid="workout-recovery-tab" data-tier={tier}>
      {rows.length ? rows.map((item) => (
        <article key={item.muscleId}>
          <span>{titleCaseMuscle(item.muscleId)}</span>
          <strong>{item.state === 'unknown' ? 'Not enough data' : titleCaseMuscle(item.state)}</strong>
          <small>{item.reasons?.[0] || 'Tracking will refine as logs build.'}</small>
        </article>
      )) : <p className="tier-calendar-empty">Not enough muscle-specific recovery data yet.</p>}
    </div>
  )
}

function HistoryTab({ history }: { history: WorkoutLogRow[] }) {
  return (
    <div className="workout-history-list" data-testid="workout-history-tab">
      {history.length ? history.slice(0, 8).map((row, index) => (
        <article key={row.id || `${row.workout_date}-${index}`}>
          <time>{row.workout_date ? new Date(row.workout_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Workout'}</time>
          <strong>{row.day_name || 'Completed workout'}</strong>
          <small>{row.completed ? 'Completed' : 'Not completed'} · {(row.exercise_logs || []).length} exercises</small>
        </article>
      )) : <p className="tier-calendar-empty">Workout history will appear after completed sessions.</p>}
    </div>
  )
}

export default function WorkoutDashboard(props: Props) {
  const [tab, setTab] = useState<Tab>('progress')
  const [highlightedMuscles, setHighlightedMuscles] = useState<MuscleId[]>([])
  const focus = useMemo(() => summarizeWorkoutMuscleFocus(props.assignedExercises).slice(0, 3), [props.assignedExercises])

  return (
    <section className="workout-dashboard-workspace" data-tier={props.program}>
      <article className="tier-daily-insight workout-objective" data-testid="workout-objective">
        <p className="tier-dashboard-label">Today&apos;s Training</p>
        <div>
          <h1>{props.workoutTitle}</h1>
          <WorkoutFeedback
            clientId={props.clientId}
            program={props.program}
            assignedWorkoutId={props.assignedWorkoutId}
            workoutTitle={props.workoutTitle}
            workoutHref={`/dashboard/program/${props.program}/workout`}
          />
        </div>
        <p>{props.logic.workoutDecision.intensityTarget}. {props.logic.workoutDecision.reasonForModification}</p>
        {focus.length ? <small>Primary emphasis: {focus.map(titleCaseMuscle).join(' + ')}</small> : null}
      </article>

      {props.hasSafetyFlags ? <SafetyEscalationNotice flags={props.safetyFlags} embedded /> : null}

      <div className="workout-dashboard-row">
        <MuscleReadinessMap readiness={props.muscleReadiness} highlightedMuscleIds={highlightedMuscles} />

        <section className="workout-current-panel" data-testid="today-workout-panel">
          <div className="tier-panel-heading">
            <div>
              <p className="tier-dashboard-label">{props.workoutStateLabel}</p>
              <h2>Today&apos;s Workout</h2>
            </div>
          </div>
          <div className="workout-scroll-region">
            {props.showInteractiveWorkout ? (
              <WorkoutTracker
                clientId={props.clientId}
                authUserId={props.authUserId}
                program={props.outputProgram || props.program}
                dayName={props.assignedDayName}
                exercises={props.assignedExercises}
                onExerciseFocus={(exercise) => setHighlightedMuscles(getMuscleIdsForExercise(exercise))}
                onExerciseBlur={() => setHighlightedMuscles([])}
              />
            ) : (
              <WorkoutPreview exercises={props.assignedExercises} previewTitle={props.previewTitle} previewMessage={props.previewMessage} />
            )}
          </div>
        </section>
      </div>

      <section className="tier-info-panel workout-info-panel" data-testid="workout-toggle-panel">
        <div className="tier-tab-list" role="tablist" aria-label="Workout information">
          {(['progress', 'strength', 'recovery', 'history'] as Tab[]).map((item) => (
            <button key={item} type="button" className={tab === item ? 'is-active' : ''} onClick={() => setTab(item)}>
              {item[0].toUpperCase() + item.slice(1)}
            </button>
          ))}
        </div>
        {tab === 'progress' ? <ProgressTab logic={props.logic} exercises={props.assignedExercises} /> : null}
        {tab === 'strength' ? <StrengthTab showOffer={props.showStrengthAssessmentOffer} endDate={props.strengthAssessmentWindowEndDate} logic={props.logic} /> : null}
        {tab === 'recovery' ? <RecoveryTab readiness={props.muscleReadiness} tier={props.program} /> : null}
        {tab === 'history' ? <HistoryTab history={props.workoutHistory} /> : null}
      </section>
    </section>
  )
}
