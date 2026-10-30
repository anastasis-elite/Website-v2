import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { randomUUID } from 'node:crypto'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { importTs } from './typescriptModule.mjs'

const require = createRequire(import.meta.url)
const time = await importTs('lib/schedule/time.ts')
const timezone = await importTs('lib/timezone.ts')
const routes = await importTs('lib/day/dayBlockRoutes.ts')
const actions = await importTs('lib/schedule/actions.ts')
const engine = await importTs('lib/schedule/engine.ts')
const Link = () => null
const Checkoff = () => null
const tick = () => new Promise(resolve => setImmediate(resolve))
const text = value => typeof value === 'string' ? value : Array.isArray(value) ? value.map(text).join('')
  : value && typeof value === 'object' ? text(value.props?.children) : ''
function nodes(tree, predicate) {
  if (!tree || typeof tree !== 'object') return []
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, predicate))
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)]
}
function load(path, mocks, globals = {}) {
  const module = { exports: {} }
  const compiled = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText
  runInNewContext(compiled, { module, exports: module.exports, Date, Error, TypeError, URLSearchParams, ...globals,
    require(name) { return name.endsWith('.css') ? {} : mocks[name] || require(name) },
  })
  return module.exports.default
}
function event(id, time = '08:00', extra = {}) {
  return { id, title: id, event_type: 'school', source: 'anastasis', status: 'scheduled', virtual: true,
    start_at: `2026-10-28T${time}:00Z`, end_at: `2026-10-28T${time}:30Z`, timezone: 'UTC', ...extra }
}
function scheduleView(overrides = {}) {
  const navigation = [], refreshes = []
  const schedule = { date: '2026-10-28', timezone: 'UTC', now: '2026-10-28T12:00:00Z', program: 'ignite', events: [], ...overrides }
  const Component = load('app/dashboard/schedule/ScheduleDashboardClient.tsx', {
    'next/link': Link, 'next/navigation': { useRouter: () => ({ push: href => navigation.push(href) }) },
    '@/lib/schedule/time': time, '@/lib/timezone': timezone, '@/lib/day/dayBlockRoutes': routes,
    '@/lib/schedule/actions': actions, '@/lib/schedule/engine': engine,
    '@/lib/schedule/client': { useDailyScheduleRefresh: data => refreshes.push(data) },
    '@/components/ScheduleCheckoff': Checkoff,
  })
  return { tree: Component({ initialSchedule: schedule }), schedule, navigation, refreshes }
}

test('Schedule is a compact dated chronological list including generated and imported appointments', () => {
  const imported = event('Provider appointment', '09:00', { source: 'external_calendar', virtual: false, calendar_event_id: 'provider-id' })
  const generated = event('School drop-off', '08:00')
  const view = scheduleView({ events: [imported, event('Evening', '18:00'), generated] })
  assert.deepEqual(nodes(view.tree, node => node.type === 'li').map(node => node.props.id), ['event-School drop-off', 'event-Provider appointment', 'event-Evening'])
  assert.equal(nodes(view.tree, node => node.type === Checkoff).length, 3)
  assert.equal(nodes(view.tree, node => node.type === 'h1').map(text).join(''), 'Schedule')
  assert.equal(nodes(view.tree, node => node.type === Link && node.props.href === '/dashboard/calendar?date=2026-10-28').length, 1)
  assert.equal(nodes(view.tree, node => node.type === 'dialog' || node.type === 'form').length, 0)
  assert.doesNotMatch(text(view.tree), /Make room|daily rhythm|Schedule settings|suggestions stay|connected calendars|daily structure/i)
  assert.deepEqual(view.refreshes, [view.schedule])
  assert.equal(view.schedule.events[0], imported, 'render sorting must not reorder server props')
})

test('Schedule date picker accepts real dates and adjacent day links cross month/year boundaries', () => {
  const view = scheduleView({ date: '2028-01-01' })
  const date = nodes(view.tree, node => node.type === 'input' && node.props.type === 'date')[0]
  for (const value of ['2028-02-29', '2028-02-30', '2026-13-01', '', '2028-2-1', 'invalid']) date.props.onChange({ target: { value } })
  assert.deepEqual(view.navigation, ['/dashboard/schedule?date=2028-02-29'])
  const links = nodes(view.tree, node => node.type === Link)
  assert.equal(links.find(node => node.props['aria-label'] === 'Previous day').props.href, '/dashboard/schedule?date=2027-12-31')
  assert.equal(links.find(node => node.props['aria-label'] === 'Next day').props.href, '/dashboard/schedule?date=2028-01-02')
  for (const block of ['morning', 'midday', 'evening']) assert.ok(links.some(node => node.props.href === `/dashboard/day/${block}?date=2028-01-01`))
})

