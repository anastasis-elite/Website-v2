import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { spawnSync } from 'node:child_process'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import { importTs } from './typescriptModule.mjs'

const require = createRequire(import.meta.url)
const view = await importTs('lib/calendar/view.ts')
const engine = await importTs('lib/schedule/engine.ts')
const actions = await importTs('lib/schedule/actions.ts')
const time = await importTs('lib/schedule/time.ts')
const timezone = await importTs('lib/timezone.ts')
const adapters = await importTs('lib/schedule/dailyPlanAdapter.ts')
const dismissals = await importTs('lib/calendar/dismissals.ts')
const preferences = await importTs('lib/dashboard/viewPreferences.ts')
const Link = ({ href, children, ...props }) => React.createElement('a', { href, ...props }, children)

function loadComponent(path, mocks = {}) {
  const module = { exports: {} }
  const { outputText } = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } })
  runInNewContext(outputText, { module, exports: module.exports, require: name => mocks[name] || ({
    'next/link': Link,
    'next/navigation': { useRouter: () => ({ refresh() {} }) },
    '@/lib/schedule/engine': engine,
    '@/lib/schedule/actions': actions,
    '@/lib/schedule/time': time,
    '@/lib/timezone': timezone,
    '@/lib/calendar/client': { announceCalendarChange() {} },
  }[name] || require(name)) })
  return module.exports.default
}

const event = (overrides = {}) => ({ id: 'qa-event', title: 'QA activity', event_type: 'custom', source: 'manual',
  user_id: 'qa-user', client_id: 'qa-client', status: 'scheduled', flexibility_type: 'flexible', movable: true,
  approval_required: false, virtual: false, all_day: false, start_at: '2026-10-12T14:00:00Z', end_at: '2026-10-12T15:00:00Z', ...overrides })

test('each schedule row routes its own Work details even when the primary action is hydration', () => {
  const Component = loadComponent('components/program-dashboard/AdaptiveTodayForYou.tsx')
  const html = renderToStaticMarkup(React.createElement(Component, { streak: 0, insight: 'QA', schedule: {
    program: 'ignite', now: '2026-10-12T13:00:00Z', timezone: 'America/Chicago', events: [event({ id: 'qa-work', title: 'Work block', event_type: 'work', flexibility_type: 'fixed', movable: false })], completedEvents: [], adjustments: [],
    nextAction: { urgency: 'soon', title: 'Add water', reason: 'QA', action_route: '/dashboard/nutrition#hydration' },
  } }))
  const row = html.match(/<a [^>]*class="adaptive-action-row[^>]*>/)?.[0]
  assert.ok(row)
  assert.match(row, /href="\/dashboard\/schedule#event-qa-work"/)
  assert.doesNotMatch(row, /nutrition/)
})

test('generated work and school commitments retain Daily Structure routing; tier activity destinations stay intact', () => {
  const events = adapters.dailyPlanToScheduleEvents({ userId: 'qa-user', client: { client_id: 'qa-client', program: 'ignite', work_start_time: '09:00', work_end_time: '17:00', school_pickup_time: '15:30' }, dailyPlan: { date: '2026-10-12', timezone: 'America/Chicago' } })
  for (const item of events) assert.equal(engine.getActionRouteForEvent(item), '/dashboard/assessment/daily-structure')
  assert.equal(engine.getActionRouteForEvent(event({ event_type: 'meal', action_route: '/dashboard/nutrition#aos-food-logger' }), 'ember'), '/dashboard/nutrition')
  for (const program of ['ember', 'ignite', 'phoenix']) assert.equal(engine.getActionRouteForEvent(event({ event_type: 'workout' }), program), `/dashboard/program/${program}/workout`)
})

test('calendar counts distinguish saved events, program suggestions, and available time', () => {
  const items = view.buildCalendarItems([event(), event({ id: 'qa-program', source: 'program', suggested: true })], [{ start_at: '2026-10-12T16:00:00Z', end_at: '2026-10-12T17:00:00Z', minutes: 60 }])
  assert.deepEqual(view.summarizeCalendarItems(items), { events: 1, suggestions: 1, available: 1 })
  assert.deepEqual(view.summarizeCalendarItems([]), { events: 0, suggestions: 0, available: 0 })
})

test('dismissed proposal times survive save, reload and revisit without dismissing activities or other accounts', () => {
  const values = new Map(), storage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) }
  const proposed = view.buildCalendarItems([event({ id: 'qa-program', source: 'program', suggested: true })], [{ start_at: '2026-10-12T16:00:00Z', end_at: '2026-10-12T17:00:00Z', minutes: 60 }])
  const keys = proposed.map(dismissals.calendarSuggestionKey)
  assert.equal(dismissals.writeCalendarDismissals(storage, 'qa-client', '2026-10-12', keys), true)
  const reloaded = dismissals.readCalendarDismissals(storage, 'qa-client', '2026-10-12')
  assert.deepEqual(dismissals.filterDismissedCalendarSuggestions(proposed, reloaded), [])
  assert.deepEqual(dismissals.readCalendarDismissals(storage, 'another-client', '2026-10-12'), [])
  assert.deepEqual(dismissals.readCalendarDismissals(storage, 'qa-client', '2026-10-13'), [])
  const revised = { ...proposed[0], start_at: '2026-10-12T18:00:00Z', end_at: '2026-10-12T19:00:00Z' }
  assert.deepEqual(dismissals.filterDismissedCalendarSuggestions([revised], reloaded), [revised])
  const confirmed = { ...proposed[0], suggested: false }
  assert.deepEqual(dismissals.filterDismissedCalendarSuggestions([confirmed], reloaded), [confirmed])
  assert.equal(dismissals.writeCalendarDismissals(storage, 'qa-client', '2026-10-12', []), true)
  assert.deepEqual(dismissals.filterDismissedCalendarSuggestions(proposed, dismissals.readCalendarDismissals(storage, 'qa-client', '2026-10-12')), proposed)
  assert.equal(values.size, 1)
})

