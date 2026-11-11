import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, extname, resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
const flush = () => new Promise(setImmediate)
const nodes = (tree, match) => Array.isArray(tree) ? tree.flatMap(child => nodes(child, match))
  : !tree || typeof tree !== 'object' ? [] : [...(match(tree) ? [tree] : []), ...nodes(tree.props?.children, match)]
const clone = value => JSON.parse(JSON.stringify(value))
const owner = { id: 'SYNTHETIC-OWNER' }
const client = { client_id: 'SYNTHETIC-CLIENT', auth_user_id: owner.id, program: 'ignite', timezone: 'UTC' }
class DashboardLocalDayChangedError extends Error {}

function loader(mocks, { clock = () => Date.parse('2026-11-03T13:00:00Z'), errors = [] } = {}) {
  const modules = new Map()
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [clock()])) } static now() { return clock() } }
  function load(file) {
    file = resolve(file)
    if (modules.has(file)) return modules.get(file).exports
    const module = { exports: {} }; modules.set(file, module)
    const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
    runInNewContext(code, { module, exports: module.exports, Date: Clock, Map, Set, Intl, performance,
      console: { error: (...args) => errors.push(args) }, require(name) {
        if (name in mocks) return mocks[name]
        if (name === 'server-only') return {}
        if (name.endsWith('.module.css')) return { __esModule: true, default: { page: 'page' } }
        const target = name.startsWith('@/') ? resolve(name.slice(2)) : name.startsWith('.') ? resolve(dirname(file), name) : null
        if (!target) return require(name)
        return load(extname(target) ? target : target + '.ts')
      } }, { filename: file })
    return module.exports
  }
  return load
}

function logicFixture(overrides = {}) {
  return { client: { id: client.client_id }, program: 'ignite', nutrition: {}, capacityStatus: { status: 'moderate_capacity' }, recoveryStatus: { status: 'ready' },
    fuelReadiness: { status: 'ready' }, symptoms: { severity: 'none', redFlag: false }, execution: {}, assessments: {},
    hydration: {}, workoutDecision: { canTrain: true }, cycle: {}, insight: {}, flameState: { streakEligible: false },
    engineVersion: 'synthetic', ...overrides }
}

