import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { importTs } from './typescriptModule.mjs'

const { projectCommitmentCalendar, getCommitmentCalendarRange } = await importTs('lib/schedule/commitmentCalendar.ts')
const { getClientDayRange } = await importTs('lib/schedule/time.ts')
const { localDateKey } = await importTs('lib/timezone.ts')
const time = await importTs('lib/schedule/time.ts')
const timezone = await importTs('lib/timezone.ts')
const calendarView = await importTs('lib/calendar/view.ts')
const calendarDismissals = await importTs('lib/calendar/dismissals.ts')
const require = createRequire(import.meta.url)
const { getDailyScheduleState } = await importTs('lib/schedule/service.ts', {
  '@/lib/calendar/service': 'export const importedScheduleEvents = async () => []',
  '@/lib/day/getDailyExecutionPlan': 'export const getDailyExecutionPlan = async () => null',
  '@/lib/dashboard/logic/getProgramLogicForClient': 'export const getProgramLogicForClient = async () => null',
})

const owner = 'qa-commitment-owner', clientId = 'QA-COMMITMENT-CALENDAR'
const weekdays = [1, 2, 3, 4, 5]
const client = (extra = {}) => ({ client_id: clientId, auth_user_id: owner, program: 'ember', timezone: 'America/Chicago',
  work_start_time: '09:00', work_end_time: '17:00', school_dropoff_time: '08:00', school_pickup_time: '15:00',
  onboarding_data: {}, ...extra })
const days = values => ({ scheduleCommitmentWeekdays: values })
const mondayToFriday = { work_days_of_week: weekdays, school_dropoff_days_of_week: weekdays, school_pickup_days_of_week: weekdays }
const disabled = { work_days_of_week: [], school_dropoff_days_of_week: [], school_pickup_days_of_week: [] }
const block = (extra = {}) => ({ id: 'qa-work', user_id: owner, client_id: clientId, active: true,
  block_type: 'work', label: 'Confirmed work', days_of_week: weekdays, start_time: '09:00', end_time: '17:00', ...extra })
const range = (date, timezone = 'America/Chicago') => {
  const day = getClientDayRange({ timezone }, date)
  return { start: day.start.toISOString(), end: day.end.toISOString() }
}
const week = { start: '2026-10-12T05:00:00.000Z', end: '2026-10-19T05:00:00.000Z' }
const project = (member = client(), window = week, blocks = []) =>
  projectCommitmentCalendar({ userId: owner, client: member, ...window, blocks })
const ids = events => events.map(event => event.id).sort()
const display = events => events.map(({ id, status, start_at, end_at, adjusted_start_at, adjusted_end_at, completed_at }) =>
  ({ id, status, start_at, end_at, adjusted_start_at, adjusted_end_at, completed_at })).sort((a, b) => a.id.localeCompare(b.id))

function database({ blocks = [], error = null, throws = false, allowSchedule = false } = {}) {
  const queries = [], reads = []
  return { queries, reads, from(table) {
    assert.ok(table === 'client_schedule_blocks' || allowSchedule && table === 'anastasis_schedule_events', `Unexpected table: ${table}`)
    const filters = [], query = { table, filters }; queries.push(query)
    const result = () => {
      reads.push(query)
      if (throws) throw new Error('Synthetic unavailable source')
      const rows = table === 'client_schedule_blocks' ? blocks : []
      return { data: error ? null : structuredClone(rows.filter(row => filters.every(([key, value]) => row[key] === value))), error }
    }
    const q = { select() { return q }, eq(key, value) { filters.push([key, value]); return q }, or() { return q },
      order: async () => result(), then(resolve, reject) { return Promise.resolve().then(result).then(resolve, reject) } }
    return q
  } }
}

