import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const route = readFileSync('app/dashboard/program/[program]/workout/page.tsx', 'utf8')
const dashboard = readFileSync('components/workout-dashboard/WorkoutDashboard.tsx', 'utf8')
const map = readFileSync('components/workout-dashboard/MuscleReadinessMap.tsx', 'utf8')
const css = readFileSync('app/globals.css', 'utf8')

test('workout dashboard uses objective, two-panel row, and full-width toggle panel', () => {
  assert.match(dashboard, /data-testid="workout-objective"/)
  assert.match(dashboard, /className="workout-dashboard-row"/)
  assert.match(map, /data-testid="muscle-readiness-panel"/)
  assert.match(dashboard, /data-testid="today-workout-panel"/)
  assert.match(dashboard, /data-testid="workout-toggle-panel"/)
  assert.match(css, /\.workout-dashboard-row\{display:grid;grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)/)
  assert.match(css, /@media\(max-width:860px\).*\.workout-dashboard-row.*grid-template-columns:1fr/s)
})

test('workout toggle panel contains workout-specific tab set', () => {
  assert.match(dashboard, /\['progress', 'strength', 'recovery', 'history'\] as Tab\[\]/)
  assert.match(dashboard, /data-testid="workout-progress-tab"/)
  assert.match(dashboard, /data-testid="workout-strength-tab"/)
  assert.match(dashboard, /data-testid="workout-recovery-tab"/)
  assert.match(dashboard, /data-testid="workout-history-tab"/)
})

test('route reuses existing workout engine and reads existing history and recovery data', () => {
  assert.match(route, /getProgramWorkout/)
  assert.match(route, /getProgramLogicEngine/)
  assert.match(route, /\.from\('workout_logs'\)/)
  assert.match(route, /\.from\('recovery_logs'\)/)
  assert.match(route, /buildMuscleReadiness/)
  assert.doesNotMatch(route, /insert\(|upsert\(/)
})

test('muscle map reuses existing body model and exposes interactive muscle labels', () => {
  assert.match(map, /src="\/woman-silhouette\.png"/)
  assert.match(map, /viewBox="0 0 862 1825"/)
  assert.match(map, /role="button"/)
  assert.match(map, /aria-label=\{`\$\{region\.label\}: \$\{stateLabels\[state\]\}`\}/)
  assert.match(map, /data-muscle-id=\{region\.id\}/)
  assert.match(map, /workout-readiness-legend/)
})

test('workout panel has an intentional internal scroll area on desktop', () => {
  assert.match(dashboard, /className="workout-scroll-region"/)
  assert.match(css, /\.workout-current-panel\{[^}]*max-height:820px/)
  assert.match(css, /\.workout-scroll-region\{[^}]*overflow:auto/)
  assert.match(css, /@media\(max-width:860px\).*\.workout-scroll-region\{overflow:visible\}/s)
})