// Exercise the production route and its streamed child. All I/O is disposable,
// promise-controlled transport; no authenticated network or member data is used.
function pageFixture(options = {}) {
  let time = Date.parse(options.now || '2026-11-03T13:00:00Z')
  const day = () => new Date(time).toISOString().slice(0, 10)
  const events = [], snapshots = [], writes = [], audits = [], timings = []
  const db = { from(table) { assert.equal(table, 'program_outputs'); events.push('saved-output')
    const q = { select: () => q, eq: () => q, order: () => q, limit: () => q,
      maybeSingle: () => options.output?.promise || Promise.resolve({ data: { program_json: {} }, error: options.outputError || null }) }
    return q
  } }
  const context = { supabase: db, user: owner, client: { ...client } }
  const timing = { start(stage) { events.push('start:' + stage); return () => { timings.push(stage) } },
    async measure(stage, task) { events.push('start:' + stage); try { return await task() } finally { timings.push(stage) } },
    snapshot: () => timings.map(stage => ({ stage, startMs: 0, durationMs: 1 })) }
  const prepared = []
  const load = loader({
    'next/navigation': { redirect(path) { throw new Error('REDIRECT ' + path) } },
    'next/link': { __esModule: true, default: 'a' },
    'next/server': { after: callback => audits.push(callback) },
    '@/lib/performance/dashboardRequest': { createDashboardRequestTiming: () => timing },
    '@/lib/dashboard/getDashboardContext': { getDashboardContext: () => options.auth?.promise || Promise.resolve(context) },
    '@/lib/safety/getRecentSafetyFlags': { getRecentSafetyFlags: () => options.safety?.promise || Promise.resolve(options.flags || []) },
    '@/lib/dashboard/requestReads': { createDashboardRequestReads(args) { assert.equal(args.supabase, db); assert.equal(args.user, owner); return { attempt: snapshots.length } } },
    '@/lib/dashboard/logic/loadProgramLogicInputs': { DashboardLocalDayChangedError,
      prepareProgramLogicInputs(args) {
        events.push('raw-sources'); const selectedDay = day(), attempt = snapshots.length
        snapshots.push({ day: selectedDay, args }); const raw = options.raw?.[attempt]?.promise || Promise.resolve({ day: selectedDay })
        const result = { ready: raw.then(() => undefined, () => undefined),
          assertCurrent(current) { assert.equal(current.user, args.user); assert.equal(current.client, args.client)
            if (selectedDay !== day()) throw new DashboardLocalDayChangedError('Local day changed') },
          async resolve(current) { result.assertCurrent(current); const value = await raw; result.assertCurrent(current); return value } }
        prepared.push(result); return result
      } },
    '@/lib/day/getDailyExecutionPlan': { getDailyExecutionPlan(args) { events.push('plan'); assert.equal(args.requestReads.attempt, snapshots.length - 1)
      return options.plan?.[snapshots.length - 1]?.promise || Promise.resolve({ date: day(), timezone: 'UTC', timing: {} }) } },
    '@/lib/assessment/getMonthlyAssessmentStatus': { getMonthlyAssessmentStatus: () => { events.push('monthly'); return Promise.resolve({ due: false }) } },
    '@/lib/program/getProgramWorkout': { getProgramWorkout: () => ({ programJson: {}, todaysWorkout: null, cycleAdjustment: null, adjustedExercises: [] }) },
    '@/lib/program/getSavedPlanState': { getSavedPlanState: () => ({ status: 'ready' }) },
    '@/lib/cycle/getCycleStatus': { getCycleStatus: () => ({ enabled: false }) },
    '@/lib/dashboard/logic/getProgramLogicEngine': { async getProgramLogicEngine(args) {
      events.push('logic'); const raw = await args.preparedInputs.resolve(args)
      args.preparedInputs.assertCurrent(args); writes.push({ day: args.dailyPlan.date, rawDay: raw.day })
      if (options.afterWrite) options.afterWrite()
      return options.logic || logicFixture()
    } },
    '@/lib/schedule/service': {
      loadDailyScheduleSources(args) { events.push('schedule-sources'); assert.equal(args.sourceTimeoutMs, 2000); return Promise.resolve({ date: day() }) },
      async getDailyScheduleState(args) { events.push('schedule-assembly'); assert.equal(args.sourceTimeoutMs, 2000)
        const sources = await args.sources; assert.equal(sources.date, args.dailyPlan.date)
        assert.equal(args.logic, options.logic || args.logic)
        const now = `${args.dailyPlan.date}T13:00:00Z`
        return { date: args.dailyPlan.date, timezone: 'UTC', now, todayViewModel: options.noModel ? undefined : {
          version: 1, date: args.dailyPlan.date, timezone: 'UTC', generatedAt: now, clientId: args.logic.client.id, tier: args.logic.program,
          ...options.modelOverrides } } },
    },
    '@/lib/legal/logRecommendationAudit': { logRecommendationAudit() { throw new Error('Deferred audit must not run in this fixture') } },
    '@/lib/nutrition/recipes/getPhoenixRecipeRecommendations': { getPhoenixRecipeRecommendations: () => [] },
    '@/components/legal/SafetyEscalationNotice': { __esModule: true, default: 'safety-notice' },
    '@/components/DashboardPerformance': { __esModule: true, default: 'performance-marker' },
    ...Object.fromEntries(['PlanOverview', 'EmberDashboard', 'IgniteDashboard', 'PhoenixDashboard', 'DashboardReadyShell']
      .map(name => ['@/components/program-dashboard/' + name, { __esModule: true, default: name }])),
  }, { clock: () => time })
  const Page = load('app/dashboard/program/[program]/page.tsx').default
  return { events, snapshots, writes, audits, prepared, context, timings,
    clock(value) { time = Date.parse(value) },
    gate(program = 'ignite') { return Page({ params: Promise.resolve({ program }) }) },
    async render() {
      const shell = await this.gate()
      const child = nodes(shell, node => typeof node.type === 'function' && node.type.name === 'PersonalizedDashboard')[0]
      assert.ok(child); return child.type(child.props)
    },
  }
}

