import assert from 'node:assert/strict'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'

const { createDashboardRequestReads } = await importTs('lib/dashboard/requestReads.ts')
const { calculateClientNutritionTargets } = await importTs('lib/nutrition/targetService.ts')
const { getDailyExecutionPlan } = await importTs('lib/day/getDailyExecutionPlan.ts')
const { loadProgramLogicInputs } = await importTs('lib/dashboard/logic/loadProgramLogicInputs.ts')
const owner = { id: 'synthetic-owner' }
const client = { client_id: 'SYNTHETIC-CLIENT', auth_user_id: owner.id, program: 'ignite', timezone: 'UTC',
  wake_time: '05:00', bed_time: '21:00', current_workout_minutes_per_session: 75, workout_days_available: 6,
  primary_goal: 'Effective profile goal', execution_style: 'flow', onboarding_data: {} }
const savedInitial = { id: 'saved-initial', client_id: client.client_id, assessment_type: 'initial',
  submitted_at: '2026-10-01T12:00:00Z', data: { trainingDays: 3, experienceLevel: 'beginner', nested: { preserved: true } } }
const rawClient = { client_id: client.client_id, birthdate: '1990-01-01', sex: 'female',
  current_workout_minutes_per_session: 30, workout_days_available: 3, primary_goal: 'Raw client goal' }
const clone = value => structuredClone(value)
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
const operation = (query, method, field) => query.ops.find(op => op[0] === method && (field === undefined || op[1] === field))
const latestInitial = query => query.table === 'assessments' && operation(query, 'eq', 'assessment_type')?.[2] === 'initial'

function database({ initialError = null, initialReply, initialThrow = null } = {}) {
  const queries = []
  const supabase = { from(table) {
    const query = { table, ops: [] }
    let result
    function run(single) {
      result ||= Promise.resolve().then(async () => {
        queries.push(clone(query))
        if (latestInitial(query)) {
          if (initialThrow) throw initialThrow
          if (initialReply) return initialReply.promise
          return { data: initialError ? null : clone(savedInitial), error: initialError }
        }
        if (table === 'clients') return { data: clone(rawClient), error: null }
        if (table === 'assessments' && operation(query, 'eq', 'assessment_type')?.[2] === 'strength') {
          const row = { id: 'saved-strength', assessment_type: 'strength', submitted_at: '2026-10-02T12:00:00Z',
            data: { birthdate: '1990-01-01', height_in: '65', weight: '150' } }
          return { data: single ? row : [row], error: null }
        }
        if (table === 'nutrition_logs') {
          const row = { id: 'today-nutrition', log_date: '2026-11-03', calories: 2000, protein: 100, carbs: 240, fats: 60,
            water_oz: 80, water_consumed_oz: 40 }
          return { data: single ? row : [row], error: null }
        }
        if (table === 'recovery_logs' && single) return { data: { log_date: '2026-11-03', check_in_completed_at: '2026-11-03T10:00:00Z', daily_tasks: [] }, error: null }
        if (table === 'meal_entries' && operation(query, 'select')?.[2]?.head) return { data: null, count: 0, error: null }
        return { data: single ? null : [], error: null }
      })
      return result
    }
    const builder = { then(resolve, reject) { return run(false).then(resolve, reject) },
      maybeSingle() { query.ops.push(['maybeSingle']); return run(true) } }
    for (const method of ['select', 'eq', 'gte', 'gt', 'lte', 'lt', 'in', 'or', 'order', 'limit', 'is']) {
      builder[method] = (...args) => { query.ops.push([method, ...args]); return builder }
    }
    return builder
  }, storage: { from() { return { createSignedUrl: async () => ({ data: { signedUrl: null }, error: null }) } } } }
  return { supabase, queries }
}

function fixedClock(t, instant = '2026-11-03T13:00:00Z') {
  const OriginalDate = globalThis.Date
  let now = OriginalDate.parse(instant)
  class FixedDate extends OriginalDate { constructor(...args) { super(...(args.length ? args : [now])) } static now() { return now } }
  globalThis.Date = FixedDate
  t.after(() => { globalThis.Date = OriginalDate })
  return next => { now = OriginalDate.parse(next) }
}