test('calendar dismissal storage is bounded and blocked/corrupt browser storage fails safely', () => {
  const values = new Map(), storage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) }
  for (let offset = 0; offset < 45; offset++) dismissals.writeCalendarDismissals(storage, 'qa-client', view.addDays('2026-10-01', offset), ['qa'])
  assert.equal(Object.keys(JSON.parse(values.get(dismissals.calendarDismissalKey('qa-client'))).dates).length, 31)
  const blocked = { getItem() { throw new Error('blocked') }, setItem() { throw new Error('quota') } }
  assert.deepEqual(dismissals.readCalendarDismissals(blocked, 'qa-client', '2026-10-12'), [])
  assert.equal(dismissals.writeCalendarDismissals(blocked, 'qa-client', '2026-10-12', ['qa']), false)
  storage.setItem(dismissals.calendarDismissalKey('qa-client'), '{bad json')
  assert.deepEqual(dismissals.readCalendarDismissals(storage, 'qa-client', '2026-10-12'), [])
  assert.equal(dismissals.writeCalendarDismissals(storage, '', '2026-10-12', ['qa']), false)
})

test('calendar mode and explicit daypart survive reload while the default remains automatic', () => {
  const values = new Map(), storage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) }
  const mode = preferences.viewPreferenceKey('qa-client', 'calendar-mode')
  const daypart = preferences.viewPreferenceKey('qa-client', 'calendar-daypart')
  assert.equal(preferences.readViewPreference(storage, daypart, ['auto', 'morning', 'midday', 'evening'], 'auto'), 'auto')
  preferences.writeViewPreference(storage, mode, 'month')
  preferences.writeViewPreference(storage, daypart, 'evening')
  assert.equal(preferences.readViewPreference(storage, mode, ['day', 'week', 'month'], 'day'), 'month')
  assert.equal(preferences.readViewPreference(storage, daypart, ['auto', 'morning', 'midday', 'evening'], 'auto'), 'evening')
  assert.equal(preferences.readViewPreference(storage, preferences.viewPreferenceKey('another-client', 'calendar-mode'), ['day', 'week', 'month'], 'day'), 'day')
  preferences.writeViewPreference(storage, mode, 'obsolete')
  assert.equal(preferences.readViewPreference(storage, mode, ['day', 'week', 'month'], 'day'), 'day')
})

test('October grid includes November 1 exactly once across host DST zones and leap/year boundaries', () => {
  const script = `import assert from 'node:assert/strict'; import { importTs } from './tests/typescriptModule.mjs'; const v=await importTs('lib/calendar/view.ts');
    for (const selectedDate of ['2026-10-12','2026-11-01','2026-03-08','2028-02-29','2026-12-31']) {
      const grid=v.buildMonthGrid({selectedDate,items:[],today:selectedDate});
      assert.equal(grid.length,42); assert.equal(new Set(grid.map(c=>c.date)).size,42); assert.equal(grid.filter(c=>c.isSelected).length,1);
      for(let i=1;i<grid.length;i++) assert.equal(Date.parse(grid[i].date)-Date.parse(grid[i-1].date),86400000);
      const range=v.calendarQueryDateRange(selectedDate); for(const day of v.buildWeekDays(selectedDate,[])) assert.ok(day.date>=range.start&&day.date<range.end);
    }
    const october=v.buildMonthGrid({selectedDate:'2026-10-12',items:[]}); assert.equal(october.filter(c=>c.date==='2026-11-01').length,1);
    assert.equal(v.addDays('2026-11-01',1),'2026-11-02'); assert.equal(v.addDays('2026-12-31',1),'2027-01-01');`
  for (const TZ of ['UTC', 'America/Chicago', 'America/Havana', 'Europe/London', 'Pacific/Auckland']) {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { env: { ...process.env, TZ }, encoding: 'utf8' })
    assert.equal(result.status, 0, `${TZ}: ${result.stderr}`)
  }
})

test('schedule completion has a clear activity route or commitment explanation rather than a disabled button', () => {
  const Component = loadComponent('components/ScheduleEventActions.tsx')
  const render = overrides => renderToStaticMarkup(React.createElement(Component, { event: event(overrides), timezone: 'America/Chicago', program: 'ignite' }))
  for (const event_type of ['workout', 'meal', 'hydration', 'recovery', 'check_in', 'assessment', 'sleep']) {
    const html = render({ event_type })
    assert.match(html, /Save through the activity above to record completion/)
    assert.doesNotMatch(html, />Complete<\/button>/)
    assert.doesNotMatch(html, /disabled=""/)
  }
  const fixed = render({ event_type: 'work', virtual: true, flexibility_type: 'fixed', movable: false, action_route: '/dashboard/assessment/daily-structure' })
  assert.match(fixed, /Fixed commitment. Edit its time in Daily Structure/)
  assert.doesNotMatch(fixed, />Complete<\/button>/)
  assert.match(render({}), />Complete<\/button>/)
  assert.match(render({ status: 'completed' }), />Done<\/span>/)
})
