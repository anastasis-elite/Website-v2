import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const plain = value => JSON.parse(JSON.stringify(value))
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }

function fixture({ performance } = {}) {
  const modules = new Map(), frames = new Map(), allFrames = new Map(), effects = [], listeners = new Map()
  let frameId = 0
  const window = {
    requestAnimationFrame(callback) { const id = ++frameId; frames.set(id, callback); allFrames.set(id, callback); return id },
    cancelAnimationFrame(id) { frames.delete(id) },
    addEventListener(type, callback) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(callback) },
    removeEventListener(type, callback) { listeners.get(type)?.delete(callback) },
  }
  function load(path) {
    path = resolve(path)
    if (modules.has(path)) return modules.get(path).exports
    const module = { exports: {} }; modules.set(path, module)
    const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    } }).outputText
    runInNewContext(code, { module, exports: module.exports, performance, window, require(name) {
      if (name === 'server-only') return {}
      if (name === 'react') return { useEffect(callback, deps) { effects.push({ callback, deps }) } }
      const target = name.startsWith('@/') ? name.slice(2) : resolve(dirname(path), name)
      return load(target + '.ts')
    } }, { filename: path })
    return module.exports
  }
  return { load, frames, allFrames, effects, listeners,
    emit(type) { for (const callback of listeners.get(type) || []) callback() },
    frame() { const [id, callback] = frames.entries().next().value; frames.delete(id); callback() },
    component(props) { load('components/DashboardPerformance.tsx').default(props); return effects.at(-1).callback() },
  }
}

function browserPerformance({ navigation } = {}) {
  const entries = [], calls = []
  let now = 100
  return { entries, calls, now: () => now++,
    getEntriesByType(type) { assert.equal(type, 'navigation', 'No resource URLs or request details may be read.'); return navigation ? [navigation] : [] },
    mark(name, options) { const entry = { name, startTime: now++, ...options }; entries.push(entry); calls.push(['mark', name, plain(options || {})]) },
    clearMarks(name) { calls.push(['clearMarks', name]); for (let index = entries.length - 1; index >= 0; index--) if (entries[index].name === name) entries.splice(index, 1) },
    clearMeasures(name) { calls.push(['clearMeasures', name]); for (let index = entries.length - 1; index >= 0; index--) if (entries[index].name === name) entries.splice(index, 1) },
    getEntriesByName(name) { return entries.filter(entry => entry.name === name) },
    measure(name, options) { entries.push({ name, startTime: now++, ...options }); calls.push(['measure', name, plain(options || {})]) },
  }
}

test('request timing uses the exact static allowlist and strips extra properties at the browser boundary', () => {
  const api = fixture().load('lib/performance/dashboardTimingTypes.ts')
  assert.deepEqual([...api.DASHBOARD_TIMING_STAGES], ['routing', 'context', 'auth', 'member-profile', 'current-profile', 'legal', 'safety', 'bootstrap', 'response-ready', 'plan', 'logic-sources', 'schedule-sources', 'logic', 'schedule', 'recommendation-persistence', 'execution-persistence'])
  const sanitized = api.sanitizeDashboardTimings([
    { stage: 'plan', startMs: 1.123456, durationMs: 2.987654, user: 'discarded', payload: { health: 'discarded' } },
    { stage: 'owner-id', startMs: 1, durationMs: 2 }, { stage: 'plan', startMs: -1, durationMs: 2 },
    { stage: 'plan', startMs: 1, durationMs: Infinity }, { stage: 'plan', startMs: '1', durationMs: 2 },
    { stage: 'context', startMs: 1e100, durationMs: 1e100 },
  ])
  assert.deepEqual(plain(sanitized), [{ stage: 'plan', startMs: 1.123, durationMs: 2.988 }, { stage: 'context', startMs: 86_400_000, durationMs: 86_400_000 }])
  assert.equal(api.sanitizeDashboardTimings(Array.from({ length: 100 }, () => ({ stage: 'plan', startMs: 0, durationMs: 1 }))).length, 40)
  assert.deepEqual(plain(api.sanitizeDashboardTimings({ owner: 'discarded' })), [])
})