test('equivalent latest-initial reads share one in-flight owned query while each consumer receives separate JSON data', async () => {
  const held = deferred(), { supabase, queries } = database({ initialReply: held })
  const reads = createDashboardRequestReads({ supabase, user: owner, client })
  const first = reads.readLatestInitialAssessment({ supabase, clientId: client.client_id })
  const second = reads.readLatestInitialAssessment({ supabase, clientId: client.client_id })
  await new Promise(setImmediate)
  assert.equal(queries.length, 1)
  assert.deepEqual(queries[0], { table: 'assessments', ops: [['select', '*'], ['eq', 'client_id', client.client_id],
    ['eq', 'assessment_type', 'initial'], ['order', 'submitted_at', { ascending: false }], ['limit', 1], ['maybeSingle']] })
  held.resolve({ data: clone(savedInitial), error: null })
  const [left, right] = await Promise.all([first, second])
  assert.deepEqual(left, right)
  assert.notEqual(left.data, right.data)
  left.data.data.nested.preserved = false
  assert.equal(right.data.data.nested.preserved, true)
  const third = await reads.readLatestInitialAssessment({ supabase, clientId: client.client_id })
  assert.equal(third.data.data.nested.preserved, true)
  assert.equal(queries.length, 1)
})

test('request scopes reject foreign owners, clients and Supabase instances and never become a cross-request or midnight cache', async t => {
  const advance = fixedClock(t, '2026-11-02T23:59:59Z')
  const first = database(), second = database()
  for (const value of [{ ...client, auth_user_id: 'other' }, { ...client, client_id: '' }, { ...client, auth_user_id: null }]) {
    assert.throws(() => createDashboardRequestReads({ supabase: first.supabase, user: owner, client: value }))
  }
  const reads = createDashboardRequestReads({ supabase: first.supabase, user: owner, client })
  await assert.rejects(reads.readLatestInitialAssessment({ supabase: second.supabase, clientId: client.client_id }))
  await assert.rejects(reads.readLatestInitialAssessment({ supabase: first.supabase, clientId: 'ANOTHER-CLIENT' }))
  assert.equal(first.queries.length, 0); assert.equal(second.queries.length, 0)
  await reads.readLatestInitialAssessment({ supabase: first.supabase, clientId: client.client_id })
  advance('2026-11-03T00:00:00Z')
  const nextRequest = createDashboardRequestReads({ supabase: first.supabase, user: owner, client })
  await nextRequest.readLatestInitialAssessment({ supabase: first.supabase, clientId: client.client_id })
  assert.equal(first.queries.length, 2, 'A new server request reads again even with the same owner/client and a date boundary.')
  const otherOwner = { id: 'other-owner' }, otherClient = { ...client, client_id: 'OTHER-CLIENT', auth_user_id: otherOwner.id }
  const other = createDashboardRequestReads({ supabase: second.supabase, user: otherOwner, client: otherClient })
  await other.readLatestInitialAssessment({ supabase: second.supabase, clientId: otherClient.client_id })
  assert.equal(second.queries[0].ops.find(op => op[0] === 'eq' && op[1] === 'client_id')[2], otherClient.client_id)
})

test('owned response errors and thrown transport failures retain their semantics for all request consumers', async () => {
  const error = { message: 'Synthetic source unavailable', code: 'SYNTHETIC' }
  const response = database({ initialError: error }), reads = createDashboardRequestReads({ supabase: response.supabase, user: owner, client })
  const results = await Promise.all([1, 2].map(() => reads.readLatestInitialAssessment({ supabase: response.supabase, clientId: client.client_id })))
  assert.deepEqual(results, [{ data: null, error }, { data: null, error }])
  assert.equal(response.queries.length, 1)
  const failure = new Error('Synthetic transport failure'), rejected = database({ initialThrow: failure })
  const failedReads = createDashboardRequestReads({ supabase: rejected.supabase, user: owner, client })
  const settled = await Promise.allSettled([1, 2].map(() => failedReads.readLatestInitialAssessment({ supabase: rejected.supabase, clientId: client.client_id })))
  assert.ok(settled.every(result => result.status === 'rejected' && result.reason === failure))
  assert.equal(rejected.queries.length, 1)
  const fresh = createDashboardRequestReads({ supabase: rejected.supabase, user: owner, client })
  await assert.rejects(fresh.readLatestInitialAssessment({ supabase: rejected.supabase, clientId: client.client_id }), error => error === failure)
  assert.equal(rejected.queries.length, 2)
})