test('authentication, subscription and safety gates finish before personalization sources start', async () => {
  const auth = deferred(), safety = deferred(), f = pageFixture({ auth, safety })
  const page = f.gate(); await flush(); assert.ok(!f.events.includes('raw-sources'))
  auth.resolve(f.context); await flush(); assert.ok(!f.events.includes('raw-sources'))
  safety.resolve([]); await page; assert.ok(!f.events.includes('raw-sources'), 'Streaming shell does not execute the child early')
  const denied = pageFixture(); await assert.rejects(denied.gate('phoenix'), /REDIRECT \/dashboard\/program\/ignite/)
  assert.ok(!denied.events.includes('raw-sources'))
  const flags = [{ reason: 'Synthetic safety pause' }], paused = pageFixture({ flags })
  assert.equal((await paused.gate()).type, 'safety-notice'); assert.equal(paused.audits.length, 1)
  assert.ok(!paused.events.includes('raw-sources'))
  const loggedOut = deferred(), exited = pageFixture({ auth: loggedOut }); const rejected = exited.gate()
  loggedOut.reject(new Error('Authentication ended')); await assert.rejects(rejected, /Authentication ended/)
  assert.ok(!exited.events.includes('raw-sources'))
})

test('independent raw and schedule sources overlap blocked plan; engine writes wait for both required joins', async () => {
  const plan = deferred(), raw = deferred(), output = deferred(), f = pageFixture({ plan: [plan], raw: [raw], output })
  let finished = false; const result = f.render().then(value => { finished = true; return value }); await flush()
  for (const stage of ['raw-sources', 'schedule-sources', 'plan', 'monthly', 'saved-output']) assert.ok(f.events.includes(stage), stage)
  assert.ok(!f.events.includes('logic')); assert.deepEqual(f.writes, [])
  raw.resolve({ day: '2026-11-03' }); await flush(); assert.equal(finished, false); assert.deepEqual(f.writes, [])
  plan.resolve({ date: '2026-11-03', timing: {} }); await flush(); assert.ok(!f.events.includes('logic'))
  output.resolve({ data: {}, error: null }); const rendered = await result
  assert.deepEqual(f.writes, [{ day: '2026-11-03', rawDay: '2026-11-03' }])
  assert.equal(nodes(rendered, n => n.type === 'IgniteDashboard').length, 1)
  assert.equal(f.audits.length, 1)
  const lastRaw = deferred(), rawLast = pageFixture({ raw: [lastRaw] })
  const secondResult = rawLast.render(); await flush()
  assert.ok(rawLast.events.includes('logic')); assert.deepEqual(rawLast.writes, [], 'A joined plan cannot bypass pending personalization.')
  lastRaw.resolve({ day: '2026-11-03' }); await secondResult
  assert.equal(rawLast.writes.length, 1)
})

test('saved-plan and daily-plan required failures keep precedence over already-rejected preloaded sources', async () => {
  for (const failure of ['saved', 'daily']) {
    const raw = deferred(), plan = deferred(), f = pageFixture({ raw: [raw], plan: [plan],
      outputError: failure === 'saved' ? { message: 'Synthetic saved-plan unavailable' } : null })
    const rendered = f.render(); const checked = assert.rejects(rendered,
      failure === 'saved' ? /couldn’t load your saved training plan/ : /Required daily plan failed/)
    await flush(); raw.reject(new Error('Raw source failed earlier'))
    await flush()
    if (failure === 'saved') plan.resolve({ date: '2026-11-03' })
    else plan.reject(new Error('Required daily plan failed'))
    await checked; assert.ok(!f.events.includes('logic')); assert.deepEqual(f.writes, [])
  }
})