test('explicit Monday–Friday profile anchors appear once each weekday and never on the weekend', () => {
  const member = client({ onboarding_data: days(mondayToFriday) }), before = structuredClone(member), events = project(member)
  const expected = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16']
    .flatMap(date => [`virtual-work-${date}`, `virtual-school-dropoff-${date}`, `virtual-school-pickup-${date}`]).sort()
  assert.deepEqual(ids(events), expected)
  assert.equal(new Set(events.map(event => event.id)).size, events.length)
  for (const event of events) {
    assert.equal(event.user_id, owner); assert.equal(event.client_id, clientId); assert.equal(event.virtual, true)
    assert.equal(event.status, 'scheduled'); assert.equal(event.flexibility_type, 'fixed')
    assert.equal(event.action_route, `/dashboard/schedule?date=${localDateKey(new Date(event.start_at), member.timezone)}#event-${event.id}`)
  }
  assert.deepEqual(project(member, range('2026-10-17')), [])
  assert.deepEqual(project(member, range('2026-10-18')), [])
  assert.deepEqual(member, before, 'calendar reads must not rewrite member preferences')
})

test('omitted legacy weekday choices preserve existing daily anchors until the member explicitly changes them', () => {
  const member = client(), events = project(member)
  assert.equal(events.length, 21)
  for (const date of ['2026-10-17', '2026-10-18']) {
    assert.deepEqual(ids(project(member, range(date))), [`virtual-work-${date}`, `virtual-school-dropoff-${date}`, `virtual-school-pickup-${date}`].sort())
  }
})

test('custom weekdays apply independently to work, drop-off, and pickup, including explicit empty choices', () => {
  const member = client({ onboarding_data: days({ work_days_of_week: [6], school_dropoff_days_of_week: [0], school_pickup_days_of_week: [2, 4] }) })
  assert.deepEqual(ids(project(member)), ['virtual-work-2026-10-17', 'virtual-school-dropoff-2026-10-18',
    'virtual-school-pickup-2026-10-13', 'virtual-school-pickup-2026-10-15'].sort())
  assert.deepEqual(project(client({ onboarding_data: days(disabled) })), [])
  const partial = client({ onboarding_data: days({ work_days_of_week: [] }) })
  assert.equal(project(partial).filter(event => event.event_type === 'school').length, 14, 'omitted school choices retain legacy daily behavior')
  assert.equal(project(partial).some(event => event.event_type === 'work'), false)
})

test('member-local dates select weekdays and timestamps even when UTC is on another day', () => {
  for (const [timezone, startTime, endTime, expected] of [
    ['America/Chicago', '00:15', '02:00', '2026-10-12T05:15:00.000Z'],
    ['Pacific/Kiritimati', '00:15', '02:00', '2026-10-11T10:15:00.000Z'],
    ['Pacific/Honolulu', '23:00', '23:30', '2026-10-13T09:00:00.000Z'],
  ]) {
    const member = client({ timezone, work_start_time: startTime, work_end_time: endTime, onboarding_data: days(mondayToFriday) })
    const events = project(member, range('2026-10-12', timezone)), work = events.find(event => event.event_type === 'work')
    assert.equal(events.length, 3); assert.equal(work.id, 'virtual-work-2026-10-12'); assert.equal(work.start_at, expected)
    assert.equal(localDateKey(new Date(work.start_at), timezone), '2026-10-12')
    assert.deepEqual(project(member, range('2026-10-11', timezone)), [])
  }
})

test('explicit Sunday commitments retain their local date through DST changes', () => {
  const member = client({ work_start_time: '01:30', work_end_time: '03:30', school_dropoff_time: null, school_pickup_time: null,
    onboarding_data: days({ work_days_of_week: [0] }) })
  for (const [date, expectedStart, expectedEnd] of [
    ['2026-03-08', '2026-03-08T07:30:00.000Z', '2026-03-08T08:30:00.000Z'],
    ['2026-11-01', '2026-11-01T06:30:00.000Z', '2026-11-01T09:30:00.000Z'],
  ]) {
    const events = project(member, range(date))
    assert.deepEqual(ids(events), [`virtual-work-${date}`]); assert.equal(events[0].start_at, expectedStart); assert.equal(events[0].end_at, expectedEnd)
  }
})

