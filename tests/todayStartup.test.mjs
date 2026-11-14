import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, extname, resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const nodes = (tree, match) => Array.isArray(tree) ? tree.flatMap(child => nodes(child, match))
  : !tree || typeof tree !== 'object' ? [] : [...(match(tree) ? [tree] : []), ...nodes(tree.props?.children, match)]
const text = tree => typeof tree === 'string' || typeof tree === 'number' ? String(tree)
  : Array.isArray(tree) ? tree.map(text).join(' ') : tree && typeof tree === 'object' ? text(tree.props?.children) : ''
const plain = value => JSON.parse(JSON.stringify(value))

function bootstrap({ completed = null, at = '2026-11-14T13:00:00.000Z', client = 'OWN-CLIENT', owner = 'OWN-USER', ...patch } = {}) {
  const seed = {
    version: 1, ownerUserId: owner, clientId: client, program: 'ignite', memberName: 'Synthetic', carouselStyle: 'section',
    date: at.slice(0, 10), timezone: 'UTC', generatedAt: at,
    checkIn: { status: completed === null ? 'pending' : 'ready', completed },
    day: { sections: [
      { id: 'morning', title: 'Morning', range: 'Before 10:00 a.m.', items: [] },
      { id: 'midday', title: 'Midday', range: '10:00 a.m. – before 3:00 p.m.', items: [] },
      { id: 'evening', title: 'Evening', range: '3:00 p.m. onward', items: [] },
    ], untimed: [], currentSection: 'midday', nextBoundaryAt: `${at.slice(0, 10)}T15:00:00.000Z` },
    ...patch,
  }
  if (completed === false) seed.day.sections[0].items.push({ id: 'activity:check-in', activityId: 'check-in', category: 'check_in',
    title: 'Daily check-in', detail: 'Your verified current-day check-in.', href: '/dashboard/check-in', status: 'available',
    startAt: null, endAt: null, timing: 'untimed', continuesFromPreviousDay: false })
  return seed
}

function enrichment(seed, completed = false, patch = {}) {
  const model = { version: 1, date: seed.date, timezone: seed.timezone, generatedAt: seed.generatedAt,
    clientId: seed.clientId, tier: seed.program, daySections: bootstrap({ completed, at: seed.generatedAt }).day,
    today: { activities: [{ id: 'check-in', status: completed ? 'completed' : 'available' }], completed: Number(completed), total: 1 },
    nextRefreshAt: seed.day.nextBoundaryAt,
  }
  return { version: 1, ownerUserId: seed.ownerUserId, clientId: seed.clientId, program: seed.program, date: seed.date,
    timezone: seed.timezone, generatedAt: seed.generatedAt,
    logic: { program: seed.program, client: { id: seed.clientId, name: seed.memberName }, assessments: { dailyCompleted: completed }, flameState: {} },
    schedule: { date: seed.date, timezone: seed.timezone, now: seed.generatedAt, events: [],
      preferences: { carouselStyle: 'section' }, todayViewModel: model },
    savedPlanState: { status: 'ready' }, timings: [], ...patch }
}

