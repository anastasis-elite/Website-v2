import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { randomUUID } from 'node:crypto'
import ts from 'typescript'
import { importTs } from './typescriptModule.mjs'

const require = createRequire(import.meta.url)
const form = await importTs('lib/calendar/form.ts')
const time = await importTs('lib/schedule/time.ts')
const timezone = await importTs('lib/timezone.ts')
const tick = () => new Promise(resolve => setImmediate(resolve))
const text = value => typeof value === 'string' ? value : Array.isArray(value) ? value.map(text).join('') : value && typeof value === 'object' ? text(value.props?.children) : ''
function nodes(tree, predicate) {
  if (!tree || typeof tree !== 'object') return []
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, predicate))
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)]
}
function load(path, mocks, globals = {}) {
  const module = { exports: {} }
  const { outputText } = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } })
  runInNewContext(outputText, { module, exports: module.exports, Error, ...globals,
    require: name => name.endsWith('.css') ? {} : mocks[name] || require(name) })
  return module.exports.default
}
const event = (patch = {}) => ({ id: 'owned-event', calendar_id: 'writable-calendar', title: 'School pickup', description: '', location: '',
  start_at: '2026-11-01T15:00:00Z', end_at: '2026-11-01T15:30:00Z', timezone: 'America/Chicago', all_day: false,
  recurrence: [], reminders: [], source_label: 'Personal', writable: true, etag: 'version-a', event_type: 'personal', ...patch })

function harness(events = []) {
  const states = [], refs = [], effects = [], pendingEffects = [], listeners = new Map(), calls = [], ranges = []
  let stateIndex = 0, refIndex = 0, effectIndex = 0, announced = 0, refreshes = 0
  let send = async () => ({})
  const browser = {
    addEventListener(name, fn) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn) },
    removeEventListener(name, fn) { listeners.get(name)?.delete(fn) },
  }
  const historyEntries = [{ state: { __NA: true }, url: '/dashboard/calendar?date=2026-11-01' }]
  browser.history = {
    get state() { return historyEntries.at(-1).state },
    pushState(state, _unused, url) { historyEntries.push({ state, url }) },
    back() { if (historyEntries.length > 1) historyEntries.pop(); for (const listener of listeners.get('popstate') || []) listener() },
  }
  const dialog = { open: false, showModal() { this.open = true }, close() { this.open = false } }
  const calendars = [
    { id: 'writable-calendar', name: 'Personal', writable: true, selected: true },
    { id: 'readonly-calendar', name: 'School shared', writable: false, selected: true },
    { id: 'unselected-calendar', name: 'Hidden', writable: true, selected: false },
  ]
  const Component = load('components/CalendarWorkspace.tsx', {
    react: {
      useState(initial) { const index = stateIndex++; if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial
        return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value }] },
      useRef(initial) { return refs[refIndex++] ||= { current: initial } },
      useMemo(fn) { return fn() },
      useCallback(fn) { return fn },
      useEffect(fn, deps) { const index = effectIndex++, previous = effects[index]
        if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) pendingEffects.push(() => {
          previous?.cleanup?.(); effects[index] = { deps, cleanup: fn() }
        }) },
    },
    'next/link': 'a',
    'next/navigation': { useRouter: () => ({ refresh() { refreshes++ } }) },
    '@/lib/calendar/client': {
      useCalendarEvents(start, end, zone) { ranges.push({ start, end, zone }); return { events, calendars, loading: false, error: '', async refresh() {} } },
      announceCalendarChange() { announced++ },
      async calendarRequest(url, options = {}) {
        if (!options.method) return { connections: [], preferences: { timezone: 'America/Chicago', default_calendar_id: '' } }
        calls.push({ url, ...options, body: options.body ? JSON.parse(options.body) : undefined })
        return send(url, options)
      },
    },
    '@/lib/calendar/form': form, '@/lib/timezone': timezone, '@/lib/schedule/time': time,
  }, { window: browser, crypto: { randomUUID } })
  function render() {
    stateIndex = refIndex = effectIndex = 0
    const tree = Component({ date: '2026-11-01', timezone: 'America/Chicago' })
    nodes(tree, node => node.type === 'dialog')[0].ref.current = dialog
    while (pendingEffects.length) pendingEffects.shift()()
    return tree
  }
  const button = label => nodes(render(), node => node.type === 'button' && (node.props['aria-label'] === label || text(node) === label))[0]
  const field = label => nodes(nodes(render(), node => node.type === 'label' && text(node).startsWith(label))[0], node => ['input', 'select', 'textarea'].includes(node.type))[0]
  return { render, button, field, calls, dialog, ranges, browser, setSend(fn) { send = fn },
    async ready() { render(); await tick(); render() },
    submit() { return nodes(render(), node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} }) },
    get announced() { return announced }, get refreshes() { return refreshes } }
}