test('range intersection uses instants with exclusive ends rather than expanding partial days', () => {
  const member = client({ school_dropoff_time: null, school_pickup_time: null })
  assert.equal(project(member, { start: '2026-10-12T14:00:00Z', end: '2026-10-12T22:00:00Z' }).length, 1)
  assert.equal(project(member, { start: '2026-10-12T21:59:59Z', end: '2026-10-12T22:00:00Z' }).length, 1)
  assert.deepEqual(project(member, { start: '2026-10-12T22:00:00Z', end: '2026-10-13T05:00:00Z' }), [])
  assert.deepEqual(project(member, { start: '2026-10-12T05:00:00Z', end: '2026-10-12T14:00:00Z' }), [])
})

test('recurring blocks take precedence by exact anchor without hiding a distinct school pickup', () => {
  const blocks = [block({ id: 'custom-work', days_of_week: [2], start_time: '10:00', end_time: '16:00' }),
    block({ id: 'custom-dropoff', block_type: 'school_dropoff', label: 'School arrival', days_of_week: [2], start_time: '07:30', end_time: '08:00' })]
  assert.deepEqual(ids(project(client(), range('2026-10-12'), blocks)), ['virtual-school-pickup-2026-10-12'])
  assert.deepEqual(ids(project(client(), range('2026-10-13'), blocks)), ['commitment-custom-work-2026-10-13',
    'commitment-custom-dropoff-2026-10-13', 'virtual-school-pickup-2026-10-13'].sort())
  assert.deepEqual(ids(project(client(), range('2026-10-12'), [block({ active: false })])),
    ['virtual-work-2026-10-12', 'virtual-school-dropoff-2026-10-12', 'virtual-school-pickup-2026-10-12'].sort())
})

test('overnight recurring occurrences overlap both local days once with their original stable identity', () => {
  const blocks = [block({ id: 'night-shift', days_of_week: [5], start_time: '22:00', end_time: '07:00' })]
  const member = client({ school_dropoff_time: null, school_pickup_time: null })
  const events = project(member, { start: '2026-10-16T05:00:00Z', end: '2026-10-18T05:00:00Z' }, blocks)
  assert.deepEqual(ids(events), ['commitment-night-shift-2026-10-16'])
  const saturday = project(member, range('2026-10-17'), blocks)
  assert.deepEqual(display(saturday), display(events))
  assert.equal(events[0].start_at, '2026-10-17T03:00:00.000Z'); assert.equal(events[0].end_at, '2026-10-17T12:00:00.000Z')
  assert.deepEqual(project(member, { start: '2026-10-17T12:00:00Z', end: '2026-10-18T05:00:00Z' }, blocks), [])
})

test('calendar projection and daily schedule retain the same per-occurrence statuses and times', async () => {
  const window = range('2026-10-12'), blocks = [block({ id: 'confirmed-work' })], member = client()
  const first = project(member, window, blocks), work = first.find(event => event.event_type === 'work')
  const pickup = first.find(event => event.id.includes('pickup'))
  member.onboarding_data.scheduleOverrides = {
    [work.id]: { status: 'completed', completed_at: '2026-10-12T22:00:00Z', event_snapshot: work },
    [pickup.id]: { status: 'skipped', event_snapshot: pickup },
  }
  const db = database({ blocks, allowSchedule: true })
  const state = await getDailyScheduleState({ supabase: db, user: { id: owner }, client: member, date: '2026-10-12',
    dailyPlan: { date: '2026-10-12', timezone: member.timezone, timing: {}, completedDailyTasks: [] } })
  assert.deepEqual(display(project(member, window, blocks)), display(state.events.filter(event => ['work', 'school'].includes(event.event_type))))
})

test('range loader queries active blocks once with owner and client scopes for the entire range', async () => {
  const member = client(), db = database({ blocks: [block(), block({ id: 'foreign', user_id: 'someone-else' }), block({ id: 'inactive', active: false })] })
  const result = await getCommitmentCalendarRange({ supabase: db, user: { id: owner }, client: member, ...week })
  assert.equal(result.commitmentsUnavailable, false); assert.equal(db.queries.length, 1); assert.equal(db.reads.length, 1)
  assert.deepEqual(db.queries[0].filters.slice().sort(), [['active', true], ['client_id', clientId], ['user_id', owner]].sort())
  assert.deepEqual(ids(result.commitmentEvents), ids(project(member, week, [block()])))
})

