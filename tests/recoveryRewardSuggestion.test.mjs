import assert from 'node:assert/strict'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'

const { buildRecoveryRewardSuggestion: build } = await importTs('lib/recovery/rewardSuggestion.ts')
const userId = 'reward-owner', clientId = 'reward-client', date = '2026-11-11'
const now = new Date('2026-11-11T15:00:00.000Z')
const client = { client_id: clientId, auth_user_id: userId, timezone: 'America/Chicago', program: 'ignite', injuries: [], limitations: [] }
const recovery = (patch = {}) => ({ client_id: clientId, auth_user_id: userId, log_date: date,
  check_in_completed_at: '2026-11-11T14:00:00.000Z', ...patch })
const workout = (patch = {}) => ({ id: 'reward-workout', client_id: clientId, auth_user_id: userId,
  workout_date: date, completed: true, ...patch })
const input = (patch = {}) => ({ date, userId, client, now, sources: {
  recoveryLog: recovery(), recoveryAvailable: true, workoutsAvailable: true,
}, workouts: [], safety: {}, ...patch })
const logged = (log, patch = {}) => input({ sources: { ...input().sources, recoveryLog: recovery(log) }, ...patch })
const text = result => `${result.title} ${result.description}`
const noActivityOrHeat = result => {
  assert.ok(result)
  assert.doesNotMatch(text(result), /\b(?:walk(?:ing)?|soak|tub|bath|sauna|heat|mobility|stretch(?:ing)?)\b/i)
}

// These inputs model only saved rows. Planned effort, absent safety fields and
// default profile arrays do not provide permission for movement or heat.
test('neutral suggestion makes no personal claims when saved signals or source availability are missing', () => {
  for (const candidate of [input(), input({ sources: undefined }),
    input({ sources: { ...input().sources, recoveryLog: null } }),
    input({ sources: { recoveryLog: recovery({ stress_level: 9, energy_level: 2, soreness_level: 9 }), recoveryAvailable: false } }),
    input({ sources: { recoveryLog: recovery({ stress_level: 9 }), recoveryAvailable: undefined } }),
  ]) {
    const result = build(candidate)
    assert.equal(result.id, 'quiet-moment')
    assert.equal(result.kind, 'reward')
    assert.doesNotMatch(text(result), /you logged|your workout|stress|soreness|low energy/i)
    noActivityOrHeat(result)
  }
})

test('only verified owner and current local day may produce a suggestion', () => {
  for (const candidate of [input({ userId: '' }), input({ date: '2026-11-10' }),
    input({ date: '2026-11-12' }), input({ client: { ...client, client_id: '' } }),
    input({ client: { ...client, auth_user_id: 'other-owner' } }),
    input({ now: new Date('invalid') }),
  ]) assert.equal(build(candidate), null)
})

test('foreign, stale, future and ambiguously owned recovery logs cannot personalize the reward or inject safety text', () => {
  for (const patch of [{ auth_user_id: 'other-owner' }, { client_id: 'other-client' },
    { auth_user_id: undefined }, { log_date: '2026-11-10' }, { log_date: '2026-11-12' },
    { check_in_completed_at: 'not-a-date' }, { check_in_completed_at: '' },
    { updated_at: '' }, { updated_at: '2026-11-11T20:00:00Z' }, { check_in_completed_at: '2026-11-11T20:00:00Z' },
    { check_in_completed_at: '2026-11-11T02:00:00Z' },
  ]) {
    const result = build(logged({ stress_level: 9, sick: true, notes: 'chest pain', ...patch }))
    assert.equal(result.id, 'quiet-moment')
    assert.equal(result.kind, 'reward')
    assert.doesNotMatch(text(result), /stress|chest pain/i)
  }
})

test('stress, energy and soreness use saved valid ratings without coercing empty or malformed inputs', () => {
  for (const invalid of [null, undefined, '', ' ', false, true, [], {}, NaN, Infinity, -1, 0, 11, '9bad']) {
    assert.equal(build(logged({ stress_level: invalid, energy_level: invalid, soreness_level: invalid })).id, 'quiet-moment')
  }
  assert.equal(build(logged({ stress_level: '7' })).id, 'quiet-moment')
  assert.equal(build(logged({ stress_level: '8' })).id, 'high-stress')
  assert.equal(build(logged({ energy_level: '3' })).id, 'low-energy')
  assert.equal(build(logged({ soreness_level: '7' })).id, 'sore-day')
  assert.equal(build(logged({ energy_level: 7 })).id, 'energy-to-enjoy')
  assert.equal(build(logged({ stress_level: 6, energy_level: 4, soreness_level: 6 })).id, 'quiet-moment')
})