// Execute the real startup component, hooks, timing and freshness helpers with
// disposable promise-controlled HTTP/auth transports. Nested display components
// are opaque so no full dashboard logic or authenticated provider is involved.
function harness(initialSeed) {
  let seed = initialSeed, tree, changed = false, now = Date.parse(seed.generatedAt || seed.now)
  let stateIndex = 0, refIndex = 0, effectIndex = 0, memoIndex = 0, nextTimer = 0, authListener
  const states = [], refs = [], effects = [], memos = [], requests = [], redirects = [], refreshes = [], opened = []
  const windowListeners = new Map(), documentListeners = new Map(), timers = new Map(), frames = new Map(), entries = []
  const eventSurface = listeners => ({
    addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn) },
    removeEventListener(type, fn) { listeners.get(type)?.delete(fn) },
    dispatchEvent(event) { for (const fn of [...(listeners.get(event.type) || [])]) fn(event); return true },
  })
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now])) } static now() { return now } }
  const window = {
    ...eventSurface(windowListeners), location: { pathname: '/dashboard/program/ignite', href: '/dashboard/program/ignite', assign: path => redirects.push(path), reload: () => refreshes.push('reload') },
    setTimeout(fn, delay) { const id = ++nextTimer; timers.set(id, { fn, at: now + delay }); return id },
    clearTimeout(id) { timers.delete(id) },
    requestAnimationFrame(fn) { const id = ++nextTimer; frames.set(id, fn); return id },
    cancelAnimationFrame(id) { frames.delete(id) },
    sessionStorage: { getItem() { assert.fail('Today startup must not persist member state') }, setItem() { assert.fail('Today startup must not persist member state') } },
  }
  const document = { ...eventSurface(documentListeners), visibilityState: 'visible', activeElement: null }
  const router = { refresh: () => refreshes.push('refresh'), replace: path => redirects.push(path), push: path => redirects.push(path) }
  const performance = {
    now: () => now - Date.parse(initialSeed.generatedAt || initialSeed.now),
    mark(name, options) { entries.push({ name, startTime: this.now(), ...options }) },
    clearMarks(name) { for (let index = entries.length - 1; index >= 0; index--) if (entries[index].name === name) entries.splice(index, 1) },
    clearMeasures(name) { for (let index = entries.length - 1; index >= 0; index--) if (entries[index].name === name) entries.splice(index, 1) },
    getEntriesByName(name) { return entries.filter(entry => entry.name === name) },
    measure(name, options) { entries.push({ name, startTime: this.now(), ...options }) },
  }
  const react = {
    useState(initial) { const index = stateIndex++; if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial
      return [states[index], next => { const value = typeof next === 'function' ? next(states[index]) : next; if (!Object.is(value, states[index])) { states[index] = value; changed = true } }] },
    useRef(initial) { return refs[refIndex++] ||= { current: initial } },
    useEffect(fn, deps) { const index = effectIndex++, previous = effects[index]
      if (!previous || !deps || deps.some((value, i) => !Object.is(value, previous.deps[i]))) effects[index] = { deps, fn, cleanup: previous?.cleanup, pending: true } },
    useId: () => 'synthetic-startup',
    useMemo(fn, deps) { const index = memoIndex++, previous = memos[index]; if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) memos[index] = { deps, value: fn() }; return memos[index].value },
    useCallback(fn, deps) { return this.useMemo(() => fn, deps) },
    startTransition(fn) { fn() },
  }
  // Hooks are imported as plain functions, so their implementations cannot rely
  // on a receiver supplied by the module loader.
  react.useCallback = (fn, deps) => react.useMemo(() => fn, deps)
  const auth = {
    getUser: async () => ({ data: { user: { id: seed.userId || seed.ownerUserId } }, error: null }),
    onAuthStateChange(fn) { authListener = fn; return { data: { subscription: { unsubscribe() { authListener = null } } } } },
  }
  const modules = new Map()
  function load(file) {
    file = resolve(file)
    if (modules.has(file)) return modules.get(file).exports
    const module = { exports: {} }; modules.set(file, module)
    const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
    runInNewContext(code, { module, exports: module.exports, window, document, Date: Clock, Intl, URL, URLSearchParams, AbortController,
      Event, performance, console, setTimeout: window.setTimeout, clearTimeout: window.clearTimeout,
      fetch(url, options = {}) { let respond, fail; const pending = new Promise((yes, no) => { respond = yes; fail = no })
        requests.push({ url, options, respond(data, status = 200) { respond({ ok: status >= 200 && status < 300, status, redirected: false, json: async () => data }) }, fail }); return pending },
      require(name) {
        if (name === 'react') return react
        if (name === 'react/jsx-runtime') return { jsx: (type, props, key) => ({ type, props, key }), jsxs: (type, props, key) => ({ type, props, key }), Fragment: 'Fragment' }
        if (name === 'next/navigation') return { useRouter: () => router }
        if (name === 'next/link') return { __esModule: true, default: 'a' }
        if (name === '@/lib/supabase/client') return { createClient: () => ({ auth }) }
        if (name === '@/lib/analytics/todayJourney') return { recordTodayActionOpened: (...args) => opened.push(args), recordTodayActionCompletions() {} }
        if (name === '@/lib/analytics') return { trackEvent() {} }
        if (name.startsWith('@/components/') || name.startsWith('./') && /[A-Z]/.test(name[2])) return { __esModule: true, default: name.split('/').at(-1) }
        if (name.endsWith('.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) }
        if (name === 'server-only') assert.fail('Startup client cannot import server decisions')
        const base = name.startsWith('@/') ? resolve(name.slice(2)) : name.startsWith('.') ? resolve(dirname(file), name) : null
        if (!base) return require(name)
        return load(extname(base) ? base : existsSync(base + '.ts') ? base + '.ts' : base + '.tsx')
      },
    }, { filename: file })
    return module.exports
  }
  const Startup = load('components/program-dashboard/TodayStartup.tsx').default
  function render(nextSeed) {
    if (nextSeed) seed = nextSeed
    let count = 0
    do {
      changed = false; stateIndex = refIndex = effectIndex = memoIndex = 0
      tree = Startup({ seed })
      for (const effect of effects) if (effect?.pending) { effect.pending = false; effect.cleanup?.(); effect.cleanup = effect.fn() }
      assert.ok(count++ < 25, 'Startup settles without an effect loop')
    } while (changed)
    return tree
  }
  const find = match => nodes(render(), match)
  async function flush() { for (let count = 0; count < 3; count++) { await new Promise(setImmediate); render() } }
  render()
  return {
    render, flush, requests, redirects, refreshes, entries, window, document, opened, get tree() { return render() },
    find, carousel: () => find(node => node.type === 'TodayDayCarousel')[0],
    button: label => find(node => node.type === 'button' && text(node).includes(label))[0],
    emit(type, props = {}) { window.dispatchEvent({ type, ...props }); document.dispatchEvent({ type, ...props }); render() },
    auth(userId, event = 'SIGNED_IN') { authListener?.(event, userId ? { user: { id: userId } } : null); render() },
    frames() { const pending = [...frames.values()]; frames.clear(); for (const callback of pending) callback(); render() },
    advance(ms) { now += ms; let count = 0; for (;;) { const due = [...timers.entries()].filter(([, timer]) => timer.at <= now).sort((a, b) => a[1].at - b[1].at)[0]; if (!due) break; timers.delete(due[0]); due[1].fn(); render(); assert.ok(count++ < 20, 'Boundary timers remain bounded') } },
    unmount() { for (const effect of effects) effect?.cleanup?.() },
  }
}

const request = (view, kind, index = 0) => view.requests.filter(call => call.url.startsWith(`/api/dashboard/today-${kind}?`))[index]
const guide = view => view.find(node => node.type === 'GuidedToday')[0]
const markers = view => view.find(node => node.type === 'DashboardPerformance').map(node => node.props.stage)

test('cold startup exposes an interactive real carousel and verified check-in while enrichment remains unresolved', async () => {
  const seed = bootstrap(), view = harness(seed)
  assert.equal(view.requests.length, 2, 'Independent bootstrap and enrichment start together')
  assert.ok(view.requests.every(call => call.options.cache === 'no-store'))
  const originalCarousel = view.carousel()
  assert.ok(originalCarousel)
  assert.equal(originalCarousel.props.pending, true)
  assert.equal(originalCarousel.props.day.sections.length, 3)
  assert.ok(originalCarousel.props.day.sections.every(section => !section.items.length))
  assert.equal(guide(view), undefined)
  assert.deepEqual(markers(view), ['today-layout-visible', 'today-carousel-interactive'])
  assert.doesNotMatch(text(view.tree), /0 of|0 days|nothing left|all done|streak secured/i)

  request(view, 'bootstrap').respond({ bootstrap: bootstrap({ completed: false }) })
  await view.flush()
  const readyCarousel = view.carousel()
  assert.equal(readyCarousel.type, originalCarousel.type)
  assert.equal(readyCarousel.key, originalCarousel.key)
  assert.equal(readyCarousel.props.pending, true)
  const checkIn = readyCarousel.props.day.sections[0].items[0]
  assert.equal(checkIn.href, '/dashboard/check-in')
  assert.equal(checkIn.activityId, 'check-in')
  readyCarousel.props.onOpen(checkIn.activityId)
  assert.deepEqual(plain(view.opened[0]), [seed.clientId, seed.date, 'check-in', seed.program])
  assert.ok(markers(view).includes('today-check-in-clickable'))
  assert.equal(guide(view), undefined, 'Check-in does not wait for a full recommendation, plan or persistence')

  request(view, 'enrichment').respond(enrichment(seed))
  await view.flush()
  assert.equal(view.carousel().props.pending, false)
  assert.equal(view.carousel().type, originalCarousel.type)
  assert.equal(view.carousel().key, originalCarousel.key)
  assert.equal(guide(view).props.hideDayCarousel, true)
  assert.equal(guide(view).props.manageRefresh, false)
  assert.ok(markers(view).includes('primary'))
  view.unmount()
})

test('failed check-in verification stays closed while independent guidance can retry locally', async () => {
  const seed = bootstrap(), view = harness(seed)
  request(view, 'bootstrap').fail(new Error('Synthetic check-in read failure'))
  request(view, 'enrichment').fail(new Error('Synthetic guidance failure'))
  await view.flush()
  assert.equal(view.carousel().props.day.sections[0].items.length, 0)
  assert.equal(guide(view), undefined)
  assert.ok(view.button('Retry check-in status'))
  assert.ok(view.button('Retry current guidance'))
  const before = view.requests.length
  view.button('Retry check-in status').props.onClick(); view.render()
  assert.equal(view.requests.length, before + 1, 'A local check-in retry does not restart full enrichment')
  request(view, 'bootstrap', 1).respond({ bootstrap: bootstrap({ completed: false }) })
  await view.flush()
  assert.equal(view.carousel().props.day.sections[0].items[0].activityId, 'check-in')
  assert.ok(markers(view).includes('today-check-in-clickable'))
  view.button('Retry current guidance').props.onClick(); view.render()
  request(view, 'enrichment', 1).respond(enrichment(seed))
  await view.flush()
  assert.ok(guide(view))
  assert.equal(view.button('Retry current guidance'), undefined)
  view.unmount()
})

test('slow enrichment times out locally while the verified check-in stays available', async () => {
  const seed = bootstrap(), view = harness(seed)
  request(view, 'bootstrap').respond({ bootstrap: bootstrap({ completed: false }) })
  await view.flush()
  const pending = request(view, 'enrichment')
  view.advance(30010)
  assert.equal(pending.options.signal.aborted, true)
  pending.fail(Object.assign(new Error('Synthetic timeout'), { name: 'AbortError' }))
  await view.flush()
  assert.match(text(view.tree), /taking longer than expected/)
  assert.ok(view.button('Retry current guidance'))
  assert.equal(view.carousel().props.day.sections[0].items[0].activityId, 'check-in')
  assert.ok(markers(view).includes('today-check-in-clickable'))
  assert.equal(guide(view), undefined)
  view.unmount()
})

test('a save invalidates pending responses and verifies completion before exposing new guidance', async () => {
  const seed = bootstrap(), view = harness(seed)
  request(view, 'bootstrap').respond({ bootstrap: bootstrap({ completed: false }) })
  await view.flush()
  const staleEnrichment = request(view, 'enrichment')
  view.emit('anastasis:daily-plan-updated')
  assert.equal(staleEnrichment.options.signal.aborted, true)
  assert.equal(view.carousel().props.day.sections[0].items.length, 0)
  staleEnrichment.respond(enrichment(seed, false))
  request(view, 'bootstrap', 1).respond({ bootstrap: bootstrap({ completed: true }) })
  await view.flush()
  assert.equal(guide(view), undefined, 'Late pre-save guidance cannot repopulate Today')
  assert.equal(view.carousel().props.day.sections[0].items.length, 0)
  assert.match(text(view.tree), /daily check-in is saved/)
  assert.ok(!markers(view).includes('today-check-in-clickable'))
  request(view, 'enrichment', 1).respond(enrichment(seed, true))
  await view.flush()
  assert.ok(guide(view))
  assert.equal(view.carousel().props.day.sections[0].items.length, 0)
  view.unmount()
})

test('other-account, invalid-model and wrong-day responses never become current Today actions', async () => {
  const seed = bootstrap()
  for (const bad of [
    { ownerUserId: 'OTHER-OWNER' }, { clientId: 'OTHER-CLIENT' }, { program: 'phoenix' },
    { date: '2026-11-13' }, { timezone: 'America/Chicago' }, { version: 2 },
    { schedule: { ...enrichment(seed).schedule, todayViewModel: { ...enrichment(seed).schedule.todayViewModel, clientId: 'OTHER-CLIENT' } } },
  ]) {
    const view = harness(seed)
    request(view, 'bootstrap').respond({ bootstrap: bootstrap({ completed: false }) })
    request(view, 'enrichment').respond(enrichment(seed, false, bad))
    await view.flush()
    assert.equal(guide(view), undefined)
    assert.equal(view.carousel().props.pending, true)
    assert.ok(view.button('Retry current guidance'))
    view.unmount()
  }
})

test('account switch, logout and unmount fence late completions immediately', async () => {
  for (const action of ['account', 'logout', 'event', 'unmount']) {
    const view = harness(bootstrap()), pending = [...view.requests]
    if (action === 'account') view.auth('OTHER-USER')
    else if (action === 'logout') view.auth(null, 'SIGNED_OUT')
    else if (action === 'event') view.emit('anastasis:session-ended')
    else view.unmount()
    assert.ok(pending.every(call => call.options.signal.aborted))
    for (const call of pending) call.respond(call.url.includes('today-bootstrap') ? { bootstrap: bootstrap({ completed: false }) } : enrichment(bootstrap()))
    await view.flush()
    if (action !== 'unmount') {
      assert.equal(view.carousel(), undefined)
      assert.equal(guide(view), undefined)
      assert.ok(!markers(view).includes('today-check-in-clickable'))
    }
    view.unmount()
  }
})

test('local midnight hides yesterday immediately and discards its late enrichment', async () => {
  const seed = bootstrap({ at: '2026-11-14T23:59:59.000Z' }), view = harness(seed)
  request(view, 'bootstrap').respond({ bootstrap: bootstrap({ completed: false, at: seed.generatedAt }) })
  await view.flush()
  assert.ok(view.carousel().props.day.sections[0].items.length)
  view.advance(1020)
  assert.equal(view.carousel(), undefined)
  assert.equal(guide(view), undefined)
  assert.ok(view.refreshes.length)
  request(view, 'enrichment').respond(enrichment(seed))
  await view.flush()
  assert.equal(guide(view), undefined)
  assert.match(text(view.tree), /new local day/)
  view.unmount()
})

test('access and safety errors remove all current actions while the route rechecks access', async () => {
  for (const [status, payload] of [[401, { redirect: '/login' }], [403, { redirect: '/dashboard/payment-issue' }], [409, { safetyFlags: [{ reason: 'Synthetic pause' }] }]]) {
    const view = harness(bootstrap())
    request(view, 'bootstrap').respond({ bootstrap: bootstrap({ completed: false }) })
    await view.flush()
    request(view, 'enrichment').respond({ error: 'Synthetic access changed', ...payload }, status)
    await view.flush()
    assert.equal(view.carousel(), undefined)
    assert.equal(guide(view), undefined)
    assert.ok(view.refreshes.length)
    if (payload.redirect) assert.equal(view.redirects.at(-1), payload.redirect)
    view.unmount()
  }
})

test('safe same-day resume retains the visible verified page while revalidating a new server seed', async () => {
  const seed = bootstrap(), view = harness(seed)
  request(view, 'bootstrap').respond({ bootstrap: bootstrap({ completed: false }) })
  request(view, 'enrichment').respond(enrichment(seed))
  await view.flush()
  const visibleGuide = guide(view), carousel = view.carousel()
  view.render(bootstrap({ at: '2026-11-14T13:01:00.000Z' }))
  assert.ok(guide(view), 'A safe resume refresh keeps current guidance visible while its replacement loads')
  assert.equal(guide(view).props.logic, visibleGuide.props.logic)
  assert.equal(view.carousel().key, carousel.key)
  assert.equal(view.carousel().type, carousel.type)
  assert.equal(view.requests.length, 4)
  view.unmount()
})

test('fresh completion verification cannot be overwritten by older independently loaded guidance', async () => {
  const seed = bootstrap(), view = harness(seed)
  request(view, 'enrichment').respond(enrichment(seed, false, { generatedAt: '2026-11-14T13:00:01.000Z', schedule: {
    ...enrichment(seed).schedule, now: '2026-11-14T13:00:01.000Z', todayViewModel: {
      ...enrichment(seed).schedule.todayViewModel, generatedAt: '2026-11-14T13:00:01.000Z',
    },
  } }))
  await view.flush()
  request(view, 'bootstrap').respond({ bootstrap: bootstrap({ completed: true, at: '2026-11-14T13:00:02.000Z' }) })
  await view.flush()
  assert.equal(view.carousel().props.day.sections[0].items.length, 0, 'A verified saved check-in must not reappear as available')
  assert.ok(!markers(view).includes('today-check-in-clickable'))
  assert.ok(!guide(view) || guide(view).props.logic.assessments.dailyCompleted === true)
  view.unmount()
})

test('saved step presentation offers verified check-in early and accepts its complete model without day sections', async () => {
  const seed = bootstrap({ carouselStyle: 'step' }), view = harness(seed)
  const full = enrichment(seed)
  full.schedule.preferences.carouselStyle = 'step'
  delete full.schedule.todayViewModel.daySections
  request(view, 'bootstrap').respond({ bootstrap: bootstrap({ completed: false, carouselStyle: 'step' }) })
  await view.flush()
  assert.equal(view.carousel(), undefined)
  const checkIn = view.find(node => node.type === 'a' && node.props.href === '/dashboard/check-in')[0]
  assert.ok(checkIn, 'Verified check-in is actionable while full step guidance is pending')
  assert.ok(!markers(view).includes('today-carousel-interactive'))
  request(view, 'enrichment').respond(full)
  await view.flush()
  assert.ok(guide(view))
  assert.equal(guide(view).props.presentation, 'step')
  assert.equal(view.carousel(), undefined)
  view.unmount()
})

test('unavailable schedule details remain explicitly pending beside verified actions with local retry', async () => {
  const seed = bootstrap(), view = harness(seed), full = enrichment(seed)
  full.schedule.unavailableSources = ['calendar']
  request(view, 'bootstrap').respond({ bootstrap: bootstrap({ completed: false }) })
  request(view, 'enrichment').respond(full)
  await view.flush()
  assert.ok(guide(view), 'Available accurate guidance can still populate')
  assert.equal(view.carousel().props.pending, true, 'Missing schedule sources cannot claim an empty completed day')
  assert.ok(view.carousel().props.day.sections[0].items[0])
  assert.match(text(view.tree), /Other saved actions may still be pending/)
  assert.ok(view.button('Retry schedule details'))
  view.button('Retry schedule details').props.onClick(); view.render()
  assert.equal(view.requests.filter(call => call.url.includes('today-bootstrap')).length, 1, 'Schedule retry is independent of check-in verification')
  request(view, 'enrichment', 1).respond(enrichment(seed))
  await view.flush()
  assert.equal(view.carousel().props.pending, false)
  assert.equal(view.button('Retry schedule details'), undefined)
  view.unmount()
})

test('a presentation boundary prevents retaining earlier guidance during the next server refresh', async () => {
  const seed = bootstrap(), view = harness(seed)
  request(view, 'bootstrap').respond({ bootstrap: bootstrap({ completed: false }) })
  request(view, 'enrichment').respond(enrichment(seed))
  await view.flush()
  assert.ok(guide(view))
  view.advance(2 * 60 * 60 * 1000 + 10)
  view.render(bootstrap({ at: '2026-11-14T15:00:00.010Z' }))
  assert.equal(guide(view), undefined, 'Guidance that crossed its nextRefreshAt cannot be shown as current')
  assert.equal(view.carousel().props.pending, true)
  view.unmount()
})
