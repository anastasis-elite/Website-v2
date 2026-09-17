import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const dashboard = readFileSync('components/workout-dashboard/WorkoutDashboard.tsx', 'utf8')
const builder = readFileSync('components/workout-dashboard/ManualWorkoutBuilder.tsx', 'utf8')
const tracker = readFileSync('components/WorkoutTracker.tsx', 'utf8')
const api = readFileSync('app/api/workout-log/route.ts', 'utf8')
const manualLibrary = readFileSync('lib/workout/manualWorkout.ts', 'utf8')
const readiness = readFileSync('lib/workout/muscleReadiness.ts', 'utf8')
const migration = readFileSync('supabase/migrations/20260915_manual_workout_source_and_planned_exercises.sql', 'utf8')

test('recommended remains the default and manual is a secondary selectable mode', () => {
  assert.match(dashboard, /useState<'recommended' \| 'manual'>\('recommended'\)/)
  assert.match(dashboard, /className="workout-mode-switch"/)
  assert.match(dashboard, /Recommended/)
  assert.match(dashboard, /Manual/)
  assert.match(dashboard, /workoutMode === 'manual'/)
})

test('switching to manual preserves the recommended workout snapshot', () => {
  assert.match(dashboard, /recommendedExercises=\{props\.assignedExercises\}/)
  assert.match(builder, /Recommendation preserved/)
  assert.match(builder, /plannedExercises=\{recommendedExercises\}/)
})

test('manual builder supports multiple muscle selection and filters by existing equipment without profile writes', () => {
  assert.match(builder, /selectedMuscles\.includes\(muscle\)/)
  assert.match(builder, /setSelectedMuscles/)
  assert.match(builder, /temporaryEquipment/)
  assert.match(builder, /Different equipment today/)
  assert.doesNotMatch(builder, /equipment_access/)
  assert.match(manualLibrary, /filterManualExercises/)
  assert.match(manualLibrary, /muscles\.some/)
  assert.match(manualLibrary, /equipmentMatches/)
})

test('exercise search and compact add/remove workout construction are present', () => {
  assert.match(builder, /placeholder="Search exercises\.\.\."/)
  assert.match(builder, /data-testid="manual-exercise-results"/)
  assert.match(builder, /addExercise/)
  assert.match(builder, /removeExercise/)
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

test('performed work outranks planned work for recovery and partial completions', () => {
  assert.match(tracker, /logs\.filter\(\(log\) => log\.completed\)/)
  assert.match(tracker, /completedLogs\.length > 0/)
  assert.doesNotMatch(tracker, /logs\.map\(\(log\) => \(\{\s+\.\.\.log,\s+completed: true/s)
  assert.match(readiness, /exercise\.completed !== false/)
  assert.match(readiness, /actual_reps \?\? exercise\.recommended_reps/)
})