test('calendar + opens a clean form; Cancel, Escape and browser Back discard it without any writes', async () => {
  const view = harness(); await view.ready()
  assert.equal(nodes(view.render(), node => node.type === 'form').length, 0)
  assert.equal(view.dialog.open, false)
  for (const exit of ['cancel', 'escape', 'back']) {
    view.button('Add event').props.onClick(); view.render()
    assert.equal(view.dialog.open, true)
    assert.equal(view.field('Start date').props.value, '2026-11-01')
    view.field('Title').props.onChange({ target: { value: 'Unsaved draft' } })
    if (exit === 'cancel') view.button('Cancel').props.onClick()
    else if (exit === 'back') view.browser.history.back()
    else {
      let prevented = false
      nodes(view.render(), node => node.type === 'dialog')[0].props.onCancel({ preventDefault() { prevented = true } })
      assert.equal(prevented, true)
    }
    view.render()
    assert.equal(view.dialog.open, false)
    assert.equal(nodes(view.render(), node => node.type === 'form').length, 0)
    assert.deepEqual(view.calls, [])
  }
  view.button('Add event').props.onClick(); view.render()
  assert.equal(view.field('Title').props.value, '')
})

test('selected calendar dates drive the query and a fresh + draft across a 25-hour local day', async () => {
  const view = harness(); await view.ready()
  assert.equal((Date.parse(view.ranges.at(-1).end) - Date.parse(view.ranges.at(-1).start)) / 3600000, 25)
  view.field('View date').props.onChange({ target: { value: '2026-11-02' } }); view.render()
  assert.equal(view.ranges.at(-1).start, '2026-11-02T06:00:00.000Z')
  assert.equal(nodes(view.render(), node => node.type === 'a' && text(node) === 'Schedule')[0].props.href, '/dashboard/schedule?date=2026-11-02')
  view.button('Add event').props.onClick(); view.render()
  assert.equal(view.field('Start date').props.value, '2026-11-02')
  assert.equal(view.field('End date').props.value, '2026-11-02')
  assert.deepEqual(view.calls, [])
})

test('read-only appointments have no edit/delete controls and cannot become creation destinations', async () => {
  const view = harness([event({ writable: false, calendar_id: 'readonly-calendar' })]); await view.ready()
  assert.equal(nodes(view.render(), node => node.type === 'button' && /^(Edit|Delete)/.test(text(node))).length, 0)
  view.button('Add event').props.onClick(); view.render()
  assert.deepEqual(nodes(view.field('Destination calendar'), node => node.type === 'option').map(node => node.props.value), ['', 'writable-calendar'])
  assert.deepEqual(view.calls, [])
})