test('disabled diagnostics never call the clock or change returned values and rejection identities', async () => {
  const { createDashboardRequestTiming } = fixture().load('lib/performance/dashboardRequest.ts')
  let calls = 0
  const timing = createDashboardRequestTiming({ enabled: false, now() { calls++; throw new Error('Clock must not run') } })
  const value = {}, failure = new Error('Synthetic failure')
  timing.start('plan')()
  assert.equal(await timing.measure('plan', () => value), value)
  await assert.rejects(timing.measure('logic', () => { throw failure }), error => error === failure)
  await assert.rejects(timing.measure('logic', () => Promise.reject(failure)), error => error === failure)
  assert.equal(calls, 0)
  assert.deepEqual(plain(timing.snapshot()), [])
})

test('missing, throwing or invalid timing clocks cannot alter authoritative tasks', async () => {
  const { createDashboardRequestTiming } = fixture().load('lib/performance/dashboardRequest.ts')
  for (const now of [undefined, () => { throw new Error('Restricted clock') }, () => NaN, () => Infinity]) {
    const timing = createDashboardRequestTiming(now ? { now } : {})
    const value = {}, failure = new Error('Original task failure')
    assert.equal(await timing.measure('plan', () => Promise.resolve(value)), value)
    await assert.rejects(timing.measure('plan', () => Promise.reject(failure)), error => error === failure)
    assert.deepEqual(plain(timing.snapshot()), [])
  }
  let count = 0
  const stoppedClock = createDashboardRequestTiming({ now() { if (++count > 2) throw new Error('Stop failed'); return count } })
  assert.equal(await stoppedClock.measure('plan', () => 42), 42)
  assert.deepEqual(plain(stoppedClock.snapshot()), [])
})

test('request scopes, snapshot copies and repeated stops remain isolated and bounded', () => {
  const { createDashboardRequestTiming } = fixture().load('lib/performance/dashboardRequest.ts')
  let time = 100
  const first = createDashboardRequestTiming({ now: () => time }), second = createDashboardRequestTiming({ now: () => time })
  time = 110; const stop = first.start('plan'); time = 130; stop(); stop()
  const result = first.snapshot(); result[0].durationMs = 999; result.push({ stage: 'context', startMs: 1, durationMs: 2 })
  assert.deepEqual(plain(first.snapshot()), [{ stage: 'plan', startMs: 10, durationMs: 20 }])
  assert.deepEqual(plain(second.snapshot()), [])
  first.start('invalid-stage')()
  for (let index = 0; index < 50; index++) first.start('logic')()
  assert.equal(first.snapshot().length, 40)
  time = 90; const backward = second.start('safety'); time = 80; backward()
  assert.deepEqual(plain(second.snapshot()), [{ stage: 'safety', startMs: 0, durationMs: 0 }])
})

test('deferred independent work produces scalar overlap evidence without changing resolution order', async () => {
  const { createDashboardRequestTiming } = fixture().load('lib/performance/dashboardRequest.ts')
  let time = 10
  const timing = createDashboardRequestTiming({ now: () => time }), plan = deferred(), sources = deferred(), completed = []
  time = 15; const a = timing.measure('plan', () => plan.promise).then(value => completed.push(value))
  time = 20; const b = timing.measure('logic-sources', () => sources.promise).then(value => completed.push(value))
  time = 30; sources.resolve('sources'); await b
  assert.deepEqual(completed, ['sources'])
  time = 50; plan.resolve('plan'); await a
  assert.deepEqual(completed, ['sources', 'plan'])
  assert.deepEqual(plain(timing.snapshot()), [{ stage: 'logic-sources', startMs: 10, durationMs: 10 }, { stage: 'plan', startMs: 5, durationMs: 35 }])
})

