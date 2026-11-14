import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { importTs } from './typescriptModule.mjs'

const { createTodayBootstrap, loadTodayBootstrap } = await importTs('lib/dashboard/todayBootstrap.ts')
const context = { user: { id: 'page-owner' }, client: { client_id: 'PAGE-CLIENT', auth_user_id: 'page-owner',
  program: 'ignite', first_name: 'Synthetic', timezone: 'America/Los_Angeles' }, program: 'ignite' }
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
const nodes = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes)
  : [tree, ...nodes(tree.props?.children)]
class TodayAccessError extends Error {
  constructor(message, status, flags) { super(message); this.status = status; this.flags = flags }
}
class DashboardLocalDayChangedError extends Error {}

// Execute the shared server page while keeping its authenticated gate and small
// current-day read under promise control. Use the real bootstrap; children stay
// opaque, just as React elements remain unmounted until their parent resolves.
function pageHarness({ gate = Promise.resolve(context), enrichment, checkIn = Promise.resolve({ data: null, error: null }) } = {}) {
  const calls = { gate: [], seeds: [], enrichment: [], reads: [], signals: [], timings: [] }
  const supabase = { from(table) {
    assert.equal(table, 'recovery_logs', 'Today server bootstrap reads only the required completion table')
    const read = { table, operations: [] }; calls.reads.push(read)
    const builder = { select(...args) { read.operations.push(['select', ...args]); return builder },
      eq(...args) { read.operations.push(['eq', ...args]); return builder },
      abortSignal(signal) { calls.signals.push(signal); return builder },
      maybeSingle() { return checkIn } }
    return builder
  } }
  const module = { exports: {} }
  const path = 'components/program-dashboard/ProgramDashboardPage.tsx'
  const code = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText
  runInNewContext(code, { module, exports: module.exports, console,
    require(name) {
      if (name === 'react') return { Suspense: 'Suspense' }
      if (name === 'react/jsx-runtime') return { jsx: (type, props, key) => ({ type, props, key }), jsxs: (type, props, key) => ({ type, props, key }) }
      if (name === 'next/navigation') return { redirect(destination) { const error = new Error('redirect'); error.destination = destination; throw error } }
      if (name === '@/lib/dashboard/todayAccess') return { TodayAccessError,
        getTodayAccessContext(expected) { calls.gate.push(expected); return gate } }
      if (name === '@/lib/dashboard/todayBootstrap') return {
        createTodayBootstrap(value) { calls.seeds.push(value); return createTodayBootstrap(value) },
        loadTodayBootstrap(value) { calls.seeds.push(value); return loadTodayBootstrap({ ...value, supabase, now: () => new Date('2026-11-14T16:00:00Z') }) },
      }
      if (name === '@/lib/dashboard/loadTodayEnrichment') return {
        loadTodayEnrichment(value) { calls.enrichment.push(value); return enrichment || Promise.resolve({ logic: {}, schedule: {} }) },
      }
      if (name === '@/lib/dashboard/logic/loadProgramLogicInputs') return { DashboardLocalDayChangedError }
      if (name === '@/lib/performance/dashboardStartupRequest') return { getDashboardStartupTiming: () => ({
        measure(stage, task) { calls.timings.push(stage); return task() },
        start(stage) { return () => calls.timings.push(stage) },
        snapshot: () => calls.timings.map(stage => ({ stage, startMs: 0, durationMs: 1 })),
      }) }
      if (name.endsWith('.module.css')) return { __esModule: true, default: { page: 'page-style' } }
      if (name.startsWith('@/components/')) return { __esModule: true, default: name.split('/').at(-1) }
      assert.fail(`Unexpected page dependency: ${name}`)
    },
  }, { filename: path })
  return { calls, render: (view = 'today') => module.exports.default({ params: Promise.resolve({ program: 'ignite' }), searchParams: Promise.resolve({ view }) }) }
}