test('a required raw-source rejection is still authoritative once the existing joins succeed', async () => {
  const raw = deferred(), plan = deferred(), f = pageFixture({ raw: [raw], plan: [plan] })
  const rendered = f.render(); const checked = assert.rejects(rendered, /Required personalization unavailable/)
  await flush(); raw.reject(new Error('Required personalization unavailable')); await flush()
  assert.ok(!f.events.includes('logic')); plan.resolve({ date: '2026-11-03' }); await checked
  assert.deepEqual(f.writes, []); assert.equal(f.audits.length, 0)
})

test('local midnight retries all joined inputs once and renders only the fresh day before any persistence', async () => {
  const raw = deferred(), f = pageFixture({ now: '2026-11-03T23:59:59Z', raw: [raw] })
  const rendered = f.render(); await flush()
  f.clock('2026-11-04T00:00:01Z'); raw.resolve({ day: '2026-11-03' })
  const result = await rendered
  assert.deepEqual(f.snapshots.map(row => row.day), ['2026-11-03', '2026-11-04'])
  assert.deepEqual(f.writes, [{ day: '2026-11-04', rawDay: '2026-11-04' }])
  assert.equal(f.events.filter(event => event === 'plan').length, 2)
  assert.equal(f.events.filter(event => event === 'schedule-sources').length, 2)
  assert.equal(f.audits.length, 1)
  assert.equal(nodes(result, node => node.type === 'IgniteDashboard')[0].props.schedule.date, '2026-11-04')
})

test('a second midnight boundary fails honestly instead of looping or saving an old day', async () => {
  const first = deferred(), second = deferred(), f = pageFixture({ now: '2026-11-03T23:59:59Z', raw: [first, second] })
  const rendered = f.render(); const checked = assert.rejects(rendered, DashboardLocalDayChangedError)
  await flush(); f.clock('2026-11-04T00:00:01Z'); first.resolve({ day: '2026-11-03' }); await flush()
  f.clock('2026-11-05T00:00:01Z'); second.resolve({ day: '2026-11-04' }); await checked
  assert.equal(f.snapshots.length, 2); assert.deepEqual(f.writes, []); assert.equal(f.audits.length, 0)
})

test('authoritative completion and safety decisions pass through untouched; actionable marker requires a current owned Today model', async () => {
  const candidates = [{}, { noModel: true }, ...[
    { version: 2 }, { date: '2026-11-02' }, { timezone: 'America/Chicago' },
    { generatedAt: '2026-11-03T12:00:00Z' }, { clientId: 'OTHER-OWNER' }, { tier: 'phoenix' },
  ].map(modelOverrides => ({ modelOverrides }))]
  for (const complete of [false, true]) for (const options of candidates) {
    const logic = logicFixture({ symptoms: { redFlag: true, severity: 'severe' }, workoutDecision: { canTrain: false },
      execution: { workoutComplete: complete }, flameState: { streakEligible: complete } })
    const before = clone(logic), f = pageFixture({ logic, ...options }), result = await f.render()
    const dashboard = nodes(result, node => node.type === 'IgniteDashboard')[0]
    assert.equal(dashboard.props.logic, logic); assert.deepEqual(clone(logic), before)
    const marker = nodes(result, node => node.type === 'performance-marker' && node.props.stage === 'primary')[0]
    assert.equal(marker.props.actionable, !options.noModel && !options.modelOverrides)
    for (const entry of marker.props.timings) assert.deepEqual(Object.keys(entry).sort(), ['durationMs', 'stage', 'startMs'])
  }
})

