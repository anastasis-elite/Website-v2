import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const explanation = 'No timestamped heart-rate stream or continuous exercise/rest intervals are connected to this session. Your recorded sets remain available. This screen does not establish a watch connection or a heart-rate readiness threshold.'
const nodes = (tree, match) => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree)
  ? tree.flatMap(child => nodes(child, match)) : [...(match(tree) ? [tree] : []), ...nodes(tree.props?.children, match)]

function harness({ safety = false, readiness = [] } = {}) {
  const states = []
  let position = 0
  const module = { exports: {} }
  const mocks = {
    react: { ...React, useEffect() {}, useState(initial) {
      const slot = position++
      if (!(slot in states)) states[slot] = typeof initial === 'function' ? initial() : initial
      return [states[slot], value => { states[slot] = typeof value === 'function' ? value(states[slot]) : value }]
    } },
    'next/link': { __esModule: true, default: ({ href, children, ...props }) => React.createElement('a', { href, ...props }, children) },
    '@/components/WorkoutTracker': { __esModule: true, default: () => null },
    '@/components/legal/SafetyEscalationNotice': { __esModule: true, default: () => React.createElement('p', { role: 'alert' }, 'Existing safety notice') },
    '@/components/workout-feedback/WorkoutFeedback': { __esModule: true, default: () => null },
    '@/components/workout-dashboard/ManualWorkoutBuilder': { __esModule: true, default: () => null },
    '@/components/workout-dashboard/MuscleReadinessMap': { __esModule: true, default: () => null },
    '@/lib/assessment/getStrengthAssessmentStatus': { getStrengthAssessmentDetail: () => 'Saved assessment information.' },
    '@/lib/workout/muscleReadiness': { getMuscleIdsForExercise: () => [] },
    '@/lib/workout/activity': { activityDose: () => ({}), summarizeActivityUnits: () => ({ sets: 0, reps: 0, minutes: 0, breaths: 0, activities: 0 }) },
    '@/lib/workout/logging': { exerciseOccurrenceLabel: () => 'Saved exercise', formatWorkoutHistoryDate: value => value },
    '@/lib/workout/viewPreferences': { parseWorkoutViewPreferences: () => ({ tab: 'progress', mode: 'recommended' }) },
  }
  const code = ts.transpileModule(readFileSync('components/workout-dashboard/WorkoutDashboard.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText
  runInNewContext(code, { module, exports: module.exports, require: name => mocks[name] || require(name) })
  const props = { clientId: 'synthetic-client', authUserId: 'synthetic-owner', program: 'ignite',
    workoutTitle: 'Saved workout', workoutStateLabel: 'Preview', assignedWorkoutId: 'saved-plan', assignedDayName: 'Monday',
    assignedExercises: [], showInteractiveWorkout: false, hasSafetyFlags: safety, safetyFlags: safety ? [{ id: 'synthetic-flag' }] : [],
    previewTitle: 'Existing preview', previewMessage: 'Saved workout remains available.', muscleReadiness: readiness,
    workoutHistory: [], memberEquipment: [], showStrengthAssessmentOffer: false,
    logic: { execution: { workoutComplete: false }, workout: { durationMinutes: 0 } } }
  const render = () => { position = 0;return module.exports.default(props) }
  return { render, html: () => renderToStaticMarkup(render()), tab(id) {
    const button = nodes(render(), node => node.type === 'button' && node.props.id === `workout-tab-${id}`)[0]
    assert.ok(button);button.props.onClick()
  } }
}

test('default workout keeps its panel and safety information without the top heart-rate disclosure', () => {
  const view = harness({ safety: true }), html = view.html()
  assert.match(html, /data-testid="today-workout-panel"/)
  assert.match(html, /Existing preview/)
  assert.match(html, /role="alert">Existing safety notice/)
  assert.match(html, /id="workout-tab-progress"[^>]+aria-selected="true"/)
  assert.doesNotMatch(html, /Heart-rate recovery|No timestamped heart-rate stream/)
})

test('the existing Recovery tab reveals the unchanged unavailable disclosure with muscle recovery information', () => {
  const view = harness({ readiness: [{ muscleId: 'left_quadriceps', state: 'recovering', reasons: ['Existing muscle recovery note.'] }] })
  view.tab('recovery')
  const html = view.html()
  assert.match(html, /id="workout-tab-recovery"[^>]+aria-selected="true"/)
  assert.match(html, /role="tabpanel" aria-labelledby="workout-tab-recovery"/)
  assert.match(html, /data-testid="workout-recovery-tab"[^>]*><details class="phone-app-report"><summary>Heart-rate recovery · Unavailable<\/summary>/)
  assert.equal((html.match(/Heart-rate recovery · Unavailable/g) || []).length, 1)
  assert.ok(html.includes(explanation))
  assert.match(html, /Existing muscle recovery note\./)
  assert.match(html, /class="workout-recovery-table"/)
  view.tab('progress')
  assert.doesNotMatch(view.html(), /Heart-rate recovery|No timestamped heart-rate stream/)
})
