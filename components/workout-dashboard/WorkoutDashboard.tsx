'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

import WorkoutTracker from '@/components/WorkoutTracker'
import SafetyEscalationNotice from '@/components/legal/SafetyEscalationNotice'
import WorkoutFeedback from '@/components/workout-feedback/WorkoutFeedback'
import ManualWorkoutBuilder from '@/components/workout-dashboard/ManualWorkoutBuilder'
import MuscleReadinessMap from '@/components/workout-dashboard/MuscleReadinessMap'
import {
  getMuscleIdsForExercise,
  summarizeWorkoutMuscleFocus,
  type MuscleId,
  type MuscleReadiness,
} from '@/lib/workout/muscleReadiness'
import type { ProgramTier, ProgramLogicOutput } from '@/lib/dashboard/logic/types'
import { getDailyTraining } from '@/lib/dashboard/dailyTraining'
import { activityDose, summarizeActivityUnits } from '@/lib/workout/activity'
import { exerciseOccurrenceLabel, formatWorkoutHistoryDate } from '@/lib/workout/logging'
import { parseWorkoutViewPreferences } from '@/lib/workout/viewPreferences'

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
  workout_started_at?: string | null
  day_name?: string
  completed?: boolean
  workout_source?: 'recommended' | 'manual'
  planned_exercises?: AssignedExercise[]
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
  timezone?: string
  weightUnit?: 'lb' | 'kg'
  memberEquipment: string[]
  showStrengthAssessmentOffer: boolean
  strengthAssessmentWindowEndDate?: string | null
}

function exerciseName(exercise: AssignedExercise) {
  return String(exercise.display_name || exercise.name || exercise.exercise || 'Exercise')
}

