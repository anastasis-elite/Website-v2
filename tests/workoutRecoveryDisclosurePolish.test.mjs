import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import { importTs } from './typescriptModule.mjs'

const require = createRequire(import.meta.url)
const explanation = 'No timestamped heart-rate stream or continuous exercise/rest intervals are connected to this session. Your recorded sets remain available. This screen does not establish a watch connection or a heart-rate readiness threshold.'
const readinessModule = await importTs('lib/workout/muscleReadiness.ts')
const nodes = (tree, match) => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree)
  ? tree.flatMap(child => nodes(child, match)) : [...(match(tree) ? [tree] : []), ...nodes(tree.props?.children, match)]

function harness({ safety = false, readiness = [] } = {}) {
  const states = [], mapCalls = []
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
    '@/components/workout-dashboard/MuscleReadinessMap': { __esModule: true, default: props => {
      mapCalls.push(props)
      return React.createElement('div', { 'data-testid': 'informational-muscle-map' })
    } },
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
  return { render, mapCalls, html: () => renderToStaticMarkup(render()), tab(id) {
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
  assert.doesNotMatch(html, /Muscle readiness details|informational-muscle-map/)
})

test('the existing Recovery tab retains the unavailable disclosure and points to the single Manual map', () => {
  const readiness = [{ muscleId: 'left_quadriceps', state: 'recovering', reasons: ['Existing muscle recovery note.'] }]
  const view = harness({ readiness })
  view.tab('recovery')
  const html = view.html()
  assert.match(html, /id="workout-tab-recovery"[^>]+aria-selected="true"/)
  assert.match(html, /role="tabpanel" aria-labelledby="workout-tab-recovery"/)
  assert.match(html, /data-testid="workout-recovery-tab"[^>]*><details class="phone-app-report"><summary>Heart-rate recovery · Unavailable<\/summary>/)
  assert.equal((html.match(/Heart-rate recovery · Unavailable/g) || []).length, 1)
  assert.ok(html.includes(explanation))
  assert.equal((html.match(/data-testid="informational-muscle-map"/g) || []).length, 0)
  assert.equal(view.mapCalls.length, 0)
  assert.match(html, /Inspect muscle readiness in the Manual workout map/)
  assert.doesNotMatch(html, /workout-recovery-table|Muscle readiness details/)
  view.tab('progress')
  assert.doesNotMatch(view.html(), /Heart-rate recovery|No timestamped heart-rate stream/)
})

test('the unchanged informational map retains front/back, per-side keyboard and tap inspection with reasons', () => {
  const states = []
  let position = 0
  const module = { exports: {} }
  const mocks = {
    react: { ...React, useMemo: fn => fn(), useState(initial) {
      const slot = position++
      if (!(slot in states)) states[slot] = typeof initial === 'function' ? initial() : initial
      return [states[slot], value => { states[slot] = typeof value === 'function' ? value(states[slot]) : value }]
    } },
    'next/image': { __esModule: true, default: ({ priority, ...props }) => React.createElement('img', props) },
    '@/lib/workout/muscleReadiness': readinessModule,
    '@/lib/workout/manualWorkout': { getReadinessForCanonicalMuscle() { throw new Error('Informational per-side map must not select bilateral manual readiness.') } },
  }
  const code = ts.transpileModule(readFileSync('components/workout-dashboard/MuscleReadinessMap.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText
  runInNewContext(code, { module, exports: module.exports, require: name => mocks[name] || require(name) })
  const readiness = [
    { muscleId: 'left_biceps', state: 'ready', reasons: ['Left recorded reason.'] },
    { muscleId: 'right_biceps', state: 'rest', reasons: ['Right recorded reason.'] },
    { muscleId: 'left_posterior_deltoid', state: 'recovering', reasons: ['Rear shoulder recorded reason.'] },
  ]
  const render = () => { position = 0;return module.exports.default({ readiness }) }
  const html = () => renderToStaticMarkup(render())
  const muscle = id => nodes(render(), node => node.type === 'polygon' && node.props['data-muscle-id'] === id)[0]
  const front = html()
  assert.match(front, /src="\/woman-silhouette\.png"/)
  assert.match(front, /Interactive muscle readiness map: front/)
  let prevented = false
  muscle('left_biceps').props.onKeyDown({ key: 'Enter', preventDefault() { prevented = true } })
  assert.equal(prevented, true)
  assert.equal(muscle('left_biceps').props['aria-pressed'], true)
  assert.equal(muscle('right_biceps').props['aria-pressed'], false)
  assert.match(html(), /Left recorded reason\./)
  assert.doesNotMatch(html(), /Right recorded reason\./)
  muscle('right_biceps').props.onClick()
  assert.match(html(), /Right recorded reason\./)
  assert.equal(muscle('left_biceps').props['aria-pressed'], false)
  nodes(render(), node => node.type === 'button' && node.props.children === 'Back')[0].props.onClick()
  assert.match(html(), /Interactive muscle readiness map: back/)
  assert.match(html(), /data-testid="posterior-body-vector"/)
  muscle('left_posterior_deltoid').props.onKeyDown({ key: ' ', preventDefault() {} })
  assert.match(html(), /Rear shoulder recorded reason\./)
})
