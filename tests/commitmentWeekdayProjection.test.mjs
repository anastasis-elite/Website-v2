import assert from 'node:assert/strict'
import test, { after, mock } from 'node:test'
import { spawnSync } from 'node:child_process'
import { importTs } from './typescriptModule.mjs'

const now = Date.parse('2026-10-12T19:00:00Z'), monday = '2026-10-12'
const owner = 'synthetic-weekday-owner', clientId = 'QA-COMMITMENT-WEEKDAYS-ONLY'
const weekdays = [1, 2, 3, 4, 5], everyDay = [0, 1, 2, 3, 4, 5, 6]
const week = Array.from({ length: 7 }, (_, offset) => new Date(Date.parse(`${monday}T12:00Z`) + offset * 86400000).toISOString().slice(0, 10))
mock.timers.enable({ apis: ['Date'], now })
after(() => mock.timers.reset())
const adapter = await importTs('lib/schedule/dailyPlanAdapter.ts')
const { getClientLocalDate } = await importTs('lib/timezone.ts')
const { getLocalParts } = await importTs('lib/schedule/time.ts')
const { getActionRouteForEvent } = await importTs('lib/schedule/engine.ts')
const { buildWhatsNextState } = await importTs('lib/dashboard/whatsNext.ts')
const { getTierCapabilities } = await importTs('lib/entitlements.ts')
const mocks = {
  '@/lib/calendar/service': 'export const importedScheduleEvents = async () => structuredClone(globalThis.commitmentWeekdayFixture.calendar)',
  '@/lib/day/getDailyExecutionPlan': `export const getDailyExecutionPlan = async () => { const f=globalThis.commitmentWeekdayFixture; f.healthLoads++; return structuredClone(f.dailyPlan) }`,
  '@/lib/dashboard/logic/getProgramLogicForClient': 'export const getProgramLogicForClient = async () => { const f=globalThis.commitmentWeekdayFixture; f.logicLoads++; return f.logic }',
}
const { getDailyScheduleState } = await importTs('lib/schedule/service.ts', mocks)
const baseProfile = {
  client_id: clientId, auth_user_id: owner, program: 'ember', timezone: 'America/Chicago',
  work_start_time: '09:00', work_end_time: '17:00', school_dropoff_time: '08:00', school_pickup_time: '15:00',
  daily_structure_reviewed_at: '2026-10-12T12:00:00Z',
}
const choices = (work = weekdays, dropoff = weekdays, pickup = weekdays) => ({ work_days_of_week: work, school_dropoff_days_of_week: dropoff, school_pickup_days_of_week: pickup })
const profile = (days, extra = {}) => ({ ...baseProfile, ...extra, onboarding_data: { kept: 'original', transitionMinutes: 0,
  ...(days === undefined ? {} : { scheduleCommitmentWeekdays: structuredClone(days) }), ...(extra.onboarding_data || {}) } })
const projected = (client, date, timezone = client.timezone) => adapter.dailyPlanToScheduleEvents({ userId: owner, client, dailyPlan: { date, timezone, timing: {}, completedDailyTasks: [] } })
const fixed = (client, date, blocks = []) => {
  assert.equal(typeof adapter.fixedCommitmentsForDate, 'function', 'The shared fixed-commitment projector must be exported.')
  return adapter.fixedCommitmentsForDate({ userId: owner, client, date, timezone: client.timezone, blocks })
}
const anchorIds = (date, kinds = ['work', 'school-dropoff', 'school-pickup']) => kinds.map(kind => `virtual-${kind}-${date}`)
const ids = events => events.map(event => event.id).sort()
const block = (extra = {}) => ({ id: 'synthetic-dropoff-template', user_id: owner, client_id: clientId, active: true,
  block_type: 'school_dropoff', label: 'Weekday school journey', days_of_week: [1], start_time: '07:45', end_time: '08:15', ...extra })

