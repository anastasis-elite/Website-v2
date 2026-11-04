import assert from 'node:assert/strict'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'

const { selectResumablePrescriptionSnapshot, discoverResumableLocalPrescription, inspectRetainedLocalPrescription } = await importTs('lib/workout/resumePrescribedSession.ts')
const { initialWorkoutLogs, resumeWorkoutSession, workoutSessionKeys } = await importTs('lib/workout/session.ts')
const { workoutCompletion } = await importTs('lib/workout/activity.ts')
const plan = () => [{ id: 'row', exercise: 'Seated Cable Row', session_key: 'row-occurrence-0', sets: 4, reps: 8,
  recommended_weight: 35, selected_variant_id: 'seated_cable_row', load_type: 'total_load' },
{ id: 'row', exercise: 'Seated Cable Row', session_key: 'row-occurrence-1', sets: 2, reps: 10,
  recommended_weight: 25, selected_variant_id: 'seated_cable_row', load_type: 'total_load' }]
function draft() {
  const plannedExercises = plan(), logs = initialWorkoutLogs(plannedExercises)
  logs[0].set_logs = [{ set_number: 1, weight: 32, reps: 7, weight_unit: 'lb', completed_at: '2026-11-04T12:00:00Z' }]
  return { plannedExercises, logs, dirty: true, modifiedAt: '2026-11-04T12:01:00Z', draft: [{ weight: 32, amount: 7 }, { weight: 25, amount: 10 }] }
}
const clone = value => JSON.parse(JSON.stringify(value))

test('resume-only keeps local actual sets and the exact original denominator without a server row', () => {
  const stored = draft(), before = clone(stored), keys = workoutSessionKeys(plan())
  const snapshot = selectResumablePrescriptionSnapshot({ keys, stored, session: null })
  assert.equal(snapshot.source, 'local'); assert.equal(snapshot.plan, stored.plannedExercises)
  const resumed = resumeWorkoutSession(initialWorkoutLogs(snapshot.plan), stored, null)
  assert.deepEqual(resumed.logs[0].set_logs, stored.logs[0].set_logs)
  assert.equal(resumed.logs[0].session_key, 'row-occurrence-0')
  assert.equal(resumed.logs[1].session_key, 'row-occurrence-1')
  const counts = workoutCompletion(resumed.logs, snapshot.plan)
  assert.equal(counts.totalSets, 6); assert.equal(counts.requiredSets, 3); assert.equal(counts.completedSets, 1)
  assert.deepEqual(stored, before)
})

test('resume-only preserves a newer dirty local snapshot over server data including a changed variant', () => {
  const stored = draft(), serverPlan = plan(), keys = workoutSessionKeys(serverPlan)
  stored.logs[0].selected_variant_id = 'machine_row'
  const session = { planned_exercises: serverPlan, exercise_logs: initialWorkoutLogs(serverPlan), updated_at: '2026-11-04T11:00:00Z' }
  const snapshot = selectResumablePrescriptionSnapshot({ keys, stored, session })
  assert.equal(snapshot.source, 'local')
  const resumed = resumeWorkoutSession(initialWorkoutLogs(snapshot.plan), stored, session)
  assert.equal(resumed.logs[0].selected_variant_id, 'machine_row')
  assert.equal(resumed.logs[0].set_logs[0].weight, 32)
  assert.deepEqual(workoutSessionKeys(resumed.logs), keys)
})

test('resume-only uses the server snapshot over a stale browser copy and retains completed work', () => {
  const stored = draft(), logs = clone(stored.logs); logs[0].completed = true
  const session = { planned_exercises: plan(), exercise_logs: logs, updated_at: '2026-11-04T13:00:00Z' }
  const snapshot = selectResumablePrescriptionSnapshot({ keys: workoutSessionKeys(plan()), stored, session })
  assert.equal(snapshot.source, 'server'); assert.equal(snapshot.plan, session.planned_exercises)
  const resumed = resumeWorkoutSession(initialWorkoutLogs(snapshot.plan), stored, session)
  assert.equal(resumed.logs[0].completed, true)
  assert.deepEqual(resumed.logs[0].set_logs, logs[0].set_logs)
})