test('browser publication has only static names and numeric detail, with bounded replacement and owner cleanup', () => {
  const performance = browserPerformance(), { publishDashboardRequestTimings } = fixture({ performance }).load('lib/performance/dashboard.ts')
  const oldCleanup = publishDashboardRequestTimings([{ stage: 'plan', startMs: 1, durationMs: 3, owner: 'discarded' }, { stage: 'arbitrary-url', startMs: 0, durationMs: 1 }], true)
  const server = performance.entries.find(entry => entry.name === 'anastasis:today:server:plan')
  assert.deepEqual(plain(server.detail), { startMs: 1, durationMs: 3 })
  assert.ok(performance.entries.some(entry => entry.name === 'anastasis:today:actionable'))
  const nextCleanup = publishDashboardRequestTimings([{ stage: 'context', startMs: 0, durationMs: 2 }], false)
  oldCleanup()
  assert.deepEqual(performance.entries.map(entry => entry.name), ['anastasis:today:server:context'])
  nextCleanup(); nextCleanup()
  assert.deepEqual(performance.entries, [])
})

test('unsupported browser timing APIs are harmless and existing shell/resume counters remain compatible', () => {
  for (const performance of [undefined, {}, { mark() { throw new Error('Restricted') }, clearMarks() { throw new Error('Restricted') } }]) {
    const api = fixture({ performance }).load('lib/performance/dashboard.ts')
    assert.doesNotThrow(() => { api.markDashboardStage('primary'); api.publishDashboardRequestTimings([{ stage: 'plan', startMs: 0, durationMs: 2 }], true)() })
  }
  const performance = browserPerformance(), api = fixture({ performance }).load('lib/performance/dashboard.ts')
  api.markDashboardStage('shell'); api.markDashboardStage('shell')
  api.markDashboardStage('resume'); api.markDashboardStage('secondary'); api.markDashboardStage('secondary')
  assert.equal(performance.getEntriesByName('anastasis:shell').length, 1)
  assert.equal(performance.getEntriesByName('anastasis:resume-to-secondary').length, 1)
  api.markDashboardStage('resume'); api.markDashboardStage('secondary')
  assert.equal(performance.getEntriesByName('anastasis:resume-to-secondary').length, 2)
})

test('a committed primary render publishes after two frames and only explicit actionable true marks readiness', () => {
  for (const actionable of [undefined, false, true]) {
    const performance = browserPerformance(), view = fixture({ performance })
    const cleanup = view.component({ stage: 'primary', timings: [{ stage: 'plan', startMs: 0, durationMs: 10 }], actionable })
    assert.deepEqual(performance.entries, [])
    view.frame(); assert.deepEqual(performance.entries, [])
    view.frame()
    assert.equal(performance.getEntriesByName('anastasis:today:server:plan').length, 1)
    assert.equal(performance.getEntriesByName('anastasis:today:actionable').length, actionable === true ? 1 : 0)
    cleanup()
    assert.equal(performance.entries.filter(entry => entry.name.startsWith('anastasis:today:')).length, 0)
  }
})

test('unmount/navigation/logout cancellation fences even escaped late frame callbacks', () => {
  for (const firstFrameFinished of [false, true]) {
    const performance = browserPerformance(), view = fixture({ performance })
    const cleanup = view.component({ stage: 'primary', timings: [{ stage: 'plan', startMs: 0, durationMs: 10 }], actionable: true })
    if (firstFrameFinished) view.frame()
    const escaped = [...view.frames.values()]
    cleanup()
    for (const callback of escaped) callback()
    assert.equal(view.frames.size, 0)
    assert.deepEqual(performance.entries, [])
  }
})