function fixture({ client = profile(choices()), blocks = [], events = [], calendar = [], failBlocks = false } = {}) {
  const date = getClientLocalDate(client)
  const f = { client: structuredClone(client), blocks: structuredClone(blocks), events: structuredClone(events), calendar: structuredClone(calendar),
    dailyPlan: { date, timezone: client.timezone, timing: {}, completedDailyTasks: [] }, writes: [], healthLoads: 0, logicLoads: 0, failBlocks }
  f.logic = { program: client.program, client: { id: clientId }, nutrition: { dataStatus: 'confirmed', calories: { percent: 100 }, protein: { percent: 100 }, mealSuggestions: [] },
    hydration: { status: 'complete', target: 80, remaining: 0, consumed: 80 }, assessments: { dailyCompleted: true },
    execution: { nutritionLogged: true, workoutComplete: false, recoveryComplete: true }, workout: { assigned: false }, workoutDecision: { canTrain: true },
    symptoms: { redFlag: false }, recoveryStatus: { reasoning: 'Existing guidance' }, flameState: { streak: 5, streakEligible: true,
      requirements: { requiredItems: { dailyCheckIn: true, hydration: true }, completedItems: { dailyCheckIn: true, hydration: true } } } }
  f.db = { from(table) {
    assert.ok(['clients', 'client_schedule_blocks', 'anastasis_schedule_events'].includes(table), `Unexpected database access: ${table}`)
    const filters = []; let mutation = null, ordering = null
    const q = {
      select() { return q }, eq(key, value) { filters.push([key, value]); return q }, is(key, value) { filters.push([key, value]); return q },
      // Time overlap is also checked by the real service after loading; all
      // synthetic persisted rows use fixed dates and remain owner scoped here.
      or() { return q }, order(key, { ascending = true } = {}) { ordering = [key, ascending]; return q },
      update(value) { mutation = value; return q },
      async maybeSingle() { const result = resolve(); return { ...result, data: result.data?.[0] || null } },
      then(done, fail) { return Promise.resolve(resolve()).then(done, fail) },
    }
    function resolve() {
      if (table === 'client_schedule_blocks' && f.failBlocks) return { data: null, error: { message: 'Synthetic recurring source unavailable' } }
      const rows = table === 'clients' ? [f.client] : table === 'client_schedule_blocks' ? f.blocks : f.events
      let found = rows.filter(row => filters.every(([key, value]) => key === 'onboarding_data' && typeof value === 'string'
        ? JSON.stringify(row[key]) === value : value === null ? row[key] == null : row[key] === value))
      if (mutation) for (const row of found) {
        f.writes.push({ table, filters: structuredClone(filters), mutation: structuredClone(mutation) })
        Object.assign(row, structuredClone(mutation))
      }
      if (ordering) { const [key, ascending] = ordering; found = [...found].sort((a, b) => String(a[key]).localeCompare(String(b[key])) * (ascending ? 1 : -1)) }
      return { data: structuredClone(found), error: null }
    }
    return q
  } }
  globalThis.commitmentWeekdayFixture = f
  return f
}
const context = f => ({ supabase: f.db, user: { id: owner }, client: structuredClone(f.client) })
const load = (f, options = {}) => getDailyScheduleState({ ...context(f), date: monday, ...options })
const next = (f, state) => buildWhatsNextState({ tier: f.client.program, capabilities: getTierCapabilities(f.client.program), logic: f.logic, schedule: state })

test('Monday–Friday work and school anchors stay absent on Saturday and Sunday across all tiers', () => {
  for (const program of ['ember', 'ignite', 'phoenix']) for (const [index, date] of week.entries()) {
    const events = projected(profile(choices(), { program }), date)
    assert.deepEqual(ids(events), index < 5 ? anchorIds(date).sort() : [], `${program} ${date}`)
    for (const event of events) {
      assert.equal(event.user_id, owner); assert.equal(event.client_id, clientId)
      assert.equal(event.required, true); assert.equal(event.virtual, true)
      assert.equal(event.action_route, `/dashboard/schedule?date=${date}#event-${event.id}`)
    }
  }
})

test('legacy missing days remain daily, explicit empty arrays suppress anchors, and all seven saved days remain daily', () => {
  for (const date of week) {
    assert.deepEqual(ids(projected(profile(undefined), date)), anchorIds(date).sort())
    assert.deepEqual(projected(profile(choices([], [], [])), date), [])
    assert.deepEqual(ids(projected(profile(choices(everyDay, everyDay, everyDay)), date)), anchorIds(date).sort())
    const partial = profile({ school_dropoff_days_of_week: [] })
    assert.deepEqual(ids(projected(partial, date)), anchorIds(date, ['work', 'school-pickup']).sort())
  }
})

test('weekend work and independent pickup/drop-off selections project their own weekday sets', () => {
  const client = profile(choices([0, 6], [1, 3, 5], [2, 4, 6]))
  for (const date of week) {
    const day = new Date(`${date}T12:00Z`).getUTCDay()
    const expected = []
    if ([0, 6].includes(day)) expected.push(`virtual-work-${date}`)
    if ([1, 3, 5].includes(day)) expected.push(`virtual-school-dropoff-${date}`)
    if ([2, 4, 6].includes(day)) expected.push(`virtual-school-pickup-${date}`)
    assert.deepEqual(ids(projected(client, date)), expected.sort(), date)
  }
})