test('Today waits only for current gates and its small owner-bound check-in read, then server renders the verified action', async () => {
  const held = deferred(), checkIn = deferred(), page = pageHarness({ gate: held.promise, checkIn: checkIn.promise })
  let settled = false
  const loading = page.render().then(result => { settled = true; return result })
  await new Promise(setImmediate)
  assert.equal(page.calls.gate.length, 1)
  assert.equal(page.calls.gate[0].program, 'ignite')
  assert.equal(settled, false, 'No member-facing element can mount before the page resolves')
  assert.equal(page.calls.seeds.length, 0)
  assert.equal(page.calls.reads.length, 0)
  assert.equal(page.calls.enrichment.length, 0)
  assert.equal(page.calls.signals.length, 0)
  held.resolve(context)
  await new Promise(setImmediate)
  assert.equal(page.calls.seeds.length, 1)
  assert.equal(settled, false, 'The server action must wait for its actual completion evidence')
  assert.deepEqual(page.calls.reads, [{ table: 'recovery_logs', operations: [
    ['select', 'check_in_completed_at'], ['eq', 'client_id', context.client.client_id],
    ['eq', 'auth_user_id', context.user.id], ['eq', 'log_date', '2026-11-14'],
  ] }])
  assert.equal(page.calls.signals.length, 1, 'The initial completion read receives an abort signal for its bounded server budget')
  assert.equal(page.calls.enrichment.length, 0)
  checkIn.resolve({ data: null, error: null })
  const result = await loading
  const startup = nodes(result).find(node => node.type === 'TodayStartup')
  assert.equal(result.type, 'main')
  assert.ok(startup)
  assert.equal(page.calls.seeds.length, 1)
  assert.equal(startup.props.seed.ownerUserId, context.user.id)
  assert.equal(startup.props.seed.clientId, context.client.client_id)
  assert.equal(startup.props.seed.checkIn.status, 'ready')
  assert.equal(startup.props.seed.checkIn.completed, false)
  assert.deepEqual(startup.props.seed.day.sections.map(section => section.id), ['morning', 'midday', 'evening'])
  assert.equal(startup.props.seed.day.sections[0].items[0].href, '/dashboard/check-in')
  assert.ok(startup.props.seed.day.sections.slice(1).every(section => section.items.length === 0))
  assert.equal(page.calls.enrichment.length, 0, 'Today server render never starts or awaits the full engine')
  assert.deepEqual(startup.props.startupTimings.map(entry => entry.stage), ['routing', 'context', 'bootstrap', 'response-ready'])
  assert.equal(nodes(result).some(node => node.type === 'Suspense' || node.type === 'DashboardReadyShell'), false)
})

test('the server seed preserves current completion and returns honest local errors without loading the full engine', async () => {
  for (const [reply, status, completed] of [
    [{ data: { check_in_completed_at: '2026-11-14T15:00:00Z' }, error: null }, 'ready', true],
    [{ data: null, error: { message: 'Synthetic read unavailable' } }, 'error', null],
  ]) {
    const page = pageHarness({ checkIn: Promise.resolve(reply) }), result = await page.render()
    const startup = nodes(result).find(node => node.type === 'TodayStartup')
    assert.ok(startup)
    assert.equal(startup.props.seed.checkIn.status, status)
    assert.equal(startup.props.seed.checkIn.completed, completed)
    assert.equal(startup.props.seed.day.sections[0].items.length, 0)
    assert.equal(page.calls.reads.length, 1)
    assert.equal(page.calls.enrichment.length, 0)
  }
})

test('expired session and blocked membership, onboarding or legal gates cannot begin check-in or enrichment work', async () => {
  for (const destination of ['/login', '/dashboard/payment-issue', '/dashboard/onboarding/profile', '/legal/acceptance']) {
    const held = deferred(), page = pageHarness({ gate: held.promise }), loading = page.render()
    const error = Object.assign(new Error('Blocked current access'), { destination })
    held.reject(error)
    await assert.rejects(loading, thrown => thrown === error)
    assert.equal(page.calls.seeds.length, 0)
    assert.equal(page.calls.reads.length, 0)
    assert.equal(page.calls.enrichment.length, 0)
  }
})

test('a safety escalation renders only its notice and a failed safety verification exposes no Today layout', async () => {
  const flags = [{ code: 'chest_pain', label: 'Chest pain', urgency: 'emergency' }]
  const held = deferred(), escalation = pageHarness({ gate: held.promise })
  const loading = escalation.render()
  held.reject(new TodayAccessError('Review safety guidance.', 409, flags))
  const notice = await loading
  assert.equal(notice.type, 'SafetyEscalationNotice')
  assert.equal(notice.props.flags, flags)
  assert.equal(escalation.calls.seeds.length, 0)
  assert.equal(escalation.calls.enrichment.length, 0)

  const lookup = deferred(), failed = pageHarness({ gate: lookup.promise })
  const failedLoading = failed.render()
  const error = new TodayAccessError('Safety could not be verified.', 503)
  lookup.reject(error)
  await assert.rejects(failedLoading, thrown => thrown === error)
  assert.equal(failed.calls.seeds.length, 0)
  assert.equal(failed.calls.enrichment.length, 0)
})

test('Plan stays a separate suspended server branch and does not mount Today startup', async () => {
  const held = deferred(), page = pageHarness({ enrichment: held.promise })
  const result = await page.render('plan')
  assert.equal(nodes(result).some(node => node.type === 'TodayStartup'), false)
  assert.equal(page.calls.seeds.length, 0)
  const boundary = nodes(result).find(node => node.type === 'Suspense')
  assert.ok(boundary)
  assert.equal(boundary.props.fallback.type, 'DashboardReadyShell')
  assert.equal(boundary.props.fallback.props.showStreak, false)
  const savedPlan = boundary.props.children
  const loading = savedPlan.type(savedPlan.props)
  assert.equal(page.calls.enrichment.length, 1)
  const data = { logic: { marker: 'verified-logic' }, schedule: { marker: 'verified-schedule' } }
  held.resolve(data)
  const plan = await loading
  assert.equal(plan.type, 'PlanOverview')
  assert.equal(plan.props.logic, data.logic)
  assert.equal(plan.props.schedule, data.schedule)
})