function exerciseDose(exercise: AssignedExercise) {
  if (exercise.duration_label) return exercise.duration_label
  const dose = activityDose(exercise)
  if (dose.metric === 'completion') return 'Complete the movement comfortably'
  return `${dose.kind === 'strength' ? `${dose.sets} sets · ` : ''}${dose.prescribed || 'Choose a comfortable amount'} ${dose.metric}${dose.weight > 0 ? ` · ${dose.weight} ${dose.unit}` : ''}`
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
            <article key={`${exercise.id || exerciseName(exercise)}:${index}`}>
              <span>{index + 1}</span>
              <div>
                <strong>{exerciseOccurrenceLabel(exercises, index)}</strong>
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
  const totals = summarizeActivityUnits(exercises)

  return (
    <div className="workout-tab-grid" data-testid="workout-progress-tab">
      <article><span>Completion</span><strong>{logic.execution.workoutComplete ? 'Complete' : 'Open'}</strong><small>{logic.workout.assigned ? logic.workout.title : 'Recovery movement'}</small></article>
      <article><span>Planned Strength</span><strong>{totals.sets} sets</strong><small>{totals.reps} prescribed repetitions</small></article>
      <article><span>Planned Activity</span><strong>{Math.round(totals.minutes * 10) / 10} min · {totals.breaths} breaths</strong><small>{totals.activities} completion-based movement{totals.activities === 1 ? '' : 's'}</small></article>
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
        <small>{showOffer && formatAssessmentEnd(endDate) ? `Available through ${formatAssessmentEnd(endDate)}` : 'Review or update your recorded strength baselines.'}</small>
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

function HistoryTab({ history, timezone }: { history: WorkoutLogRow[]; timezone?: string }) {
  return (
    <div className="workout-history-list" data-testid="workout-history-tab">
      {history.length ? history.slice(0, 8).map((row, index) => (
        <article key={row.id || `${row.workout_date}-${index}`}>
          <time>{formatWorkoutHistoryDate(row.workout_started_at || row.workout_date, timezone)}</time>
          <strong>{row.day_name || 'Completed workout'}</strong>
          <small>{row.completed ? 'Completed' : 'Not completed'} · {row.workout_source || 'recommended'} · {(row.exercise_logs || []).length} logged exercises</small>
        </article>
      )) : <p className="tier-calendar-empty">Your saved workout sessions will appear here.</p>}
    </div>
  )
}

export default function WorkoutDashboard(props: Props) {
  const [tab, setTab] = useState<Tab>('progress')
  const [workoutMode, setWorkoutMode] = useState<'recommended' | 'manual'>('recommended')
  const [restoredPreferenceKey, setRestoredPreferenceKey] = useState<string | null>(null)
  const [highlightedMuscles, setHighlightedMuscles] = useState<MuscleId[]>([])
  const preferenceKey = `aos-workout-view:v1:${props.clientId}:${props.program}`
  useEffect(() => {
    let stored = null
    try { stored = localStorage.getItem(preferenceKey) } catch { /* The workout remains available without browser preferences. */ }
    const preferences = parseWorkoutViewPreferences(stored)
    setTab(preferences.tab); setWorkoutMode(preferences.mode); setRestoredPreferenceKey(preferenceKey)
  }, [preferenceKey])
  useEffect(() => {
    if (restoredPreferenceKey !== preferenceKey) return
    try { localStorage.setItem(preferenceKey, JSON.stringify({ tab, mode: workoutMode })) } catch { /* Browser preferences are optional. */ }
  }, [preferenceKey, restoredPreferenceKey, tab, workoutMode])
  const training = getDailyTraining(props.logic)
  const focus = useMemo(() => summarizeWorkoutMuscleFocus(props.assignedExercises).slice(0, 3), [props.assignedExercises])

  return (
    <section className="workout-dashboard-workspace" data-tier={props.program}>
      <article className="tier-daily-insight workout-objective" data-testid="workout-objective">
        <p className="tier-dashboard-label">{training.label}</p>
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
        <p>{training.readinessNote}</p>
        {focus.length ? <small>Primary emphasis: {focus.map(titleCaseMuscle).join(' + ')}</small> : null}
      </article>

      {props.hasSafetyFlags ? <SafetyEscalationNotice flags={props.safetyFlags} embedded /> : null}

      <div className="workout-dashboard-row">
        <details className="daily-disclosure"><summary>Muscle readiness details</summary><MuscleReadinessMap readiness={props.muscleReadiness} highlightedMuscleIds={highlightedMuscles} /></details>

        <section className="workout-current-panel" data-testid="today-workout-panel">
          <div className="tier-panel-heading">
            <div>
              <p className="tier-dashboard-label">{props.workoutStateLabel}</p>
              <h2>Today&apos;s Workout</h2>
            </div>
            <div className="workout-mode-switch" role="tablist" aria-label="Workout mode">
              {(['recommended', 'manual'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  role="tab"
                  aria-selected={workoutMode === mode}
                  className={workoutMode === mode ? 'is-active' : ''}
                  onClick={() => setWorkoutMode(mode)}
                >
                  {mode === 'recommended' ? 'Recommended' : 'Manual'}
                </button>
              ))}
            </div>
          </div>
          <div className="workout-session-region">
            {workoutMode === 'manual' ? (
              <ManualWorkoutBuilder
                clientId={props.clientId}
                authUserId={props.authUserId}
                program={props.outputProgram || props.program}
                timezone={props.timezone}
                weightUnit={props.weightUnit}
                recommendedDayName={props.assignedDayName}
                recommendedExercises={props.assignedExercises}
                memberEquipment={props.memberEquipment}
                readiness={props.muscleReadiness}
                onExerciseFocus={setHighlightedMuscles}
                onExerciseBlur={() => setHighlightedMuscles([])}
              />
            ) : props.showInteractiveWorkout ? (
              <WorkoutTracker
                timezone={props.timezone}
                weightUnit={props.weightUnit}
                clientId={props.clientId}
                authUserId={props.authUserId}
                program={props.outputProgram || props.program}
                dayName={props.assignedDayName}
                workoutSource="recommended"
                plannedExercises={props.assignedExercises}
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
            <button key={item} id={`workout-tab-${item}`} type="button" role="tab" aria-selected={tab === item} aria-controls="workout-information-panel" className={tab === item ? 'is-active' : ''} onClick={() => setTab(item)}>
              {item[0].toUpperCase() + item.slice(1)}
            </button>
          ))}
        </div>
        <div id="workout-information-panel" role="tabpanel" aria-labelledby={`workout-tab-${tab}`}>
        {tab === 'progress' ? <ProgressTab logic={props.logic} exercises={props.assignedExercises} /> : null}
        {tab === 'strength' ? <StrengthTab showOffer={props.showStrengthAssessmentOffer} endDate={props.strengthAssessmentWindowEndDate} logic={props.logic} /> : null}
        {tab === 'recovery' ? <RecoveryTab readiness={props.muscleReadiness} tier={props.program} /> : null}
        {tab === 'history' ? <HistoryTab history={props.workoutHistory} timezone={props.timezone} /> : null}
        </div>
      </section>
    </section>
  )
}