function engineFixture({ stale = false, writeFailure = null, allowTraining = false } = {}) {
  let instant = Date.parse('2026-11-03T13:00:00Z')
  const writes = [], errors = [], events = [], first = deferred(), second = deferred()
  const inputs = { date: '2026-11-03', userId: owner.id, client, program: 'ignite', dailyPlan: { workoutCompleted: true },
    plannedWorkout: null, plannedExercises: [], recentRecovery: [], todayRecovery: {}, healthMetrics: { today: {}, recent: [] },
    bodyAssessment: {}, todayRecoveryActivities: [], monthlyAssessmentsDueCount: 0, nutritionLogs: [], nutritionTotals: [],
    strengthAssessments: [], photoUrls: [], phoenixTaskIds: [], workoutHistory: [], executionHistoryAvailable: true }
  const requirements = { missedDayCount: 0, requiredItems: { workoutOrMovement: true }, completedItems: { workoutOrMovement: true }, completionScore: 100, streakEligible: true }
  const pure = { numeric: value => Number(value || 0), nullableNumeric: value => value == null ? null : Number(value),
    runSymptomEngine: () => ({ redFlag: false, severity: 'none' }), runCapacityEngine: () => ({ status: 'moderate_capacity' }),
    runRecoveryEngine: () => ({ status: 'ready' }), runHydrationEngine: () => ({ percent: 100, status: 'ready' }),
    runNutritionEngine: () => ({ dataStatus: 'known' }), runFuelReadinessEngine: () => ({ status: 'ready' }),
    runCycleEngine: () => ({ phase: 'not_tracking' }), runPostureCompensationEngine: () => ({}),
    runWorkoutDecisionEngine: () => ({ canTrain: allowTraining, adjustmentLevel: allowTraining ? 'level_0_full_plan' : 'level_3_recovery_training', reasonForModification: 'Synthetic preserved pause' }),
    runFlameExecutionEngine: () => ({ requirements, streakEligible: true }) }
  const load = loader({ './engines': pure,
    './loadProgramLogicInputs': { loadProgramLogicInputs: () => { throw new Error('Prepared inputs must be used') } },
    '@/lib/workout-os/evaluateCapacityHistory': { evaluateCapacityHistory: () => ({ recoveryTarget: 1, exerciseTarget: 1 }) },
    '@/lib/workout-os/buildRecoveryActions': { buildRecoveryActions: () => [] },
    '@/lib/body-assessment/schedule': { getBodyAssessmentScheduleStatus: () => ({}) },
    '@/lib/assessment/getStrengthAssessmentStatus': { getStrengthAssessmentPeriod: () => ({}), strengthAssessmentStatusFromRecords: () => ({}) },
    '@/lib/assessment/strengthWorkout': { strengthCompletionForDay: () => false },
    '@/lib/recovery/todayCompletion': { recoveryCompletionEvidence: () => ({ available: true, records: [] }) },
  }, { errors, clock: () => instant })
  const { getProgramLogicEngine } = load('lib/dashboard/logic/getProgramLogicEngine.ts')
  const supabase = { from(table) { return { upsert(value) { events.push('write:' + table); writes.push({ table, value })
    if (writeFailure === table) return Promise.reject(new Error('Synthetic transport failure'))
    return table === 'dashboard_daily_recommendations' ? first.promise : second.promise } } } }
  return { inputs, writes, events, errors, first, second, advance(value) { instant = Date.parse(value) }, run() { return getProgramLogicEngine({ supabase, user: owner, client,
    program: 'ignite', preparedInputs: { async resolve() { events.push('resolve'); return inputs }, assertCurrent() { events.push('assert-current'); if (stale) throw new DashboardLocalDayChangedError('Changed before persistence') } },
    timings: { start(stage) { events.push('start:' + stage); return () => events.push('stop:' + stage) } } }) } }
}