test('low energy and soreness have deterministic precedence over high stress and completed training', () => {
  const completed = { workouts: [workout()] }
  assert.equal(build(logged({ energy_level: 3, soreness_level: 9, stress_level: 9 }, completed)).id, 'low-energy')
  assert.equal(build(logged({ energy_level: 4, soreness_level: 7, stress_level: 9 }, completed)).id, 'sore-after-workout')
  assert.equal(build(logged({ soreness_level: 7, stress_level: 9 })).id, 'sore-day')
  assert.equal(build(logged({ stress_level: 7 }, completed)).id, 'after-workout')
  const stress = build(logged({ stress_level: 8 }, completed))
  assert.equal(stress.id, 'stress-after-workout')
  assert.match(stress.description, /workout is saved.*logged high stress/)
  assert.match(stress.description, /podcast/i)
  for (const result of [build(logged({ energy_level: 2 })), build(logged({ soreness_level: 8 })), stress]) noActivityOrHeat(result)
})

test('completed workouts earn neutral workout wording without assuming taxing or difficult training', () => {
  const result = build(input({ workouts: [workout({ planned_effort: 'maximum', rpe_target: 10, duration_minutes: 180 })] }))
  assert.equal(result.id, 'after-workout')
  assert.match(result.description, /completed workout is saved/i)
  assert.doesNotMatch(text(result), /hard|taxing|intense|difficult|earned|burn|deserve/i)
  noActivityOrHeat(result)
  for (const row of [workout({ completed: false }), workout({ completed: undefined }), workout({ completed: 'true' })]) {
    assert.equal(build(input({ workouts: [row] })).id, 'quiet-moment')
  }
  assert.equal(build(input({ workouts: [{ planned_effort: 'maximum', completed: true }] })).id, 'quiet-moment')
})

test('workout source failure and foreign, stale, future or missing owner rows never establish a completed workout', () => {
  for (const patch of [{ auth_user_id: 'other-owner' }, { auth_user_id: undefined }, { client_id: 'other-client' },
    { workout_date: '2026-11-10' }, { workout_date: '2026-11-12' }, { workout_date: undefined },
    { workout_started_at: 'not-a-date' }, { workout_started_at: '' }, { updated_at: '' },
    { completed_at: '2026-11-11T20:00:00Z' }, { workout_started_at: '2026-11-11T20:00:00Z' },
    { workout_started_at: '2026-11-11T02:00:00Z' },
  ]) assert.equal(build(input({ workouts: [workout(patch)] })).id, 'quiet-moment')
  for (const available of [false, undefined]) {
    assert.equal(build(input({ sources: { ...input().sources, workoutsAvailable: available }, workouts: [workout()] })).id, 'quiet-moment')
  }
})

test('timestamped workouts use actual local day while legacy DATE rows retain their civil date', () => {
  assert.equal(build(input({ workouts: [workout({ workout_started_at: '2026-11-11T14:00:00Z', workout_date: '2026-11-10' })] })).id, 'after-workout')
  assert.equal(build(input({ workouts: [workout({ workout_started_at: null })] })).id, 'after-workout')
  const late = input({ now: new Date('2026-11-12T03:00:00Z'), workouts: [workout({ workout_started_at: '2026-11-12T02:00:00Z', workout_date: '2026-11-12' })] })
  assert.equal(build(late).id, 'after-workout')
  assert.equal(build({ ...late, date: '2026-11-12' }), null)
})

test('workout completion honors actual detailed work rather than a stale completed flag or planned prescription', () => {
  const exercise = { name: 'Squat', exercise_category: 'strength', sets: 2, set_logs: [], completed: true }
  assert.equal(build(input({ workouts: [workout({ exercise_logs: [exercise], planned_exercises: [exercise] })] })).id, 'quiet-moment')
  const loggedExercise = { ...exercise, set_logs: [{ set_number: 1, reps: 5, weight: 25, weight_unit: 'lb', completed_at: '2026-11-11T14:00:00Z' }] }
  assert.equal(build(input({ workouts: [workout({ completed: false, exercise_logs: [loggedExercise], planned_exercises: [exercise] })] })).id, 'after-workout')
})

test('both repeated fall-back hours and spring-forward hours resolve to the member local day', () => {
  for (const [day, instant, starts] of [
    ['2026-11-01', '2026-11-01T08:00:00Z', ['2026-11-01T06:30:00Z', '2026-11-01T07:30:00Z']],
    ['2026-03-08', '2026-03-08T09:00:00Z', ['2026-03-08T07:30:00Z', '2026-03-08T08:30:00Z']],
  ]) for (const start of starts) {
    const result = build(input({ date: day, now: new Date(instant), sources: undefined,
      workouts: [workout({ workout_date: day, workout_started_at: start })],
    }))
    assert.equal(result.date, day)
    assert.equal(result.timezone, 'America/Chicago')
    assert.equal(result.id, 'quiet-moment')
    const available = build(input({ date: day, now: new Date(instant), sources: { ...input().sources, recoveryLog: null },
      workouts: [workout({ workout_date: day, workout_started_at: start })] }))
    assert.equal(available.id, 'after-workout')
  }
})