test('resume-only can recover older local logs with a full retained prescription but never guesses missing dose', () => {
  const complete = draft(); delete complete.plannedExercises
  const keys = workoutSessionKeys(plan())
  const recovered = selectResumablePrescriptionSnapshot({ keys, stored: complete, session: null })
  assert.equal(recovered.plan, complete.logs)
  for (const field of ['sets', 'reps']) {
    const incomplete = clone(complete); delete incomplete.logs[1][field]
    const before = clone(incomplete)
    assert.equal(selectResumablePrescriptionSnapshot({ keys, stored: incomplete, session: null }), null)
    assert.deepEqual(incomplete, before)
  }
  const noLoad = clone(complete); delete noLoad.logs[1].recommended_weight
  assert.ok(selectResumablePrescriptionSnapshot({ keys, stored: noLoad, session: null }))
})

test('resume-only recognizes a raw legacy local array only when every original prescription is explicit', () => {
  const logs = draft().logs, keys = workoutSessionKeys(logs), before = clone(logs)
  const snapshot = selectResumablePrescriptionSnapshot({ keys, stored: logs, session: null })
  assert.equal(snapshot.source, 'local'); assert.equal(snapshot.plan, logs)
  const resumed = resumeWorkoutSession(initialWorkoutLogs(snapshot.plan), { logs }, null)
  assert.deepEqual(resumed.logs[0].set_logs, logs[0].set_logs)
  assert.equal(workoutCompletion(resumed.logs, snapshot.plan).totalSets, 6)
  assert.deepEqual(logs, before)
  const incomplete = clone(logs); delete incomplete[1].sets
  assert.equal(selectResumablePrescriptionSnapshot({ keys, stored: incomplete, session: null }), null)
})

test('known original set and rep doses remain resumable when some exercise load guidance is explicitly unknown', () => {
  const stored = draft(), keys = workoutSessionKeys(stored.logs)
  for (const row of [stored.plannedExercises[1], stored.logs[1]]) {
    row.recommended_weight = null
    row.calculated_weight = null
    row.load_guidance_status = 'not_calculated'
  }
  const before = clone(stored), snapshot = selectResumablePrescriptionSnapshot({ keys, stored, session: null })
  assert.ok(snapshot)
  assert.equal(snapshot.plan[1].recommended_weight, null)
  assert.equal(workoutCompletion(stored.logs, snapshot.plan).totalSets, 6)
  assert.deepEqual(stored, before)
})

test('resume-only rejects empty/unstarted, skipped-only, foreign keys, duplicate occurrences and inconsistent plans', () => {
  const keys = workoutSessionKeys(plan())
  const unstarted = { plannedExercises: plan(), logs: initialWorkoutLogs(plan()) }
  const skipped = clone(unstarted); skipped.logs[0].skipped = true
  const mismatched = draft(); mismatched.plannedExercises[0].session_key = 'another-plan'
  for (const stored of [null, unstarted, skipped, mismatched]) {
    assert.equal(selectResumablePrescriptionSnapshot({ keys, stored, session: null }), null)
  }
  assert.equal(selectResumablePrescriptionSnapshot({ keys: ['foreign-0', 'foreign-1'], stored: draft(), session: null }), null)
  assert.equal(selectResumablePrescriptionSnapshot({ keys: ['repeat', 'repeat'], stored: draft(), session: null }), null)
})