test('block read errors and exceptions preserve profile fallback and expose unavailable status', async () => {
  for (const options of [{ error: { message: 'Synthetic unavailable source' } }, { throws: true }]) {
    const member = client(), db = database(options)
    const result = await getCommitmentCalendarRange({ supabase: db, user: { id: owner }, client: member, ...week })
    assert.equal(result.commitmentsUnavailable, true); assert.equal(db.queries.length, 1)
    assert.deepEqual(display(result.commitmentEvents), display(project(member)))
  }
})

test('invalid, reversed, and over-400-day ranges fail before querying while the maximum valid range remains readable', async () => {
  const member = client({ onboarding_data: days(disabled) }), start = '2026-01-01T00:00:00.000Z'
  for (const window of [{ start: 'invalid', end: week.end }, { start: week.start, end: 'invalid' },
    { start: week.start, end: week.start }, { start: week.end, end: week.start },
    { start, end: new Date(Date.parse(start) + 400 * 86400000 + 1).toISOString() }]) {
    assert.throws(() => project(member, window))
    const db = database()
    await assert.rejects(getCommitmentCalendarRange({ supabase: db, user: { id: owner }, client: member, ...window }))
    assert.equal(db.queries.length, 0)
  }
  const window = { start, end: new Date(Date.parse(start) + 400 * 86400000).toISOString() }
  assert.deepEqual(project(member, window), [])
})