test('each Today startup resets bounded milestone records and measures relative to the current start', () => {
  const performance = browserPerformance(), api = fixture({ performance }).load('lib/performance/dashboard.ts')
  const stages = ['today-layout-visible', 'today-carousel-interactive', 'today-check-in-ready', 'today-check-in-clickable']
  api.beginTodayStartup()
  for (const stage of stages) { api.markDashboardStage(stage); api.markDashboardStage(stage) }
  assert.equal(performance.getEntriesByName('anastasis:today:start').length, 1)
  for (const stage of stages) {
    assert.equal(performance.getEntriesByName(`anastasis:${stage}`).length, 1)
    assert.deepEqual(plain(performance.getEntriesByName(`anastasis:today:start-to-${stage}`)[0].start), 'anastasis:today:start')
    assert.equal(performance.getEntriesByName(`anastasis:navigation-to-${stage}`).length, 1)
  }
  api.beginTodayStartup()
  assert.deepEqual(performance.entries.map(entry => entry.name), ['anastasis:today:start', 'anastasis:today-hydrated', 'anastasis:navigation-to-today-hydrated', 'anastasis:today:start-to-today-hydrated'])
  api.markDashboardStage('today-layout-visible')
  assert.equal(performance.getEntriesByName('anastasis:today:start-to-today-layout-visible').length, 1)
  assert.ok(performance.entries.every(entry => entry.detail === undefined), 'Milestone records contain no member context')
  for (const unavailable of [undefined, {}, { clearMarks() { throw new Error('Restricted timing') } }]) {
    assert.doesNotThrow(() => fixture({ performance: unavailable }).load('lib/performance/dashboard.ts').beginTodayStartup())
  }
})

test('the committed Today effect separates startup server work and hydration from later enrichment with owner cleanup', () => {
  const performance = browserPerformance(), api = fixture({ performance }).load('lib/performance/dashboard.ts')
  const first = api.beginTodayStartup([
    { stage: 'auth', startMs: 3, durationMs: 20, userId: 'discarded' },
    { stage: 'response-ready', startMs: 80, durationMs: 0, date: 'discarded' },
    { stage: 'private-route', startMs: 0, durationMs: 1 },
  ])
  assert.equal(performance.getEntriesByName('anastasis:today-hydrated').length, 1)
  assert.deepEqual(plain(performance.getEntriesByName('anastasis:today:startup:server:auth')[0].detail), { startMs: 3, durationMs: 20 })
  const enrichment = api.publishDashboardRequestTimings([{ stage: 'logic', startMs: 0, durationMs: 250 }], true)
  assert.equal(performance.getEntriesByName('anastasis:today:startup:server:auth').length, 1, 'Enrichment must not erase startup evidence.')
  const next = api.beginTodayStartup([{ stage: 'bootstrap', startMs: 3, durationMs: 2 }])
  first()
  assert.equal(performance.getEntriesByName('anastasis:today:startup:server:bootstrap').length, 1)
  assert.equal(performance.getEntriesByName('anastasis:today:startup:server:auth').length, 0)
  assert.equal(performance.getEntriesByName('anastasis:today:server:logic').length, 1)
  next(); enrichment()
  assert.equal(performance.entries.filter(entry => entry.name.startsWith('anastasis:today:') || entry.name.startsWith('anastasis:today-')).length, 0)
  assert.doesNotMatch(JSON.stringify(performance.entries), /discarded|private-route/)
})

test('document response timings read only bounded navigation scalars once and never describe warm RSC responses', () => {
  const navigation = { type: 'navigate', activationStart: 0, requestStart: 5, responseStart: 150, responseEnd: 180,
    get name() { throw new Error('A document URL must not be inspected.') } }
  const performance = browserPerformance({ navigation }), api = fixture({ performance }).load('lib/performance/dashboard.ts')
  api.beginTodayStartup()
  assert.deepEqual(plain(performance.getEntriesByName('anastasis:document-response-start')[0]), { name: 'anastasis:document-response-start', startTime: 150 })
  assert.deepEqual(plain(performance.getEntriesByName('anastasis:document-response-download')[0]), { name: 'anastasis:document-response-download', startTime: performance.getEntriesByName('anastasis:document-response-download')[0].startTime, start: 150, end: 180 })
  api.beginTodayStartup()
  assert.equal(performance.getEntriesByName('anastasis:document-response-start').length, 1)
  assert.equal(performance.getEntriesByName('anastasis:document-response-end').length, 1)
  assert.ok(performance.entries.filter(entry => entry.name.includes('document')).every(entry => entry.detail === undefined))
  for (const overrides of [{ type: 'back_forward' }, { activationStart: 1 }, { responseEnd: 0 }, { responseStart: Infinity }, { responseEnd: 86_400_001 }, { responseStart: 4 }]) {
    const browser = browserPerformance({ navigation: { type: 'navigate', activationStart: 0, requestStart: 5, responseStart: 150, responseEnd: 180, ...overrides } })
    fixture({ performance: browser }).load('lib/performance/dashboard.ts').beginTodayStartup()
    assert.equal(browser.entries.filter(entry => entry.name.includes('document')).length, 0)
  }
})