test('weekday selection follows the member date when UTC event dates cross Sunday or Tuesday at +14 and −10', () => {
  for (const [timezone, time, utcDate] of [['Pacific/Kiritimati', '00:15', '2026-10-11'], ['Pacific/Honolulu', '23:15', '2026-10-13']]) {
    const client = profile(choices([], [1], []), { timezone, school_dropoff_time: time })
    const [event] = projected(client, monday)
    assert.ok(event)
    assert.equal(event.start_at.slice(0, 10), utcDate)
    assert.equal(getClientLocalDate(client, new Date(event.start_at)), monday)
    assert.equal(getLocalParts(new Date(event.start_at), timezone).hour, Number(time.slice(0, 2)))
    assert.equal(getActionRouteForEvent(event), `/dashboard/schedule?date=${monday}#event-${event.id}`)
    assert.deepEqual(projected(client, '2026-10-13'), [])
  }
})

test('commitment dates and exact template overrides are independent of the host timezone', () => {
  const script = `import assert from 'node:assert/strict'; import {importTs} from './tests/typescriptModule.mjs';
    const a=await importTs('lib/schedule/dailyPlanAdapter.ts');
    const client={client_id:'qa-host',timezone:'Pacific/Kiritimati',work_start_time:'09:00',work_end_time:'17:00',school_dropoff_time:'00:15',school_pickup_time:'15:00',
      onboarding_data:{scheduleCommitmentWeekdays:{work_days_of_week:[0,6],school_dropoff_days_of_week:[1,3,5],school_pickup_days_of_week:[2,4,6]}}};
    const blocks=[{id:'host-pickup',block_type:'school_pickup',days_of_week:[2],start_time:'15:00',end_time:'15:30',active:true}];
    const result=[];for(const date of ['2026-10-12','2026-10-13','2026-10-17','2026-10-18']) result.push(a.fixedCommitmentsForDate({userId:'qa',client,date,timezone:client.timezone,blocks}).map(e=>[e.id,e.start_at,e.end_at]));
    console.log(JSON.stringify(result));`
  const outputs = []
  for (const TZ of ['UTC', 'America/Chicago', 'America/Havana', 'Europe/London', 'Pacific/Auckland']) {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { env: { ...process.env, TZ }, encoding: 'utf8' })
    assert.equal(result.status, 0, `${TZ}: ${result.stderr}`)
    outputs.push(result.stdout.trim())
  }
  for (const result of outputs) assert.equal(result, outputs[0])
})

test('active exact recurring templates override only their own profile anchor on occurrence days and off days', () => {
  const client = profile(choices(everyDay, everyDay, everyDay))
  for (const [type, anchor] of [['work', 'work'], ['school_dropoff', 'school-dropoff'], ['school_pickup', 'school-pickup']]) {
    const template = block({ block_type: type })
    for (const [index, date] of week.entries()) {
      const events = fixed(client, date, [template])
      const expected = anchorIds(date).filter(id => id !== `virtual-${anchor}-${date}`)
      if (index === 0) expected.push(`commitment-${template.id}-${date}`)
      assert.deepEqual(ids(events), expected.sort(), `${type} ${date}`)
    }
  }
  assert.deepEqual(ids(fixed(client, monday, [block({ active: false })])), anchorIds(monday).sort())
  const generic = block({ block_type: 'school', id: 'generic-school' })
  assert.deepEqual(ids(fixed(client, monday, [generic])), [...anchorIds(monday), `commitment-${generic.id}-${monday}`].sort())
})

test('recurring overnight work spans DST correctly and never revives the profile work anchor on its off day', () => {
  const client = profile(choices(everyDay, [], []))
  const template = block({ id: 'night-work', block_type: 'work', days_of_week: [6], start_time: '22:00', end_time: '07:00' })
  for (const [date, originalDate, elapsed] of [['2026-03-08', '2026-03-07', 8], ['2026-11-01', '2026-10-31', 10]]) {
    const [event, ...extra] = fixed(client, date, [template])
    assert.deepEqual(extra, [])
    assert.equal(event.id, `commitment-night-work-${originalDate}`)
    assert.equal(getClientLocalDate(client, new Date(event.start_at)), originalDate)
    assert.equal(getClientLocalDate(client, new Date(event.end_at)), date)
    assert.equal((Date.parse(event.end_at) - Date.parse(event.start_at)) / 3600000, elapsed)
    assert.equal(getLocalParts(new Date(event.start_at), client.timezone).hour, 22)
    assert.equal(getLocalParts(new Date(event.end_at), client.timezone).hour, 7)
  }
  assert.deepEqual(fixed(client, '2026-11-02', [template]), [])
})