test('known safety flags always precede rewarding high-stress, low-energy and workout options', () => {
  const high = logged({ energy_level: 2, stress_level: 9, soreness_level: 9 }, { workouts: [workout()] })
  for (const safety of [{ redFlag: true }, { recoveryStatus: 'full_recovery_or_red_flag' }, { adjustmentLevel: 'level_4_rest_or_red_flag' }, { canTrain: false, workoutState: 'recovery' }]) {
    const result = build({ ...high, safety })
    assert.equal(result.kind, 'safety')
    assert.equal(result.id, 'safety-first')
    noActivityOrHeat(result)
    assert.doesNotMatch(text(result), /podcast|music|reward|workout is saved/i)
  }
  for (const key of ['sick', 'dizzy', 'overheated']) {
    assert.equal(build(logged({ [key]: true, stress_level: 9 })).kind, 'safety')
    assert.equal(build(logged({ [key]: false, stress_level: 9 })).id, 'high-stress')
    assert.equal(build(logged({ stress_level: 9 })).id, 'high-stress')
  }
})

test('arbitrary notes and profile text never create new safety or emergency decisions', () => {
  const decisions = { redFlag: false, recoveryStatus: 'normal_training_day', adjustmentLevel: 'level_0_full_plan', canTrain: true, workoutState: 'training' }
  for (const note of ['No chest pain or fainting.', 'My sister had chest pain.', 'Fainted years ago; no issues today.',
    'Discussed severe dizziness in a podcast.', 'chest pain', 'acute injury', 'severe bleeding', 'cannot bear weight']) {
    const candidate = logged({ stress_level: 8, notes: note }, {
      client: { ...client, injuries: [note], limitations: [note] }, safety: { ...decisions }, workouts: [workout()],
    })
    const before = structuredClone(candidate)
    const result = build(candidate)
    assert.equal(result.kind, 'reward')
    assert.equal(result.id, 'stress-after-workout')
    assert.doesNotMatch(text(result), /medical|emergency|pause activity/i)
    assert.deepEqual(candidate, before, 'The reward never alters existing training/safety decisions.')
    noActivityOrHeat(result)
  }
})

test('existing safety decisions remain authoritative independently of arbitrary free text', () => {
  const candidate = logged({ stress_level: 8, notes: 'No chest pain today.' }, { safety: { redFlag: true } })
  assert.equal(build(candidate).kind, 'safety')
  assert.equal(build(candidate).id, 'safety-first')
  assert.equal(build(logged({ stress_level: 8, notes: 'acute injury' })).kind, 'reward')
  for (const state of ['rest', 'unavailable']) {
    assert.equal(build(logged({ stress_level: 8 }, { safety: { canTrain: false, workoutState: state } })).kind, 'reward')
  }
})

test('restrictions, pregnancy, cycle cautions and unknown safety data never produce movement or heat suggestions', () => {
  for (const patch of [{}, { limitations: ['No walking or heat'] }, { injuries: ['knee pain'] },
    { reproductive_status: 'pregnant' }, { cycle_tracking_enabled: true, last_period_start: date },
    { cycle_tracking_enabled: true, last_period_start: '2026-10-17' },
  ]) {
    const result = build(logged({ stress_level: 9, soreness_level: 8, hydration_level: 1, unusually_fatigued: true },
      { client: { ...client, ...patch }, workouts: [workout()] }))
    noActivityOrHeat(result)
  }
  for (const sources of [undefined, { recoveryLog: null, recoveryAvailable: false, workoutsAvailable: false }]) {
    noActivityOrHeat(build(input({ sources })))
  }
  assert.equal(build(input({ client: { ...client, limitations: ['acute injury'] } })).kind, 'reward')
})

test('building a suggestion is deterministic, serializable and does not mutate source rows or decisions', () => {
  const candidate = logged({ stress_level: 8 }, { workouts: [workout()] })
  const before = structuredClone(candidate)
  const first = build(candidate), second = build(candidate)
  assert.deepEqual(first, second)
  assert.deepEqual(candidate, before)
  assert.deepEqual(JSON.parse(JSON.stringify(first)), first)
  assert.deepEqual(Object.keys(first).sort(), ['clientId', 'date', 'description', 'id', 'kind', 'timezone', 'title', 'version'])
})


test('recommendation capability gates every optional reward while safety stays tier-independent', () => {
  for (const program of ['ignite', 'phoenix']) {
    assert.equal(build(logged({ stress_level: 8 }, { client: { ...client, program } })).id, 'high-stress')
  }
  for (const program of ['ember', 'tracker', 'unknown', '', null, undefined]) {
    for (const candidate of [input(), logged({ stress_level: 8 }), input({ workouts: [workout()] })]) {
      const scoped = { ...candidate, client: { ...client, program } }
      assert.equal(build(scoped), null)
      assert.equal(build({ ...scoped, safety: { redFlag: true } }).kind, 'safety')
      assert.equal(build({ ...scoped, sources: { ...input().sources, recoveryLog: recovery({ dizzy: true }) } }).kind, 'safety')
      assert.equal(build({ ...scoped, client: { ...scoped.client, auth_user_id: 'other' }, safety: { redFlag: true } }), null)
    }
  }
})