test('Today shortcut follows the member local date across UTC midnight', () => {
  const before = scheduleView({ timezone: 'Pacific/Honolulu', date: '2026-10-27', now: '2026-10-28T02:00:00Z' })
  const after = scheduleView({ timezone: 'Pacific/Kiritimati', date: '2026-10-27', now: '2026-10-28T02:00:00Z' })
  const shortcuts = tree => nodes(tree, node => node.type === Link && node.props.href === '/dashboard/schedule')
  assert.equal(shortcuts(before.tree).length, 0)
  assert.equal(shortcuts(after.tree).length, 1)
})

test('tracked health activities open their saved logging destination and never get a generic check-off', () => {
  const health = [...actions.healthEventTypes].map((type, i) => event(type, `${String(i + 10).padStart(2, '0')}:00`, { event_type: type }))
  const view = scheduleView({ events: health })
  assert.equal(nodes(view.tree, node => node.type === Checkoff).length, 0)
  assert.equal(nodes(view.tree, node => node.type === 'input' && node.props.type === 'checkbox').length, 0)
  for (const item of health) {
    const row = nodes(view.tree, node => node.type === 'li' && node.props.id === `event-${item.id}`)[0]
    const log = nodes(row, node => node.type === Link && node.props['aria-label'] === `Open ${item.title} to log`)[0]
    assert.equal(log.props.href, engine.getActionRouteForEvent(item, 'ignite'))
  }
  const done = scheduleView({ events: [event('saved workout', '08:00', { event_type: 'workout', status: 'completed' })] })
  assert.equal(nodes(done.tree, node => node.type === Checkoff).length, 0)
  assert.equal(nodes(done.tree, node => node.props['aria-label'] === 'saved workout: Done').length, 1)
})

test('unavailable check-off storage disables controls while health logging remains available', () => {
  const view = scheduleView({ unavailableSources: ['checkoffs'], events: [event('drop-off'), event('water', '10:00', { event_type: 'hydration' })] })
  assert.equal(nodes(view.tree, node => node.type === Checkoff)[0].props.unavailable, true)
  assert.equal(nodes(view.tree, node => node.type === Link && node.props['aria-label'] === 'Open water to log').length, 1)
  assert.match(text(view.tree), /Some schedule details could not load/)
})

function checkoffView(overrides = {}) {
  const states = [], refs = [], dependencies = []
  const calls = [], events = []
  let stateIndex = 0, refIndex = 0, effectIndex = 0, refreshes = 0, announcements = 0
  let pendingEffects = []
  let props = { event: event('school-dropoff'), date: '2026-10-28', timezone: 'America/Chicago', ...overrides }
  let send = async () => Response.json({ checkoff: { completed: true, revision: 1 } })
  const Component = load('components/ScheduleCheckoff.tsx', {
    react: {
      useState(initial) { const i = stateIndex++; if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial
        return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value }] },
      useRef(initial) { return refs[refIndex++] ||= { current: initial } },
      useEffect(callback, deps) { const i = effectIndex++; const old = dependencies[i]
        if (!old || deps.some((dep, n) => !Object.is(dep, old[n]))) { dependencies[i] = deps; pendingEffects.push(callback) } },
    },
    'next/navigation': { useRouter: () => ({ refresh: () => refreshes++ }) },
    '@/lib/calendar/client': { announceCalendarChange: () => announcements++ },
  }, {
    crypto: { randomUUID }, Event,
    window: { dispatchEvent: event => events.push(event.type) },
    fetch: async (url, options) => { calls.push({ url, method: options.method, body: JSON.parse(options.body) }); return send(url, options) },
  })
  const render = () => {
    stateIndex = refIndex = effectIndex = 0
    const tree = Component(props)
    const effects = pendingEffects; pendingEffects = []; effects.forEach(effect => effect())
    return tree
  }
  return { render, calls, events, setSend(fn) { send = fn }, setProps(next) { props = { ...props, ...next } },
    checkbox() { return nodes(render(), node => node.type === 'input' && node.props.type === 'checkbox')[0] },
    click() { this.checkbox().props.onChange() }, get refreshes() { return refreshes }, get announcements() { return announcements } }
}

