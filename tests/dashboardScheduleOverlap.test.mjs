import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve, dirname, extname } from 'node:path'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
const flush = () => new Promise(setImmediate)
const plain = value => JSON.parse(JSON.stringify(value))
const nodes = (node, match) => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(item => nodes(item, match))
  : [...(match(node) ? [node] : []), ...nodes(node.props?.children, match)]
const client = { client_id: 'SYNTHETIC-OWNER', auth_user_id: 'owner', program: 'ignite', timezone: 'UTC',
  wake_time: '06:00', bed_time: '22:00', onboarding_data: {}, daily_structure_reviewed_at: '2026-11-03T10:00:00Z' }
const user = { id: 'owner' }
function event(id, start = '2026-11-03T15:00:00.000Z') {
  return { id, user_id: user.id, client_id: client.client_id, title: id, event_type: 'custom', source: 'manual',
    start_at: start, end_at: new Date(Date.parse(start) + 30 * 60_000).toISOString(), status: 'scheduled',
    flexibility_type: 'flexible', movable: true, approval_required: false, priority: 'medium', timezone: 'UTC',
    adjusted_start_at: null, adjusted_end_at: null, estimated_duration_minutes: 30 }
}

function fixture({ pending = false, rows = {}, calendarRows = [], now = '2026-11-03T13:00:00Z' } = {}) {
  let currentTime = Date.parse(now), timerId = 0, models = 0
  const queries = [], started = [], pendingReads = new Map(), timers = new Map(), errors = [], modules = new Map()
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [currentTime])) } static now() { return currentTime } }
  const calendar = deferred()
  function read(source, filters) {
    started.push(source)
    if (!pending) return Promise.resolve({ data: rows[source] || [], error: null })
    const result = deferred(); pendingReads.set(source, result); return result.promise
  }
  const db = { from(table) {
    const filters = [], query = { select(value) { filters.push(['select', value]); return query },
      eq(key, value) { filters.push(['eq', key, value]); return query }, or(value) { filters.push(['or', value]); return query },
      order(key, value) { filters.push(['order', key, value]); return query }, limit(value) { filters.push(['limit', value]); return query },
      maybeSingle: async () => { queries.push({ table, filters }); return { data: { program_json: {} }, error: null } },
      then(yes, no) { queries.push({ table, filters }); return read(table, filters).then(yes, no) } }
    return query
  } }
  const model = (_logic, schedule) => { models++; return { today: { activities: [], completed: 0, total: 0 },
    recommendation: { primary: { id: 'pause', category: 'none', title: 'Leave a little room for yourself', reason: 'Synthetic unchanged neutral state.', href: '/dashboard/schedule', completed: false } }, date: schedule.date } }
  const mocks = {
    'server-only': {},
    '@/lib/calendar/service': { importedScheduleEvents(...args) { started.push('calendar'); queries.push({ table: 'calendar', args }); return pending ? calendar.promise : Promise.resolve(calendarRows) } },
    '@/lib/day/getDailyExecutionPlan': { getDailyExecutionPlan: async () => { throw new Error('Unexpected daily-plan reload') } },
    '@/lib/dashboard/logic/getProgramLogicForClient': { getProgramLogicForClient: async () => { throw new Error('Unexpected logic reload') } },
    '@/lib/dashboard/buildTodayViewModel': { buildTodayViewModel: model },
  }
  function load(path, extra = {}) {
    path = resolve(path)
    if (modules.has(path) && !Object.keys(extra).length) return modules.get(path).exports
    const module = { exports: {} }; if (!Object.keys(extra).length) modules.set(path, module)
    const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
    runInNewContext(code, { module, exports: module.exports, Date: Clock, Map, Set, Intl, URL, URLSearchParams,
      console: { error: (...args) => errors.push(args) },
      setTimeout(callback, delay) { const id = ++timerId; timers.set(id, { callback, delay }); return id },
      clearTimeout(id) { timers.delete(id) },
      require(name) {
        if (name in extra) return extra[name]
        if (name in mocks) return mocks[name]
        if (name.endsWith('.module.css')) return { __esModule: true, default: { page: 'page' } }
        const target = name.startsWith('@/') ? resolve(name.slice(2)) : name.startsWith('.') ? resolve(dirname(path), name) : null
        if (!target) return require(name)
        if (extname(target) === '.json') return JSON.parse(readFileSync(target, 'utf8'))
        return load(extname(target) ? target : target + '.ts')
      },
    }, { filename: path })
    return module.exports
  }
  return { db, queries, started, timers, errors, load, get models() { return models },
    clock(next) { currentTime = Date.parse(next) },
    finish(source, data = rows[source] || []) { (source === 'calendar' ? calendar : pendingReads.get(source)).resolve(source === 'calendar' ? data : { data, error: null }) },
  }
}