test('series editor preserves whole-series warning, confirmation and provider concurrency metadata', async () => {
  const recurring = event({ recurrence: ['RRULE:FREQ=WEEKLY;COUNT=8'], recurring_event_id: 'provider-series', occurrence_start: '2026-11-01T15:00:00Z',
    series_start_at: '2026-10-25T14:00:00Z', series_end_at: '2026-10-25T14:30:00Z' })
  const view = harness([recurring]); await view.ready()
  view.button('Edit series').props.onClick(); view.render()
  assert.equal(view.dialog.open, true)
  assert.match(text(view.render()), /Saving updates the entire repeating series/)
  assert.equal(view.field('Start date').props.value, '2026-10-25')
  assert.equal(view.field('Destination calendar').props.disabled, true)
  assert.ok(view.button('Confirm series changes'))
  assert.deepEqual(view.calls, [])
  await view.submit(); view.render()
  assert.equal(view.calls[0].method, 'PATCH')
  assert.equal(view.calls[0].body.scope, 'series')
  assert.equal(view.calls[0].body.expected_etag, 'version-a')
  assert.equal(view.calls[0].body.occurrence_start, recurring.occurrence_start)
  assert.deepEqual(view.calls[0].body.recurrence, recurring.recurrence)
  assert.equal(view.dialog.open, false)
  assert.equal(view.announced, 1)
  assert.equal(view.refreshes, 1)
})

test('failed calendar save retains the draft and retry identity; concurrent submit remains single-flight', async () => {
  const view = harness(); await view.ready()
  view.button('Add event').props.onClick(); view.render()
  view.field('Title').props.onChange({ target: { value: 'Personal time' } })
  view.setSend(async () => { throw new Error('Temporarily unavailable') })
  await view.submit(); view.render()
  assert.equal(view.dialog.open, true)
  assert.equal(view.field('Title').props.value, 'Personal time')
  assert.match(text(view.render()), /Temporarily unavailable/)
  let resolve
  view.setSend(() => new Promise(done => { resolve = done }))
  const pending = view.submit(); const duplicate = view.submit()
  assert.equal(view.calls.length, 2)
  assert.equal(view.calls[0].body.idempotency_key, view.calls[1].body.idempotency_key)
  assert.equal(view.button('Cancel').props.disabled, true)
  resolve({}); await Promise.all([pending, duplicate]); view.render()
  assert.equal(view.dialog.open, false)
  assert.equal(view.announced, 1)
})

test('recurring deletion still requires explicit confirmation and retains its scope', async () => {
  const view = harness([event({ recurrence: ['RRULE:FREQ=WEEKLY;COUNT=8'], occurrence_start: '2026-11-01T15:00:00Z' })]); await view.ready()
  view.button('Delete series').props.onClick(); view.render()
  assert.match(text(view.render()), /and all events in its repeating series/)
  view.button('Keep event').props.onClick(); view.render()
  assert.deepEqual(view.calls, [])
  view.button('Delete series').props.onClick(); view.render()
  await view.button('Confirm deletion').props.onClick(); await tick()
  assert.equal(view.calls[0].method, 'DELETE')
  assert.equal(view.calls[0].body.scope, 'series')
  assert.equal(view.calls[0].body.expected_etag, 'version-a')
})

test('dedicated Calendar page uses the authenticated member timezone and only valid date parameters', async () => {
  const client = { timezone: 'Pacific/Auckland' }, seen = []
  const Workspace = () => null
  const Page = load('app/dashboard/calendar/page.tsx', {
    '@/components/CalendarWorkspace': Workspace, '@/components/phone-app/PhoneAppFrame': () => null,
    '@/lib/dashboard/getDashboardContext': { async getDashboardContext() { return { client } } },
    '@/lib/schedule/time': { getClientDayRange(member, selectedDate) { seen.push({ member, selectedDate }); return { date: selectedDate || '2026-11-02', timezone: member.timezone } } },
  })
  for (const date of ['2026-11-01', '2026-02-30', ['2026-11-01'], 'invalid']) {
    const tree = await Page({ searchParams: Promise.resolve({ date }) })
    const workspace = nodes(tree, node => node.type === Workspace)[0]
    assert.equal(workspace.props.timezone, 'Pacific/Auckland')
    assert.equal(workspace.props.date, date === '2026-11-01' ? date : '2026-11-02')
    assert.equal(seen.at(-1).member, client)
    assert.equal(seen.at(-1).selectedDate, date === '2026-11-01' ? date : undefined)
  }
})