const storageView = map => ({ get length() { return map.size }, key: index => [...map.keys()][index] || null, getItem: key => map.get(key) || null })
const draftKey = (dayName, keys, patch = {}) => `anastasis-session:${patch.clientId || 'OWNED'}:${patch.program || 'ember'}:${dayName}:${patch.date || '2026-11-04'}:${patch.source || 'recommended'}:${JSON.stringify(keys)}`
test('resume-only discovery retains the unique reduced workout title, occurrence subset and original key', () => {
  const stored = draft(); stored.plannedExercises = stored.plannedExercises.slice(0, 1); stored.logs = stored.logs.slice(0, 1)
  const keys = workoutSessionKeys(stored.logs), key = draftKey('Reduced: strength session', keys)
  const map = new Map([[key, JSON.stringify(stored)], [draftKey('Another client', keys, { clientId: 'FOREIGN' }), JSON.stringify(stored)],
    [draftKey('Yesterday', keys, { date: '2026-11-03' }), JSON.stringify(stored)], [draftKey('Manual', keys, { source: 'manual' }), JSON.stringify(stored)]])
  const before = [...map]
  const found = discoverResumableLocalPrescription({ storage: storageView(map), clientId: 'OWNED', program: 'ember', date: '2026-11-04' })
  assert.equal(found.storageKey, key); assert.equal(found.dayName, 'Reduced: strength session')
  assert.deepEqual(found.keys, keys); assert.equal(found.plan.length, 1)
  assert.equal(found.plan[0].sets, 4); assert.equal(found.stored.logs[0].set_logs[0].weight, 32)
  assert.deepEqual([...map], before)
})

test('resume-only discovery refuses ambiguous, malformed and unstarted drafts without writing', () => {
  const stored = draft(), keys = workoutSessionKeys(stored.logs)
  const ambiguous = new Map([[draftKey('Reduced', keys), JSON.stringify(stored)], [draftKey('Different title', keys), JSON.stringify(stored)]])
  const invalid = new Map([[draftKey('Broken', keys), '{bad json'], [draftKey('Wrong keys', ['other']), JSON.stringify(stored)],
    [draftKey('Unstarted', keys), JSON.stringify({ plannedExercises: plan(), logs: initialWorkoutLogs(plan()) })]])
  for (const map of [ambiguous, invalid]) {
    const before = [...map]
    assert.equal(discoverResumableLocalPrescription({ storage: storageView(map), clientId: 'OWNED', program: 'ember', date: '2026-11-04' }), null)
    assert.deepEqual([...map], before)
  }
})

test('retained local inspection separates no evidence from incomplete started or explicitly edited work', () => {
  const keys = workoutSessionKeys(plan())
  assert.equal(inspectRetainedLocalPrescription({ keys, stored: null }).status, 'none')
  const empty = { logs: initialWorkoutLogs(plan()) }
  assert.equal(inspectRetainedLocalPrescription({ keys, stored: empty }).status, 'none')
  for (const retained of [draft(), { logs: draft().logs, dirty: true },
    { logs: initialWorkoutLogs(plan()), draft: [{ weight: 0, weightEdited: true }], dirty: false },
    { logs: initialWorkoutLogs(plan()), draft: [{ weight: null, weightEdited: true }], dirty: false }]) {
    delete retained.plannedExercises
    delete retained.logs[1].sets
    const before = clone(retained)
    assert.equal(inspectRetainedLocalPrescription({ keys, stored: retained }).status, 'incomplete')
    assert.deepEqual(retained, before)
  }
})

test('retained local inspection keeps original plans and complete raw arrays without using current guidance', () => {
  const stored = draft(), keys = workoutSessionKeys(plan()), before = clone(stored)
  const retained = inspectRetainedLocalPrescription({ keys, stored })
  assert.equal(retained.status, 'coherent'); assert.equal(retained.plan, stored.plannedExercises)
  assert.equal(retained.plan[0].sets, 4); assert.deepEqual(stored, before)
  const raw = clone(stored.logs), rawBefore = clone(raw)
  const legacy = inspectRetainedLocalPrescription({ keys, stored: raw })
  assert.equal(legacy.status, 'coherent'); assert.equal(legacy.plan, raw)
  assert.deepEqual(raw, rawBefore)
  delete raw[1].sets
  assert.equal(inspectRetainedLocalPrescription({ keys, stored: raw }).status, 'incomplete')
})

test('retained local inspection rejects null log and plan entries without throwing or altering data', () => {
  const keys = workoutSessionKeys(plan())
  for (const stored of [{ logs: [null, null], dirty: true }, { ...draft(), plannedExercises: [null, null] }]) {
    const before = clone(stored)
    assert.equal(inspectRetainedLocalPrescription({ keys, stored }).status, 'incomplete')
    assert.deepEqual(stored, before)
  }
})