test('authorized page starts all schedule reads before health logic resolves, and still awaits the authoritative engine', async () => {
  const view = fixture({ pending: true }), auth = deferred(), safety = deferred(), plan = deferred(), logic = deferred()
  const service = view.load('lib/schedule/service.ts'), context = { supabase: view.db, user, client }
  const requestReads = {}, calls = [], audits = []
  const Component = view.load('app/dashboard/program/[program]/page.tsx', {
    'next/navigation': { redirect(path) { throw new Error('REDIRECT ' + path) } }, 'next/link': { __esModule: true, default: 'a' },
    '@/lib/dashboard/getDashboardContext': { getDashboardContext: () => auth.promise },
    '@/lib/safety/getRecentSafetyFlags': { getRecentSafetyFlags: () => safety.promise },
    '@/lib/dashboard/requestReads': { createDashboardRequestReads(args) { assert.equal(args.user, user); assert.equal(args.client, client); return requestReads } },
    '@/lib/dashboard/logic/loadProgramLogicInputs': { DashboardLocalDayChangedError: class extends Error {},
      prepareProgramLogicInputs: () => ({ ready: Promise.resolve(), resolve: async () => ({}), assertCurrent() {} }) },
    '@/lib/day/getDailyExecutionPlan': { getDailyExecutionPlan(args) { assert.equal(args.requestReads, requestReads); calls.push('dailyPlan'); return plan.promise } },
    '@/lib/dashboard/logic/getProgramLogicEngine': { getProgramLogicEngine(args) { assert.equal(args.requestReads, requestReads); calls.push('logic'); return logic.promise } },
    '@/lib/cycle/getCycleStatus': { getCycleStatus: () => ({}) },
    '@/lib/program/getProgramWorkout': { getProgramWorkout: () => ({ programJson: {}, todaysWorkout: {}, cycleAdjustment: {}, adjustedExercises: [] }) },
    '@/lib/program/getSavedPlanState': { getSavedPlanState: () => ({ status: 'ready' }) },
    '@/lib/assessment/getMonthlyAssessmentStatus': { getMonthlyAssessmentStatus: async () => ({ due: false }) },
    '@/lib/legal/logRecommendationAudit': { logRecommendationAudit() { throw new Error('No audit execution in this synthetic render') } },
    '@/lib/schedule/service': service,
    '@/lib/nutrition/recipes/getPhoenixRecipeRecommendations': { getPhoenixRecipeRecommendations: () => [] },
    'next/server': { after: callback => audits.push(callback) },
    ...Object.fromEntries(['PlanOverview','EmberDashboard','IgniteDashboard','PhoenixDashboard','DashboardReadyShell']
      .map(name => ['@/components/program-dashboard/' + name, { __esModule: true, default: name }])),
    '@/components/legal/SafetyEscalationNotice': { __esModule: true, default: 'safety-notice' },
    '@/components/DashboardPerformance': { __esModule: true, default: 'performance-marker' },
  }).default
  const gate = Component({ params: Promise.resolve({ program: 'ignite' }) })
  await flush(); assert.equal(view.started.length, 0)
  auth.resolve(context); await flush(); assert.equal(view.started.length, 0, 'Safety gate must finish before source reads.')
  safety.resolve([])
  const page = await gate
  const personalized = nodes(page, node => typeof node.type === 'function' && node.type.name === 'PersonalizedDashboard')[0]
  assert.ok(personalized)
  let finished = false
  const rendering = personalized.type(personalized.props).then(value => { finished = true; return value })
  await flush()
  assert.deepEqual(new Set(view.started), new Set(['anastasis_schedule_events','client_schedule_blocks','calendar','schedule_occurrence_checkoffs']))
  assert.deepEqual(calls, ['dailyPlan'])
  plan.resolve({ date: '2026-11-03', timezone: 'UTC', timing: {} })
  await flush(); assert.deepEqual(calls, ['dailyPlan', 'logic'])
  for (const source of view.started) view.finish(source)
  await flush(); assert.equal(finished, false, 'Source completion cannot background the authoritative engine/persistence.')
  logic.resolve({ nutrition: {}, capacityStatus: { status: 'moderate_capacity' }, recoveryStatus: { status: 'ready' },
    fuelReadiness: { status: 'ready' }, symptoms: { severity: 'none' }, execution: {}, assessments: {}, hydration: {}, workoutDecision: {}, cycle: {}, insight: {}, flameState: {}, engineVersion: 'synthetic' })
  const result = await rendering
  assert.equal(view.models, 1)
  assert.equal(view.started.length, 4, 'Prepared sources are reused instead of issuing another four reads.')
  assert.equal(nodes(result, node => node.type === 'IgniteDashboard').length, 1)
  assert.equal(audits.length, 1, 'The existing audit remains registered after the awaited engine result.')
})