test('availability-only service calls include profile commitments and exclude health suggestions or health loads', async () => {
  const f = fixture({ client: profile(choices(), { preferred_workout_time: '16:00', lunch_window_time: '12:00', dinner_window_time: '18:00' }) })
  const state = await load(f, { includeVirtualPlan: false })
  assert.deepEqual(ids(state.events), anchorIds(monday).sort())
  assert.equal(f.healthLoads, 0); assert.equal(f.logicLoads, 0)
  assert.ok(state.events.every(event => !event.suggested && ['work', 'school'].includes(event.event_type)))
  for (const window of state.openWindows) for (const event of state.events) {
    assert.ok(Date.parse(window.end_at) <= Date.parse(event.start_at) || Date.parse(window.start_at) >= Date.parse(event.end_at), 'Availability must not overlap a fixed commitment.')
  }
  const weekend = await load(f, { date: '2026-10-17', includeVirtualPlan: false })
  assert.deepEqual(weekend.events, [])
  assert.equal(weekend.openWindows.reduce((sum, window) => sum + window.minutes, 0), 1440)
})

test('service off-day templates do not fall back to daily anchors and an unavailable source remains explicit', async () => {
  const f = fixture({ client: profile(choices(everyDay, everyDay, everyDay)), blocks: [block()] })
  const mondayState = await load(f)
  assert.deepEqual(ids(mondayState.events), [`commitment-synthetic-dropoff-template-${monday}`, ...anchorIds(monday, ['work', 'school-pickup'])].sort())
  const tuesdayState = await load(f, { date: '2026-10-13' })
  assert.deepEqual(ids(tuesdayState.events), anchorIds('2026-10-13', ['work', 'school-pickup']).sort())
  f.failBlocks = true
  const previousError = console.error
  try {
    console.error = () => {}
    const fallback = await load(f, { includeVirtualPlan: false })
    assert.deepEqual(ids(fallback.events), anchorIds(monday).sort())
    assert.deepEqual(fallback.unavailableSources, ['recurring_commitments'])
  } finally { console.error = previousError }
})

test('selected future and past weekdays retain fixed commitments without copying current health completion', async () => {
  const f = fixture({ client: profile(choices(), { preferred_workout_time: '16:00', lunch_window_time: '12:00', dinner_window_time: '18:00' }) })
  f.dailyPlan.workoutCompleted = true
  for (const date of ['2026-10-09', '2026-10-13', '2026-10-17']) {
    const state = await load(f, { date })
    assert.deepEqual(ids(state.events), date.endsWith('17') ? [] : anchorIds(date).sort())
    assert.ok(state.events.every(event => event.status === 'scheduled'))
    assert.ok(state.events.every(event => !['workout', 'meal', 'recovery', 'assessment'].includes(event.event_type)))
  }
})

test('service default day follows member timezone on opposite sides of the UTC date boundary', async t => {
  mock.timers.setTime(Date.parse('2026-10-12T00:30:00Z'))
  t.after(() => mock.timers.setTime(now))
  for (const [timezone, expectedDate, expectedCount] of [['Pacific/Kiritimati', monday, 3], ['Pacific/Honolulu', '2026-10-11', 0]]) {
    const f = fixture({ client: profile(choices(), { timezone }) })
    const state = await getDailyScheduleState({ ...context(f), includeVirtualPlan: false })
    assert.equal(state.date, expectedDate)
    assert.equal(state.events.length, expectedCount)
  }
})

test('foreign template rows and owner/client-mismatched saved snapshots cannot change this member’s projection', async () => {
  const f = fixture({ client: profile(choices(everyDay, [], [])), blocks: [block({ block_type: 'work', user_id: 'other-owner' }), block({ block_type: 'work', id: 'other-client', client_id: 'OTHER-CLIENT' })] })
  const state = await load(f, { includeVirtualPlan: false })
  assert.deepEqual(ids(state.events), [`virtual-work-${monday}`])
  const snapshot = state.events[0]
  f.client.onboarding_data.scheduleCommitmentWeekdays.work_days_of_week = []
  for (const mismatch of [{ user_id: 'other-owner' }, { client_id: 'OTHER-CLIENT' }]) {
    f.client.onboarding_data.scheduleOverrides = { [snapshot.id]: { status: 'completed', completed_at: new Date(now).toISOString(), event_snapshot: { ...snapshot, ...mismatch } } }
    assert.deepEqual((await load(f, { includeVirtualPlan: false })).events, [])
  }
  assert.equal(f.writes.length, 0)
})
