import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const dashboard = readFileSync('components/workout-dashboard/WorkoutDashboard.tsx', 'utf8')
const builder = readFileSync('components/workout-dashboard/ManualWorkoutBuilder.tsx', 'utf8')
const tracker = readFileSync('components/WorkoutTracker.tsx', 'utf8')
const api = readFileSync('app/api/workout-log/route.ts', 'utf8')
const setApi = readFileSync('app/api/workout-set-log/route.ts', 'utf8')
const manualLibrary = readFileSync('lib/workout/manualWorkout.ts', 'utf8')
const readiness = readFileSync('lib/workout/muscleReadiness.ts', 'utf8')
const migration = readFileSync('supabase/migrations/20260915_manual_workout_source_and_planned_exercises.sql', 'utf8')
const setMigration = readFileSync('supabase/migrations/20260918_manual_workout_exercise_sessions_and_sets.sql', 'utf8')

test('recommended remains the default and manual is a secondary selectable mode', () => {
  assert.match(dashboard, /useState<'recommended' \| 'manual'>\('recommended'\)/)
  assert.match(dashboard, /className="workout-mode-switch"/)
  assert.match(dashboard, /Recommended/)
  assert.match(dashboard, /Manual/)
  assert.match(dashboard, /workoutMode === 'manual'/)
})

test('switching to manual preserves the recommended workout snapshot', () => {
  assert.match(dashboard, /recommendedExercises=\{props\.assignedExercises\}/)
  assert.match(builder, /Plan preserved/)
  assert.match(builder, /plannedExercises=\{recommendedExercises\}/)
})

test('manual builder starts from the live readiness map and derives no-dead-end filters', () => {
  assert.match(builder, /MuscleReadinessMap/)
  assert.match(builder, /onSelectMuscle=\{chooseRegion\}/)
  assert.match(builder, /getAvailableEquipmentForMuscles/)
  assert.match(builder, /getAvailableMovementFamilies/)
  assert.match(builder, /data-testid="manual-equipment-filter"/)
  assert.match(builder, /data-testid="manual-movement-filter"/)
  assert.doesNotMatch(builder, /equipment_access/)
  assert.match(manualLibrary, /filterManualExercises/)
  assert.match(manualLibrary, /movementFamily/)
  assert.match(manualLibrary, /muscles\.some/)
  assert.match(manualLibrary, /equipmentMatches/)
})

test('manual flow opens exercise logging and supports multi-exercise sessions', () => {
  assert.match(builder, /data-testid="manual-exercise-results"/)
  assert.match(builder, /chooseExercise/)
  assert.match(builder, /onManualExerciseFinished=\{finishExercise\}/)
  assert.match(builder, /Add another exercise/)
  assert.match(builder, /Finish workout/)
  assert.match(builder, /data-testid="manual-workout-list"/)
})

test('primary and secondary muscle metadata remains intact for manual exercises', () => {
  assert.match(manualLibrary, /primary_muscles: primary \? \[primary\] : \[\]/)
  assert.match(manualLibrary, /secondary_muscles: secondary/)
  assert.match(manualLibrary, /intended_muscles: muscles/)
})

test('manual and recommended workouts use one tracker and source-aware workout log route', () => {
  assert.match(dashboard, /workoutSource="recommended"/)
  assert.match(builder, /workoutSource="manual"/)
  assert.match(tracker, /workoutSource\?: 'recommended' \| 'manual'/)
  assert.match(tracker, /workoutSource = 'recommended'/)
  assert.match(tracker, /planned_exercises/)
  assert.match(api, /workout_source === 'manual' \? 'manual' : 'recommended'/)
  assert.match(migration, /workout_source text not null default 'recommended'/)
  assert.match(migration, /planned_exercises jsonb not null default/)
})

test('manual exercise execution persists individual set records with timestamps', () => {
  assert.match(tracker, /type ManualSetLog/)
  assert.match(tracker, /set_started_at/)
  assert.match(tracker, /completed_at/)
  assert.match(tracker, /Set Done/)
  assert.match(tracker, /Finish Exercise/)
  assert.match(tracker, /deleteSet/)
  assert.match(setApi, /\.from\('workout_exercise_sessions'\)/)
  assert.match(setApi, /\.from\('workout_exercise_sets'\)/)
  assert.match(setApi, /\.from\('workout_logs'\)/)
  assert.match(setMigration, /create table if not exists public\.workout_exercise_sessions/)
  assert.match(setMigration, /create table if not exists public\.workout_exercise_sets/)
})

test('performed work outranks planned work for recovery and partial completions', () => {
  assert.match(tracker, /logs\.filter\(\(log\) => log\.completed\)/)
  assert.match(tracker, /completedLogs\.length > 0/)
  assert.doesNotMatch(tracker, /logs\.map\(\(log\) => \(\{\s+\.\.\.log,\s+completed: true/s)
  assert.match(readiness, /exercise\.completed !== false/)
  assert.match(readiness, /actual_reps \?\? exercise\.recommended_reps/)
})