test('prepared and direct source assembly have identical results and owner/date/filter semantics without mutating the source snapshot', async () => {
  const rows = { anastasis_schedule_events: [event('saved')], client_schedule_blocks: [], schedule_occurrence_checkoffs: [] }
  const a = fixture({ rows, calendarRows: [event('calendar', '2026-11-03T17:00:00Z')] }), b = fixture({ rows, calendarRows: [event('calendar', '2026-11-03T17:00:00Z')] })
  const direct = a.load('lib/schedule/service.ts'), prepared = b.load('lib/schedule/service.ts')
  const args = { user, client, date: '2026-11-03', includeVirtualPlan: false }
  const snapshot = await prepared.loadDailyScheduleSources({ ...args, supabase: b.db })
  const before = plain({ persistedEvents: snapshot.persistedEvents, calendarEvents: snapshot.calendarEvents, checkoffs: snapshot.checkoffs })
  const one = await direct.getDailyScheduleState({ ...args, supabase: a.db })
  const two = await prepared.getDailyScheduleState({ ...args, supabase: b.db, sources: snapshot })
  assert.deepEqual(plain(two), plain(one))
  assert.deepEqual(plain({ persistedEvents: snapshot.persistedEvents, calendarEvents: snapshot.calendarEvents, checkoffs: snapshot.checkoffs }), before)
  assert.deepEqual(plain(b.queries), plain(a.queries))
  assert.equal(b.started.length, 4)
  for (const query of b.queries.filter(query => query.table !== 'calendar')) {
    assert.ok(query.filters.some(filter => filter[0] === 'eq' && filter[1] === 'client_id' && filter[2] === client.client_id))
    assert.ok(query.filters.some(filter => filter[0] === 'eq' && filter[1] === 'user_id' && filter[2] === user.id))
  }
  assert.match(b.queries.find(query => query.table === 'anastasis_schedule_events').filters.find(filter => filter[0] === 'or')[1], /2026-11-03T00:00:00\.000Z.*2026-11-04T00:00:00\.000Z|2026-11-04T00:00:00\.000Z.*2026-11-03T00:00:00\.000Z/)
})

test('the two-second optional-source limit settles a stalled calendar before logic and never implies conflict-free time', async () => {
  const view = fixture({ pending: true }), service = view.load('lib/schedule/service.ts')
  const sources = service.loadDailyScheduleSources({ supabase: view.db, user, client, date: '2026-11-03', sourceTimeoutMs: 2000 })
  await flush()
  for (const source of view.started.filter(source => source !== 'calendar')) view.finish(source)
  await flush()
  assert.equal(view.timers.size, 1)
  const timeout = [...view.timers.values()][0]; assert.equal(timeout.delay, 2000); timeout.callback()
  const snapshot = await sources
  assert.deepEqual([...snapshot.unavailableSources], ['calendar'])
  const state = await service.getDailyScheduleState({ supabase: view.db, user, client, date: '2026-11-03', includeVirtualPlan: false, sources: snapshot })
  assert.deepEqual(plain(state.openWindows), [])
  assert.deepEqual(plain(state.adjustments), [])
  assert.equal(state.nextAction.can_defer, false)
  assert.equal(view.errors.length, 1)
  assert.equal(view.started.length, 4)
  view.finish('calendar'); await flush()
  assert.deepEqual([...state.unavailableSources], ['calendar'], 'A late calendar response cannot mutate the assembled result.')
})

test('a prepared source snapshot cannot be reused for another reader, account, selected day or timezone', async () => {
  const view = fixture(), service = view.load('lib/schedule/service.ts')
  const source = await service.loadDailyScheduleSources({ supabase: view.db, user, client, date: '2026-11-03' })
  const common = { supabase: view.db, user, client, includeVirtualPlan: false, sources: source, date: '2026-11-03' }
  for (const patch of [{ supabase: {} }, { user: { id: 'other' } }, { client: { ...client, client_id: 'OTHER' } },
    { date: '2026-11-04' }, { client: { ...client, timezone: 'America/Chicago' } }]) {
    await assert.rejects(service.getDailyScheduleState({ ...common, ...patch }), /do not match this account and selected day/)
  }
  assert.equal(view.started.length, 4)
})

test('an implicit Today snapshot crossing local midnight reloads only the new day sources and does not copy old daily completion', async () => {
  const view = fixture({ now: '2026-11-03T23:59:59Z' }), service = view.load('lib/schedule/service.ts')
  const snapshot = await service.loadDailyScheduleSources({ supabase: view.db, user, client })
  assert.equal(snapshot.day.date, '2026-11-03')
  view.clock('2026-11-04T00:00:01Z')
  const state = await service.getDailyScheduleState({ supabase: view.db, user, client, sources: snapshot,
    dailyPlan: { date: '2026-11-03', timezone: 'UTC', timing: {} }, logic: {} })
  assert.equal(state.date, '2026-11-04')
  assert.equal(state.todayViewModel, undefined)
  assert.equal(view.models, 0)
  assert.equal(view.started.length, 8)
  const checkoffDates = view.queries.filter(query => query.table === 'schedule_occurrence_checkoffs')
    .map(query => query.filters.find(filter => filter[0] === 'eq' && filter[1] === 'occurrence_date')[2])
  assert.deepEqual(checkoffDates, ['2026-11-03', '2026-11-04'])
})