test('production engine awaits recommendation then execution persistence, preserving saved owner/date and completion evidence', async () => {
  const f = engineFixture(); let finished = false; const result = f.run().then(value => { finished = true; return value })
  await flush(); assert.deepEqual(f.writes.map(row => row.table), ['dashboard_daily_recommendations'])
  assert.ok(f.events.indexOf('assert-current') < f.events.indexOf('write:dashboard_daily_recommendations'))
  f.first.resolve({ error: null }); await flush()
  assert.deepEqual(f.writes.map(row => row.table), ['dashboard_daily_recommendations', 'daily_execution_status'])
  assert.equal(finished, false)
  f.second.resolve({ error: null }); const output = await result
  assert.equal(output.execution.workoutComplete, true); assert.equal(output.workoutDecision.canTrain, false)
  for (const row of f.writes) { assert.equal(row.value.user_id, owner.id); assert.equal(row.value.client_id, client.client_id); assert.equal(row.value.log_date, '2026-11-03') }
  assert.equal(f.writes[1].value.streak_eligible, true)
  assert.ok(f.events.indexOf('stop:recommendation-persistence') < f.events.indexOf('start:execution-persistence'))
  assert.equal(f.events.at(-1), 'stop:execution-persistence')
})

test('production persistence transport failures retain existing fallback and stop timing; stale prepared state writes nothing', async () => {
  for (const failed of ['dashboard_daily_recommendations', 'daily_execution_status']) {
    const f = engineFixture({ writeFailure: failed }); const result = f.run(); await flush()
    if (failed !== 'dashboard_daily_recommendations') f.first.resolve({ error: null })
    await flush(); if (failed !== 'daily_execution_status') f.second.resolve({ error: null })
    const output = await result
    assert.equal(output.execution.workoutComplete, true); assert.equal(f.errors.length, 1)
    assert.deepEqual(f.writes.map(row => row.table), ['dashboard_daily_recommendations', 'daily_execution_status'])
    assert.ok(f.events.includes('stop:recommendation-persistence')); assert.ok(f.events.includes('stop:execution-persistence'))
  }
  const stale = engineFixture({ stale: true }); await assert.rejects(stale.run(), DashboardLocalDayChangedError)
  assert.deepEqual(stale.writes, []); assert.equal(stale.errors.length, 0)
})


test('one shared recovery reward is attached only after existing writes and never persists or completes recovery', async () => {
  const f = engineFixture({ allowTraining: true })
  f.inputs.recoveryRewardSources = { recoveryAvailable: true, workoutsAvailable: true,
    recoveryLog: { client_id: client.client_id, auth_user_id: owner.id, log_date: '2026-11-03', stress_level: 8 } }
  const result = f.run(); await flush()
  assert.equal('recoveryRewardSuggestion' in f.writes[0].value.recommendation_output, false)
  f.first.resolve({ error: null }); await flush(); f.second.resolve({ error: null })
  const output = await result
  assert.equal(output.recoveryRewardSuggestion.id, 'high-stress')
  assert.equal(output.recoveryRewardSuggestion.clientId, client.client_id)
  assert.equal(output.execution.recoveryComplete, false)
  assert.equal(f.writes.length, 2)
  assert.equal('recoveryRewardSuggestion' in f.writes[0].value.recommendation_output, false)
  assert.equal('recoveryRewardSuggestion' in f.writes[1].value, false)
})

test('recovery reward generation rechecks the member-local day after asynchronous persistence finishes', async () => {
  const f = engineFixture({ allowTraining: true })
  const result = f.run(); await flush(); f.first.resolve({ error: null }); await flush()
  f.advance('2026-11-04T00:00:00Z'); f.second.resolve({ error: null })
  const output = await result
  assert.equal(output.recoveryRewardSuggestion, undefined)
  assert.equal(f.writes.length, 2, 'The existing persistence sequence is unchanged.')
})