function descendants(tree, predicate) {
  if (!tree || typeof tree !== 'object') return []
  if (Array.isArray(tree)) return tree.flatMap(child => descendants(child, predicate))
  return [...(predicate(tree) ? [tree] : []), ...descendants(tree.props?.children, predicate)]
}
function dashboardCalendar(schedule, response = {}, mode = 'week') {
  const states = [], requests = []
  let cursor = 0
  const react = { useState(initial) { const i = cursor++; if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial
    return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value }] },
  useEffect() {}, useMemo: callback => callback() }
  const mocks = {
    react, 'react/jsx-runtime': require('react/jsx-runtime'), 'next/link': () => null,
    '@/components/dashboard/useViewPreference': { useViewPreference(_client, key) { return react.useState(key === 'calendar-mode' ? mode : 'morning') } },
    '@/lib/timezone': timezone, '@/lib/schedule/time': time, '@/lib/calendar/view': calendarView, '@/lib/calendar/dismissals': calendarDismissals,
    '@/lib/calendar/client': { useCalendarEvents(start, end, zone) { requests.push({ start, end, timezone: zone }); return { events: [], ...response } } },
  }
  const module = { exports: {} }
  const compiled = ts.transpileModule(readFileSync('components/program-dashboard/DashboardCalendar.tsx', 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText
  runInNewContext(compiled, { module, exports: module.exports, Date,
    require(name) { assert.ok(name in mocks, `Unexpected calendar dependency: ${name}`); return mocks[name] },
  })
  const render = () => { cursor = 0; return module.exports.default({ schedule, planBlocks: [], clientId }) }
  const pills = () => descendants(render(), node => node.type?.name === 'CalendarPill').map(node => node.props.item)
  return { render, pills, requests,
    click(label) { const button = descendants(render(), node => node.type === 'button' && (node.props.children === label || node.props['aria-label'] === label))[0]
      assert.ok(button, `Missing calendar button: ${label}`); button.props.onClick() },
  }
}
function calendarState(events = [], extra = {}) {
  return { date: '2026-10-12', timezone: 'America/Chicago', now: '2026-10-12T14:00:00Z', events, openWindows: [], ...extra }
}

test('dashboard week and month navigation show ranged member-local commitments with weekend/custom filtering', () => {
  const member = client({ onboarding_data: days({ ...mondayToFriday, school_pickup_days_of_week: [6] }) })
  const ranged = project(member), current = project(member, range('2026-10-12'))
  const view = dashboardCalendar(calendarState(current), { commitmentEvents: ranged })
  const pills = view.pills()
  assert.equal(pills.filter(item => item.date === '2026-10-13').length, 2)
  assert.equal(pills.filter(item => item.date === '2026-10-17').length, 1)
  assert.equal(pills.filter(item => item.date === '2026-10-18').length, 0)
  assert.equal(new Set(pills.map(item => item.id)).size, pills.length)
  view.click('month')
  const saturday = descendants(view.render(), node => node.type === 'button' && node.props['aria-label'] === 'Open 2026-10-17, 1 event')[0]
  assert.ok(saturday, 'custom Saturday pickup appears in the month grid')
  saturday.props.onClick()
  assert.equal(view.pills().length, 0, 'morning filter excludes the afternoon pickup')
  view.click('midday')
  assert.deepEqual(view.pills().map(item => item.event.id), ['virtual-school-pickup-2026-10-17'])
  assert.equal(view.requests.at(-1).timezone, member.timezone)
})

test('current daily outcomes and absence win over stale ranged commitments without duplicating effective-time imports', () => {
  const ranged = project(client({ onboarding_data: days(mondayToFriday) }))
  const current = project(client(), range('2026-10-12'))
  const work = { ...current.find(event => event.event_type === 'work'), status: 'completed' }
  const pickup = { ...current.find(event => event.id.includes('pickup')), status: 'skipped' }
  const moved = { ...work, id: 'qa-moved', title: 'Moved saved event', virtual: false, source: 'manual', status: 'scheduled',
    adjusted_start_at: '2026-10-12T23:00:00Z', adjusted_end_at: '2026-10-13T00:00:00Z' }
  const view = dashboardCalendar(calendarState([work, pickup, moved]), { commitmentEvents: ranged, events: [{
    id: moved.id, title: moved.title, start_at: moved.adjusted_start_at, end_at: moved.adjusted_end_at, all_day: false, calendar_id: null,
  }] })
  const pills = view.pills(), monday = pills.filter(item => item.date === '2026-10-12')
  assert.equal(monday.filter(item => item.event?.id === work.id).length, 1)
  assert.equal(monday.find(item => item.event?.id === work.id).status, 'completed')
  assert.equal(monday.some(item => item.event?.id === pickup.id), false)
  assert.equal(monday.some(item => item.event?.id?.includes('dropoff')), false, 'a removed current-day anchor is not restored by an older range snapshot')
  assert.equal(monday.filter(item => item.title === moved.title).length, 1)
  assert.ok(pills.some(item => item.date === '2026-10-13'), 'other local dates retain their ranged commitments')
})

test('overnight commitment calendar pills span visible local dates once per date', () => {
  const ranged = project(client({ onboarding_data: days(disabled) }), week, [block({ id: 'night', days_of_week: [5], start_time: '22:00', end_time: '07:00' })])
  const view = dashboardCalendar(calendarState(), { commitmentEvents: ranged })
  const pills = view.pills().filter(item => item.event?.id === 'commitment-night-2026-10-16')
  assert.deepEqual(pills.map(item => item.date), ['2026-10-16', '2026-10-17'])
})

test('unknown recurring commitments show a warning and cannot advertise open-time suggestions', () => {
  const view = dashboardCalendar(calendarState([], { openWindows: [{ start_at: '2026-10-12T14:00:00Z', end_at: '2026-10-12T15:00:00Z', minutes: 60 }] }),
    { commitmentsUnavailable: true, commitmentEvents: [] })
  assert.equal(view.pills().some(item => item.source === 'suggestion'), false)
  assert.ok(descendants(view.render(), node => node.props?.role === 'status' && /recurring commitments could not be loaded/.test(node.props.children)).length)
})

test('expanding visible commitment dates preserves existing single-day suggestion dismissal identities', () => {
  const original = project(client(), range('2026-10-12')).find(event => event.event_type === 'work')
  const suggestion = { ...original, id: 'virtual-workout-2026-10-12', event_type: 'workout', suggested: true, required: false }
  const item = dashboardCalendar(calendarState([suggestion])).pills().find(item => item.event?.id === suggestion.id)
  assert.equal(calendarDismissals.calendarSuggestionKey(item), `${suggestion.id}:${suggestion.start_at}:${suggestion.end_at}`)
})

test('empty week labels distinguish loading, unavailable sources, and a known empty schedule without implying free time', () => {
  for (const [response, label] of [
    [{ loading: true }, 'Loading…'],
    [{ commitmentsUnavailable: true }, 'Unavailable'],
    [{ error: 'Synthetic calendar read failed.' }, 'Unavailable'],
    [{}, 'No scheduled items'],
  ]) {
    const tree = dashboardCalendar(calendarState(), response).render()
    const labels = descendants(tree, node => node.type === 'small').map(node => node.props.children)
    assert.equal(labels.filter(value => value === label).length, 7)
    assert.equal(labels.includes('Open'), false)
  }
})

test('the actual Tuesday daily pipeline renders Monday school carryovers once on each visible local date', async () => {
  for (const kind of ['dropoff', 'pickup']) {
    const member = client({ work_start_time: null, work_end_time: null,
      school_dropoff_time: kind === 'dropoff' ? '23:45' : null, school_pickup_time: kind === 'pickup' ? '23:45' : null,
      onboarding_data: days({ ...disabled, [`school_${kind}_days_of_week`]: [1] }) })
    const ranged = project(member), id = `virtual-school-${kind}-2026-10-12`
    assert.deepEqual(ids(ranged), [id])
    const daily = await getDailyScheduleState({ supabase: database({ allowSchedule: true }), user: { id: owner }, client: member,
      date: '2026-10-13', includeVirtualPlan: false })
    assert.deepEqual(ids(daily.events), [id], 'the shared daily projection includes its valid previous-local-day carryover')
    const view = dashboardCalendar(daily, { commitmentEvents: ranged })
    const pills = view.pills().filter(item => item.event?.id === id)
    assert.deepEqual(pills.map(item => item.date), ['2026-10-12', '2026-10-13'], 'the daily occurrence identity survives range merging across midnight')
    assert.equal(new Set(pills.map(item => item.id)).size, 2)
    view.click('month')
    for (const date of ['2026-10-12', '2026-10-13']) assert.ok(descendants(view.render(), node => node.type === 'button' && node.props['aria-label'] === `Open ${date}, 1 event`).length)
  }
})

test('actual daily terminal outcomes override older ranged carryovers and a newer weekday removal suppresses them', async () => {
  const member = client({ work_start_time: null, work_end_time: null, school_dropoff_time: '23:45', school_pickup_time: null,
    onboarding_data: days({ ...disabled, school_dropoff_days_of_week: [1] }) })
  const carryover = project(member)[0]
  for (const status of ['completed', 'skipped', 'cancelled']) {
    // Cancellation has no checklist endpoint; include the same daily terminal
    // projection directly while complete/skip exercise persisted overrides.
    const savedMember = { ...member, onboarding_data: { ...member.onboarding_data,
      scheduleOverrides: { [carryover.id]: { status, event_snapshot: carryover } } } }
    const state = await getDailyScheduleState({ supabase: database({ allowSchedule: true }), user: { id: owner }, client: savedMember,
      date: '2026-10-13', includeVirtualPlan: false })
    if (status === 'cancelled') state.events = [{ ...carryover, status }]
    const pills = dashboardCalendar(state, { commitmentEvents: [carryover] }).pills().filter(item => item.event?.id === carryover.id)
    assert.equal(pills.length, status === 'completed' ? 2 : 0)
    assert.ok(pills.every(item => item.status === status))
  }
  const sameDay = { ...carryover, id: 'virtual-school-dropoff-2026-10-13',
    start_at: '2026-10-13T13:00:00Z', end_at: '2026-10-13T13:30:00Z' }
  const removedMember = { ...member, onboarding_data: days(disabled) }
  const fresh = await getDailyScheduleState({ supabase: database({ allowSchedule: true }), user: { id: owner }, client: removedMember,
    date: '2026-10-13', includeVirtualPlan: false })
  assert.deepEqual(fresh.events, [])
  const pills = dashboardCalendar(fresh, { commitmentEvents: [carryover, sameDay] }).pills().filter(item => item.event)
  assert.equal(pills.length, 0, 'newer routine removal suppresses stale overlapping anchors from both Monday and Tuesday')
})