test('generated commitment check-off sends dated occurrence plus revision and refreshes saved Today/Plan state', async () => {
  const view = checkoffView()
  assert.equal(view.checkbox().props.checked, false)
  view.click(); await tick()
  assert.equal(view.calls.length, 1)
  assert.equal(view.calls[0].url, '/api/schedule/checkoff')
  assert.equal(view.calls[0].method, 'POST')
  const { operationId, ...body } = view.calls[0].body
  assert.match(operationId, /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[\da-f]{4}-[\da-f]{12}$/)
  assert.deepEqual(body, { eventId: 'school-dropoff', date: '2026-10-28', timezone: 'America/Chicago', completed: true, expectedRevision: 0 })
  assert.equal(view.checkbox().props.checked, true)
  assert.equal(view.checkbox().props['aria-label'], 'Undo completion of school-dropoff')
  assert.equal(view.announcements, 1)
  assert.deepEqual(view.events, ['anastasis:daily-plan-updated'])
  assert.equal(view.refreshes, 1)
  view.setSend(async () => Response.json({ checkoff: { completed: false, revision: 2 } }))
  view.click(); await tick()
  assert.equal(view.calls[1].body.completed, false)
  assert.equal(view.calls[1].body.expectedRevision, 1)
  assert.notEqual(view.calls[1].body.operationId, operationId)
  assert.equal(view.checkbox().props.checked, false)
})

test('rapid repeat actions send one request and lost responses retry the same operation without a second toggle', async () => {
  const view = checkoffView()
  let rejectPending
  view.setSend(() => new Promise((_resolve, reject) => { rejectPending = reject }))
  view.click(); view.click()
  assert.equal(view.calls.length, 1)
  assert.equal(view.checkbox().props.disabled, true)
  rejectPending(new TypeError('Network response lost'))
  await tick()
  assert.equal(view.checkbox().props.checked, false)
  assert.equal(view.checkbox().props.disabled, false)
  assert.match(text(view.render()), /Network response lost/)
  assert.equal(view.refreshes, 0)
  view.setSend(async () => Response.json({ checkoff: { completed: true, revision: 1 } }))
  view.click(); await tick()
  assert.deepEqual(view.calls[1].body, view.calls[0].body)
  assert.equal(view.checkbox().props.checked, true)
  assert.equal(view.announcements, 1)
})

test('a stale concurrent check-off conflict requests current server state before a fresh operation', async () => {
  const view = checkoffView()
  view.setSend(async () => Response.json({ error: 'This occurrence changed in another window. Refresh and try again.' }, { status: 409 }))
  view.click(); await tick()
  assert.equal(view.refreshes, 1)
  assert.equal(view.announcements, 0)
  assert.equal(view.checkbox().props.checked, false)
  assert.match(text(view.render()), /another window/)
  view.setProps({ event: event('school-dropoff', '08:00', { checkoff: { completed: true, revision: 4 } }) })
  view.render()
  view.setSend(async () => Response.json({ checkoff: { completed: false, revision: 5 } }))
  view.click(); await tick()
  assert.equal(view.calls[1].body.expectedRevision, 4)
  assert.equal(view.calls[1].body.completed, false)
  assert.notEqual(view.calls[1].body.operationId, view.calls[0].body.operationId)
})

test('saved completion reopens checked while unavailable storage, cancelled and legacy terminal events cannot write', async () => {
  const restored = checkoffView({ event: event('school-dropoff', '08:00', { status: 'completed', checkoff: { completed: true, revision: 3 } }) })
  assert.equal(restored.checkbox().props.checked, true)
  assert.equal(restored.checkbox().props.disabled, false)
  for (const overrides of [
    { unavailable: true },
    { event: event('cancelled', '08:00', { status: 'cancelled' }) },
    { event: event('skipped', '08:00', { status: 'skipped' }) },
    { event: event('legacy-done', '08:00', { status: 'completed' }) },
  ]) {
    const view = checkoffView(overrides)
    assert.equal(view.checkbox().props.disabled, true)
    view.click(); await tick()
    assert.equal(view.calls.length, 0)
  }
})