async function dashboardSources(shared, options = {}) {
  const state = database(options)
  const requestReads = shared ? createDashboardRequestReads({ supabase: state.supabase, user: owner, client }) : undefined
  const dailyPlan = await getDailyExecutionPlan({ supabase: state.supabase, client, requestReads })
  const inputs = await loadProgramLogicInputs({ supabase: state.supabase, user: owner, client, requestReads, program: 'ignite', dailyPlan,
    cycleStatus: {}, cycleAdjustment: {}, plannedWorkout: null, plannedExercises: [], monthlyAssessmentsDueCount: 0 })
  return { dailyPlan, inputs, queries: state.queries }
}

test('actual daily-plan and logic readers retain result parity while identical initial reads fall from two to one and other query shapes stay distinct', async t => {
  fixedClock(t)
  const before = await dashboardSources(false), after = await dashboardSources(true)
  assert.deepEqual(after.dailyPlan, before.dailyPlan)
  assert.deepEqual(after.inputs, before.inputs)
  assert.equal(before.queries.filter(latestInitial).length, 2)
  assert.equal(after.queries.filter(latestInitial).length, 1)
  assert.deepEqual(after.queries.filter(query => !latestInitial(query)), before.queries.filter(query => !latestInitial(query)))
  const recovery = after.queries.filter(query => query.table === 'recovery_logs' && operation(query, 'eq', 'log_date'))
  assert.equal(recovery.length, 2)
  assert.deepEqual(recovery.map(query => operation(query, 'limit')?.[1]), [undefined, 1], 'Different duplicate/error semantics are deliberately not merged.')
  const nutrition = after.queries.filter(query => query.table === 'nutrition_logs')
  assert.equal(nutrition.length, 2)
  assert.ok(nutrition.some(query => operation(query, 'eq', 'log_date')))
  assert.ok(nutrition.some(query => operation(query, 'gte', 'log_date') && operation(query, 'lte', 'log_date')))
  const workouts = after.queries.filter(query => query.table === 'workout_logs')
  assert.equal(workouts.length, 4, 'Today completed-workout reads remain independent from the limited90-day history.')
  assert.equal(workouts.filter(query => operation(query, 'eq', 'auth_user_id')).length, 2)
  assert.equal(workouts.filter(query => !operation(query, 'eq', 'auth_user_id')).length, 2)
  assert.equal(after.queries.filter(query => query.table === 'clients').length, 1, 'Nutrition still fetches the raw client row.')
})

test('initial-assessment error fallback parity and strict target read failures are unchanged by sharing', async t => {
  fixedClock(t)
  const initialError = { message: 'Synthetic initial source failure', code: 'SYNTHETIC' }
  const before = await dashboardSources(false, { initialError }), after = await dashboardSources(true, { initialError })
  assert.deepEqual(after.dailyPlan, before.dailyPlan)
  assert.deepEqual(after.inputs, before.inputs)
  assert.equal(after.inputs.initialAssessment, null)
  assert.equal(after.queries.filter(latestInitial).length, 1)
  for (const shared of [false, true]) {
    const { supabase } = database({ initialError })
    const requestReads = shared ? createDashboardRequestReads({ supabase, user: owner, client }) : undefined
    await assert.rejects(calculateClientNutritionTargets({ supabase, clientId: client.client_id, program: 'ignite', requestReads, failOnReadError: true }), /source data could not be loaded/)
  }
})

test('sharing an initial assessment never replaces raw nutrition client inputs with the effective profile snapshot', async t => {
  fixedClock(t)
  const { supabase, queries } = database(), requestReads = createDashboardRequestReads({ supabase, user: owner, client })
  const targets = await calculateClientNutritionTargets({ supabase, clientId: client.client_id, program: 'ignite', requestReads })
  assert.equal(targets.target.inputs.trainingDurationMinutes, rawClient.current_workout_minutes_per_session)
  assert.notEqual(targets.target.inputs.trainingDurationMinutes, client.current_workout_minutes_per_session)
  assert.equal(targets.target.inputs.goalValue, rawClient.primary_goal)
  assert.deepEqual(queries.find(query => query.table === 'clients').ops, [['select', '*'], ['eq', 'client_id', client.client_id], ['maybeSingle']])
})