test('same-origin middleware timing accepts only static auth/context names and finite scalar durations', () => {
  const performance = browserPerformance({ navigation: { type: 'navigate', requestStart: 5, responseStart: 150, responseEnd: 180,
    serverTiming: [
      { name: 'today_mw_auth', duration: 10.123456, get description() { throw new Error('Descriptions cannot be copied.') } },
      { name: 'today_mw_context', duration: 23.5, description: 'discarded private content' },
      { name: 'unknown-secret', duration: 1 },
    ] } })
  const api = fixture({ performance }).load('lib/performance/dashboard.ts')
  api.beginTodayStartup(); api.beginTodayStartup()
  const auth = performance.getEntriesByName('anastasis:today:middleware:auth')
  assert.equal(auth.length, 1)
  assert.deepEqual(plain(auth[0].detail), { durationMs: 10.123 })
  assert.deepEqual(plain(performance.getEntriesByName('anastasis:today:middleware:context')[0].detail), { durationMs: 23.5 })
  assert.doesNotMatch(JSON.stringify(performance.entries), /today_mw_|discarded|unknown-secret|description/)
  for (const duration of [-1, NaN, Infinity, '123', 86_400_001]) {
    const browser = browserPerformance({ navigation: { type: 'navigate', requestStart: 1, responseStart: 2, responseEnd: 3,
      serverTiming: [{ name: 'today_mw_auth', duration }] } })
    fixture({ performance: browser }).load('lib/performance/dashboard.ts').beginTodayStartup()
    assert.equal(browser.getEntriesByName('anastasis:today:middleware:auth').length, 0)
  }
})

test('a streamed document observes response completion once and abandoned load callbacks cannot publish', () => {
  const navigation = { type: 'navigate', requestStart: 5, responseStart: 150, responseEnd: 0 }
  const performance = browserPerformance({ navigation }), view = fixture({ performance })
  const api = view.load('lib/performance/dashboard.ts'), cleanup = api.beginTodayStartup()
  assert.equal(performance.getEntriesByName('anastasis:document-response-end').length, 0)
  assert.equal(view.listeners.get('load').size, 1)
  navigation.responseEnd = 180
  view.emit('load'); view.emit('load')
  assert.equal(performance.getEntriesByName('anastasis:document-response-end').length, 1)
  cleanup()
  assert.equal(view.listeners.get('load').size, 0)

  const pending = { type: 'navigate', requestStart: 5, responseStart: 150, responseEnd: 0 }
  const canceledPerformance = browserPerformance({ navigation: pending }), canceled = fixture({ performance: canceledPerformance })
  const stop = canceled.load('lib/performance/dashboard.ts').beginTodayStartup()
  const escaped = [...canceled.listeners.get('load')]
  stop(); pending.responseEnd = 180
  for (const callback of escaped) callback()
  assert.equal(canceledPerformance.getEntriesByName('anastasis:document-response-end').length, 0)
  assert.equal(canceled.listeners.get('load').size, 0)
})

