import assert from 'node:assert/strict'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'

const { prepareProgramLogicInputs, loadProgramLogicInputs, DashboardLocalDayChangedError } = await importTs('lib/dashboard/logic/loadProgramLogicInputs.ts')
const owner = { id: 'synthetic-owner' }
const member = { client_id: 'SYNTHETIC-CLIENT', auth_user_id: owner.id, program: 'phoenix', timezone: 'America/Chicago',
  wake_time: '05:00', bed_time: '21:00', onboarding_data: {} }
const clone = value => structuredClone(value)
const flush = () => new Promise(setImmediate)
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
const operation = (query, method, field) => query.ops.find(op => op[0] === method && (field === undefined || op[1] === field))
function fixedClock(t, instant = '2026-11-03T19:00:00Z') {
  const OriginalDate = globalThis.Date
  let now = OriginalDate.parse(instant)
  class FixedDate extends OriginalDate { constructor(...args) { super(...(args.length ? args : [now])) } static now() { return now } }
  globalThis.Date = FixedDate
  t.after(() => { globalThis.Date = OriginalDate })
  return next => { now = OriginalDate.parse(next) }
}
function database({ holdInitial, initialThrow, nutritionError, mealError, recoveryError, executionError } = {}) {
  const queries = []
  const supabase = { from(table) {
    const query = { table, ops: [] }; let pending
    function run(single) {
      pending ||= Promise.resolve().then(() => {
        queries.push(clone(query))
        const type = operation(query, 'eq', 'assessment_type')?.[2]
        if (table === 'assessments' && type === 'initial') {
          if (initialThrow) throw initialThrow
          if (holdInitial) return holdInitial.promise
          return { data: { id: 'initial', data: { trainingDays: 3 }, submitted_at: '2026-10-01T12:00:00Z' }, error: null }
        }
        if (table === 'nutrition_logs') return { data: [{ id: 'nutrition', log_date: '2026-11-03', calories: 2000, protein: 100, carbs: 240, fats: 60 }], error: nutritionError || null }
        if (table === 'nutrition_log_totals_by_block') return { data: [{ nutrition_log_id: 'nutrition', day_block: 'morning', calories_eaten: 500, protein_eaten_g: 20, carbs_eaten_g: 50, fat_eaten_g: 10 }], error: null }
        if (table === 'meal_entries') return { data: [{ id: 'meal', nutrition_log_id: 'nutrition', meal_name: 'Breakfast', day_block: 'morning', created_at: '2026-11-03T13:00:00Z' }], error: mealError || null }
        if (table === 'recovery_activity_logs') return { data: [], error: recoveryError || null }
        if (table === 'daily_execution_status') return { data: [], error: executionError || null }
        return { data: single ? null : [], error: null }
      })
      return pending
    }
    const builder = { then(yes, no) { return run(false).then(yes, no) }, maybeSingle() { query.ops.push(['maybeSingle']); return run(true) } }
    for (const method of ['select','eq','gte','gt','lte','lt','in','or','order','limit','is']) {
      builder[method] = (...args) => { query.ops.push([method, ...args]); return builder }
    }
    return builder
  }, storage: { from() { return { createSignedUrl: async () => ({ data: null, error: null }) } } } }
  return { supabase, queries }
}
function context(db, client = { ...member }) { return { supabase: db.supabase, user: owner, client, program: 'phoenix' } }
function full(args, dailyPlan = { date: '2026-11-03', workoutCompleted: false, dailyTargets: { water: 80 }, dailyRemaining: { water: 80 } }) {
  return { ...args, dailyPlan, cycleStatus: { phase: 'unknown' }, cycleAdjustment: null, plannedWorkout: null,
    plannedExercises: [], monthlyAssessmentsDueCount: 0 }
}

test('prepared source waves start before the daily plan joins, while task completion uses the joined plan', async t => {
  fixedClock(t)
  const initial = deferred(), db = database({ holdInitial: initial }), args = context(db)
  const prepared = prepareProgramLogicInputs(args)
  let ready = false
  prepared.ready.then(() => { ready = true })
  await flush()
  assert.equal(ready, false)
  assert.ok(db.queries.some(query => query.table === 'nutrition_logs'))
  assert.ok(db.queries.some(query => query.table === 'recovery_logs'))
  assert.equal(db.queries.some(query => query.table === 'nutrition_log_totals_by_block'), false, 'Second-wave reads still require the first-wave result.')
  initial.resolve({ data: { data: {} }, error: null })
  await prepared.ready
  assert.equal(ready, true)
  assert.ok(db.queries.some(query => query.table === 'nutrition_log_totals_by_block'), 'Dependent source reads start without waiting for the plan.')
  const inputs = await prepared.resolve(full(args, { date: '2026-11-03', workoutCompleted: true,
    dailyTargets: { water: 80 }, dailyRemaining: { water: 16 } }))
  assert.ok(inputs.phoenixTaskIds.includes('midday-movement'))
  assert.ok(inputs.phoenixTaskIds.includes('morning-water'))
  assert.equal(inputs.dailyPlan.workoutCompleted, true)
  const incomplete = await prepared.resolve(full(args))
  assert.equal(incomplete.phoenixTaskIds.includes('midday-movement'), false)
  assert.equal(incomplete.phoenixTaskIds.includes('morning-water'), false, 'Prepared data contains no cached placeholder-plan completion.')
})

