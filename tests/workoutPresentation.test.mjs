import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { importTs } from './typescriptModule.mjs'

const require = createRequire(import.meta.url)
const activity = await importTs('lib/workout/activity.ts')
const module = { exports: {} }
const mocks = {
  react: { useState: initial => [initial, () => {}], useEffect() {} },
  'next/link': { __esModule: true, default: 'a' },
  '@/lib/assessment/getStrengthAssessmentStatus': { getStrengthAssessmentDetail: () => 'Assessment information' },
  '@/components/WorkoutTracker': { __esModule: true, default: 'workout-tracker' },
  '@/components/legal/SafetyEscalationNotice': { __esModule: true, default: 'safety-notice' },
  '@/components/workout-feedback/WorkoutFeedback': { __esModule: true, default: 'workout-feedback' },
  '@/components/workout-dashboard/ManualWorkoutBuilder': { __esModule: true, default: 'manual-builder' },
  '@/components/workout-dashboard/MuscleReadinessMap': { __esModule: true, default: 'readiness-map' },
  '@/lib/workout/muscleReadiness': { getMuscleIdsForExercise: () => [] },
  '@/lib/workout/activity': activity,
  '@/lib/workout/logging': { exerciseOccurrenceLabel: (_rows, index) => `Exercise ${index + 1}`, formatWorkoutHistoryDate: value => value },
  '@/lib/workout/viewPreferences': {},
}
const compiled = ts.transpileModule(readFileSync('components/workout-dashboard/WorkoutDashboard.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText
runInNewContext(compiled, { module, exports: module.exports, require: name => mocks[name] || require(name) })

function expand(tree) {
  if (Array.isArray(tree)) return tree.map(expand)
  if (!tree || typeof tree !== 'object') return tree
  if (typeof tree.type === 'function') return expand(tree.type(tree.props))
  return { ...tree, props: { ...tree.props, children: expand(tree.props.children) } }
}
function nodes(tree, predicate) {
  if (!tree || typeof tree !== 'object') return []
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, predicate))
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props.children, predicate)]
}
function text(tree, visible = false) {
  if (typeof tree === 'string' || typeof tree === 'number') return String(tree)
  if (Array.isArray(tree)) return tree.map(child => text(child, visible)).join(' ')
  if (!tree || typeof tree !== 'object') return ''
  if (visible && tree.type === 'details' && !tree.props.open) return text(nodes(tree.props.children, node => node.type === 'summary')[0], visible)
  return text(tree.props.children, visible)
}
function fixture() {
  return {
    clientId: 'disposable-client', authUserId: 'disposable-owner', program: 'ignite',
    workoutTitle: 'Low-Capacity Strength Workout', workoutStateLabel: 'Reduced-capacity training',
    assignedWorkoutId: 'disposable-plan', assignedDayName: 'Low-Capacity Strength Workout',
    assignedExercises: [{ id: 'squat', exercise: 'Squat', sets: 3, reps: 8, client_cues: ['Move with control.'] }],
    showInteractiveWorkout: true, hasSafetyFlags: false, safetyFlags: [], previewTitle: 'Unavailable', previewMessage: 'Review your plan.',
    logic: { execution: {}, workout: { assigned: true, title: 'Low-Capacity Strength Workout', durationMinutes: 20 },
      workoutDecision: { intensityTarget: 'RPE 5–6', reasonForModification: 'Capacity is reduced so this plan has fewer sets.', allowLoadProgression: false } },
    muscleReadiness: [], workoutHistory: [], memberEquipment: [], showStrengthAssessmentOffer: false,
  }
}

test('default workout exposes logging and instructions while adaptations appear only inside a closed optional disclosure', () => {
  const props = fixture()
  const tree = expand(module.exports.default(props))
  const about = nodes(tree, node => node.type === 'details' && text(node.props.children).includes('About today’s workout'))[0]
  assert.ok(about)
  assert.notEqual(about.props.open, true)
  assert.match(text(about), /Low-Capacity Strength Workout/)
  assert.match(text(about), /Reduced-capacity training/)
  assert.match(text(about), /Capacity is reduced/)
  assert.doesNotMatch(text(tree, true), /Low-Capacity|Reduced-capacity|Capacity is reduced|RPE 5–6|Load progression/)
  assert.match(text(tree, true), /Rest until breathing is comfortable/)
  const tracker = nodes(tree, node => node.type === 'workout-tracker')[0]
  assert.ok(tracker)
  assert.equal(tracker.props.exercises, props.assignedExercises)
  assert.equal(tracker.props.plannedExercises, props.assignedExercises)
  assert.deepEqual(tracker.props.exercises[0].client_cues, ['Move with control.'])
})

test('intentional rest, unavailable plans and safety previews retain visible reasons and do not expose a ready logger', () => {
  for (const label of ['Rest day', 'Workout unavailable', 'Safety support first']) {
    const props = { ...fixture(), showInteractiveWorkout: false, assignedExercises: [], workoutStateLabel: label, previewTitle: label, previewMessage: `Required ${label} explanation.` }
    if (label === 'Safety support first') { props.hasSafetyFlags = true; props.safetyFlags = [{ urgency: 'emergency', label: 'Disclosed safety signal' }] }
    const tree = expand(module.exports.default(props))
    assert.match(text(tree, true), new RegExp(label))
    assert.match(text(tree, true), /Required .* explanation/)
    assert.equal(nodes(tree, node => node.type === 'workout-tracker').length, 0)
    assert.equal(nodes(tree, node => node.type === 'details' && text(node).includes('About today’s workout')).length, 0)
    if (props.hasSafetyFlags) assert.equal(nodes(tree, node => node.type === 'safety-notice')[0].props.flags, props.safetyFlags)
  }
})