test('Today layout, carousel, verified check-in status and clickable milestones require two committed frames and cancel on unmount', () => {
  for (const stage of ['today-layout-visible', 'today-carousel-interactive', 'today-check-in-ready', 'today-check-in-clickable']) {
    const performance = browserPerformance(), view = fixture({ performance })
    view.load('lib/performance/dashboard.ts').beginTodayStartup()
    const cleanup = view.component({ stage, snapshot: 'current', timings: [{ stage: 'plan', startMs: 0, durationMs: 4 }], actionable: true })
    assert.equal(performance.getEntriesByName(`anastasis:${stage}`).length, 0)
    view.frame()
    assert.equal(performance.getEntriesByName(`anastasis:${stage}`).length, 0)
    view.frame()
    assert.equal(performance.getEntriesByName(`anastasis:${stage}`).length, 1)
    assert.equal(performance.getEntriesByName(`anastasis:today:start-to-${stage}`).length, 1)
    assert.equal(performance.getEntriesByName('anastasis:today:actionable').length, 0, 'Only complete primary models publish authoritative readiness')
    assert.equal(performance.getEntriesByName('anastasis:today:server:plan').length, 0)
    cleanup()

    const canceledBrowser = browserPerformance(), canceled = fixture({ performance: canceledBrowser })
    canceled.load('lib/performance/dashboard.ts').beginTodayStartup()
    const stop = canceled.component({ stage, snapshot: 'abandoned' })
    canceled.frame()
    const late = [...canceled.frames.values()]
    stop()
    for (const callback of late) callback()
    assert.equal(canceled.frames.size, 0)
    assert.equal(canceledBrowser.getEntriesByName(`anastasis:${stage}`).length, 0)
  }
})

test('effect replay and changed snapshot clear prior diagnostics without stale frame publication', () => {
  const performance = browserPerformance(), view = fixture({ performance })
  const first = view.component({ stage: 'primary', snapshot: 'old', timings: [{ stage: 'plan', startMs: 0, durationMs: 10 }], actionable: true })
  const late = [...view.frames.values()]; first()
  const replay = view.component({ stage: 'primary', snapshot: 'new', timings: [{ stage: 'context', startMs: 0, durationMs: 3 }], actionable: false })
  for (const callback of late) callback()
  view.frame(); view.frame()
  assert.deepEqual(performance.entries.filter(entry => entry.name.startsWith('anastasis:today:')).map(entry => entry.name), ['anastasis:today:server:context'])
  assert.equal(view.effects.at(-1).deps[1], 'new')
  replay()
  assert.equal(performance.entries.filter(entry => entry.name.startsWith('anastasis:today:')).length, 0)
  const shell = view.component({ stage: 'shell', timings: [{ stage: 'plan', startMs: 0, durationMs: 1 }], actionable: true })
  view.frame(); view.frame()
  assert.equal(performance.entries.filter(entry => entry.name.startsWith('anastasis:today:')).length, 0)
  shell()
})

test('changed client timing imports retain a display-only runtime graph and request timing stays server-only', () => {
  const emitted = path => ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  for (const path of ['components/DashboardPerformance.tsx', 'lib/performance/dashboard.ts', 'lib/performance/dashboardTimingTypes.ts']) {
    const javascript = emitted(path)
    assert.doesNotMatch(javascript, /dashboardRequest|loadProgramLogicInputs|getProgramLogicEngine|targetEngine|generateProgram|supabase/)
    const imports = [...javascript.matchAll(/require\(["']([^"']+)["']\)/g)].map(match => match[1])
    assert.ok(imports.every(name => ['react', '@/lib/performance/dashboard', './dashboardTimingTypes'].includes(name)), `${path} contains only expected timing/display imports`)
  }
  for (const path of ['lib/performance/dashboardRequest.ts', 'lib/dashboard/logic/loadProgramLogicInputs.ts', 'lib/dashboard/logic/getProgramLogicEngine.ts']) {
    assert.match(readFileSync(path, 'utf8'), /^import 'server-only'/)
  }
  assert.doesNotMatch(emitted('lib/dashboard/logic/getProgramLogicEngine.ts'), /require\(["']@\/lib\/performance\/dashboardRequest/)
})