test('prepared/default assembly keeps query shapes, normalization and source-error availability identical', async t => {
  fixedClock(t)
  const error = { code: 'SYNTHETIC', message: 'Synthetic source failure' }
  for (const options of [{}, { nutritionError: error }, { mealError: error }, { recoveryError: error }, { executionError: error }]) {
    const directDb = database(options), preparedDb = database(options)
    const directArgs = full(context(directDb)), preparedArgs = full(context(preparedDb))
    const direct = await loadProgramLogicInputs(directArgs)
    const prepared = await prepareProgramLogicInputs(preparedArgs).resolve(preparedArgs)
    assert.deepEqual(prepared, direct)
    assert.deepEqual(preparedDb.queries, directDb.queries, 'No projection, owner/date filter, range, ordering, limit or error shape is merged or changed.')
    assert.equal(prepared.nutritionHistoryAvailable, !options.nutritionError && !options.mealError)
    assert.equal(prepared.recoveryActivitiesAvailable, !options.recoveryError)
    assert.equal(prepared.executionHistoryAvailable, !options.executionError)
  }
})

test('a rejected early read is handled immediately and rethrown unchanged only when its result is joined', async t => {
  fixedClock(t)
  const failure = new Error('Synthetic transport failure'), db = database({ initialThrow: failure }), args = context(db)
  const observed = []
  const listener = error => observed.push(error)
  process.on('unhandledRejection', listener)
  t.after(() => process.off('unhandledRejection', listener))
  const prepared = prepareProgramLogicInputs(args)
  assert.equal(await prepared.ready, undefined, 'Timing observes settlement without receiving source values or throwing the held read error.')
  await flush(); await flush()
  assert.deepEqual(observed, [])
  await assert.rejects(prepared.resolve(full(args)), error => error === failure)
  const direct = database({ initialThrow: failure })
  await assert.rejects(loadProgramLogicInputs(full(context(direct))), error => error === failure)
})

test('prepared input scope rejects foreign owners/readers/tier/profile/timezone and reads nothing for an invalid owner', async t => {
  fixedClock(t)
  const db = database(), args = context(db), prepared = prepareProgramLogicInputs(args), joined = full(args)
  await prepared.resolve(joined)
  for (const patch of [{ supabase: {} }, { user: { id: 'other' } }, { user: { id: owner.id } },
    { client: { ...args.client, client_id: 'OTHER' } }, { client: { ...args.client } },
    { program: 'ignite' }, { requestReads: {} }]) {
    assert.throws(() => prepared.assertCurrent({ ...joined, ...patch }), /scope changed/)
  }
  args.client.timezone = 'America/New_York'
  assert.throws(() => prepared.assertCurrent(joined), /scope changed/)
  args.client.timezone = member.timezone
  args.client.wake_time = '06:00'
  assert.throws(() => prepared.assertCurrent(joined), /scope changed/)
  const empty = database()
  for (const client of [{ ...member, auth_user_id: 'other' }, { ...member, auth_user_id: null }, { ...member, program: 'ignite' }]) {
    assert.throws(() => prepareProgramLogicInputs(context(empty, client)), /verified member owner and program/)
  }
  await flush()
  assert.equal(empty.queries.length, 0)
  const fallbackDb = database(), fallbackArgs = { ...context(fallbackDb, { ...member, program: null }), program: 'ignite' }
  const fallback = prepareProgramLogicInputs(fallbackArgs)
  const inputs = await fallback.resolve(full(fallbackArgs))
  assert.equal(inputs.program, 'ignite')
})

test('prepared inputs fence the member-local day before resolve and after pending sources finish', async t => {
  const advance = fixedClock(t, '2026-11-04T05:59:59Z')
  const initial = deferred(), db = database({ holdInitial: initial }), args = context(db), prepared = prepareProgramLogicInputs(args)
  const resolving = prepared.resolve(full(args))
  advance('2026-11-04T06:00:00Z')
  initial.resolve({ data: null, error: null })
  await assert.rejects(resolving, error => error instanceof DashboardLocalDayChangedError)
  assert.throws(() => prepared.assertCurrent(full(args)), error => error instanceof DashboardLocalDayChangedError)
  const nextDb = database(), nextArgs = context(nextDb), next = prepareProgramLogicInputs(nextArgs)
  assert.throws(() => next.assertCurrent(full(nextArgs)), error => error instanceof DashboardLocalDayChangedError)
  const current = full(nextArgs, { date: '2026-11-04' })
  const inputs = await next.resolve(current)
  assert.equal(inputs.date, '2026-11-04')
  for (const query of nextDb.queries.filter(query => query.table === 'nutrition_logs')) {
    assert.equal(operation(query, 'lte', 'log_date')[2], '2026-11-04')
  }
})
