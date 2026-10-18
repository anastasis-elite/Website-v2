import assert from 'node:assert/strict'
import test, { after, mock } from 'node:test'
import { spawnSync } from 'node:child_process'
import { importTs } from './typescriptModule.mjs'

const adapter = await importTs('lib/schedule/dailyPlanAdapter.ts')
const { zonedDateTimeToUtc, getClientDayRange } = await importTs('lib/schedule/time.ts')
const { getOpenWindows, getActionRouteForEvent } = await importTs('lib/schedule/engine.ts')
const { addLocalDays, localDateKey } = await importTs('lib/timezone.ts')
const { projectCommitmentCalendar } = await importTs('lib/schedule/commitmentCalendar.ts')
const owner = 'synthetic-midnight-owner', clientId = 'QA-MIDNIGHT-BOUNDARY-ONLY'
const monday = '2030-06-17', tuesday = '2030-06-18'
const now = Date.parse('2030-06-18T05:05:00Z')
mock.timers.enable({ apis: ['Date'], now })
after(() => mock.timers.reset())
const profile = (field = 'school_dropoff_time', timezone = 'America/Chicago') => ({
  client_id: clientId, auth_user_id: owner, program: 'ember', timezone, [field]: '23:45',
  daily_structure_reviewed_at: '2030-06-17T12:00:00Z',
  onboarding_data: { scheduleCommitmentWeekdays: { work_days_of_week: [], school_dropoff_days_of_week: [1], school_pickup_days_of_week: [1] }, transitionMinutes: 0 },
})
const fixed = (client, date, blocks = []) => adapter.fixedCommitmentsForDate({ userId: owner, client, date, timezone: client.timezone, blocks })
const ids = events => events.map(event => event.id).sort()
const iso = (date, time, timezone) => zonedDateTimeToUtc(date, time, timezone).toISOString()
const range = (client, date) => ({ start: iso(date, '00:00', client.timezone), end: iso(addLocalDays(date, 1), '00:00', client.timezone) })
const project = (client, bounds, blocks = []) => projectCommitmentCalendar({ userId: owner, client, blocks, ...bounds })
const template = (blockType, extra = {}) => ({ id: `synthetic-${blockType}`, user_id: owner, client_id: clientId, block_type: blockType,
  label: blockType === 'other' ? 'Care visit' : blockType, active: true, days_of_week: [1], start_time: '23:45', end_time: '00:15', ...extra })
const blockTypes = ['sleep', 'work', 'school_dropoff', 'school_pickup', 'commute', 'appointment', 'other']
const mocks = {
  '@/lib/calendar/service': 'export const importedScheduleEvents = async () => []',
  '@/lib/day/getDailyExecutionPlan': `export const getDailyExecutionPlan = async () => { const f=globalThis.midnightFixture; f.healthLoads++; return structuredClone(f.dailyPlan) }`,
  '@/lib/dashboard/logic/getProgramLogicForClient': 'export const getProgramLogicForClient = async () => globalThis.midnightFixture.logic',
}
const { getDailyScheduleState } = await importTs('lib/schedule/service.ts', mocks)

function fixture(client = profile(), blocks = []) {
  const f = { client: structuredClone(client), blocks: structuredClone(blocks), events: [], writes: [], healthLoads: 0,
    dailyPlan: { date: tuesday, timezone: client.timezone, timing: {}, completedDailyTasks: [] } }
  f.logic = { program: 'ember', client: { id: clientId }, nutrition: { dataStatus: 'confirmed', calories: { percent: 100 }, protein: { percent: 100 } },
    hydration: { status: 'complete', target: 80, remaining: 0, consumed: 80 }, assessments: { dailyCompleted: true },
    execution: { nutritionLogged: true, workoutComplete: false, recoveryComplete: true }, workout: { assigned: false }, workoutDecision: { canTrain: true },
    symptoms: { redFlag: false }, recoveryStatus: { reasoning: 'Synthetic existing guidance' }, flameState: { streak: 3, requirements: { requiredItems: { dailyCheckIn: true, hydration: true } } } }
  f.db = { from(table) {
    assert.ok(['clients', 'client_schedule_blocks', 'anastasis_schedule_events'].includes(table), `Unexpected transport: ${table}`)
    const filters = []; let mutation = null
    const q = { select() { return q }, eq(key, value) { filters.push([key, value]); return q }, is(key, value) { filters.push([key, value]); return q },
      or() { return q }, order() { return q }, update(value) { mutation = value; return q },
      async maybeSingle() { const result = resolve(); return { ...result, data: result.data?.[0] || null } },
      then(done, fail) { return Promise.resolve(resolve()).then(done, fail) } }
    function resolve() {
      const rows = table === 'clients' ? [f.client] : table === 'client_schedule_blocks' ? f.blocks : f.events
      const selected = rows.filter(row => filters.every(([key, value]) => key === 'onboarding_data' && typeof value === 'string'
        ? JSON.stringify(row[key]) === value : value === null ? row[key] == null : row[key] === value))
      if (mutation) for (const row of selected) {
        f.writes.push({ table, filters: structuredClone(filters), mutation: structuredClone(mutation) })
        Object.assign(row, structuredClone(mutation))
      }
      return { data: structuredClone(selected), error: null }
    }
    return q
  } }
  globalThis.midnightFixture = f
  return f
}
const context = f => ({ supabase: f.db, user: { id: owner }, client: structuredClone(f.client) })
const load = (f, options = {}) => getDailyScheduleState({ ...context(f), date: tuesday, ...options })

test('Monday 23:45 school anchors remain in Tuesday with their Monday identity and reserve midnight availability', () => {
  for (const [field, kind] of [['school_dropoff_time', 'school-dropoff'], ['school_pickup_time', 'school-pickup']]) {
    const client = profile(field)
    const events = fixed(client, tuesday)
    assert.deepEqual(events.map(event => event.id), [`virtual-${kind}-${monday}`])
    assert.equal(events[0].start_at, '2030-06-18T04:45:00.000Z')
    assert.equal(events[0].end_at, '2030-06-18T05:15:00.000Z')
    assert.equal(events[0].action_route, `/dashboard/schedule?date=${monday}#event-${events[0].id}`)
    const start = zonedDateTimeToUtc(tuesday, '00:00', client.timezone), end = zonedDateTimeToUtc(tuesday, '00:30', client.timezone)
    assert.deepEqual(getOpenWindows(events, start, end, 10, 0), [{ start_at: '2030-06-18T05:15:00.000Z', end_at: '2030-06-18T05:30:00.000Z', minutes: 15 }])
  }
})

test('day, partial-midnight and spanning calendar ranges share one original Monday occurrence for both school anchors', () => {
  for (const [field, kind] of [['school_dropoff_time', 'school-dropoff'], ['school_pickup_time', 'school-pickup']]) {
    const client = profile(field), id = `virtual-${kind}-${monday}`
    const day = project(client, range(client, tuesday))
    const partial = project(client, { start: iso(tuesday, '00:00', client.timezone), end: iso(tuesday, '00:30', client.timezone) })
    const spanning = project(client, { start: range(client, monday).start, end: range(client, tuesday).end })
    assert.deepEqual(ids(day), [id]); assert.deepEqual(partial, day); assert.deepEqual(spanning, day)
    assert.equal(day[0].action_route, `/dashboard/schedule?date=${monday}#event-${id}`)
    assert.ok(!day.some(event => event.id.endsWith(tuesday)))
    assert.deepEqual(project(client, { start: iso(tuesday, '00:15', client.timezone), end: iso(tuesday, '00:30', client.timezone) }), [])
    assert.deepEqual(project(client, { start: iso(monday, '23:30', client.timezone), end: iso(monday, '23:45', client.timezone) }), [])
    assert.deepEqual(fixed(client, '2030-06-19'), [])
  }
})

test('daily state and availability-only readers retain the carryover without creating a Tuesday task or health suggestion', async () => {
  for (const [field, kind] of [['school_dropoff_time', 'school-dropoff'], ['school_pickup_time', 'school-pickup']]) {
    const client = { ...profile(field), preferred_workout_time: '16:00', lunch_window_time: '12:00', dinner_window_time: '18:00' }
    const f = fixture(client), id = `virtual-${kind}-${monday}`
    const state = await load(f, { includeVirtualPlan: false })
    assert.deepEqual(ids(state.events), [id]); assert.deepEqual(ids(state.fixedEvents), [id])
    assert.equal(f.healthLoads, 0)
    const start = zonedDateTimeToUtc(tuesday, '00:00', client.timezone), end = zonedDateTimeToUtc(tuesday, '00:30', client.timezone)
    assert.deepEqual(getOpenWindows(state.fixedEvents, start, end, 10, 0), [{ start_at: iso(tuesday, '00:15', client.timezone), end_at: end.toISOString(), minutes: 15 }])
    const daily = await load(f)
    assert.equal(daily.events.filter(event => event.id === id).length, 1)
    assert.ok(!daily.events.some(event => event.id.startsWith('virtual-school') && event.id.endsWith(tuesday)))
    assert.ok(!daily.events.some(event => event.event_type === 'assessment'))
  }
})

test('prior-day school anchor classification keeps exact-template precedence independent across midnight and template off days', () => {
  const client = { ...profile(), school_pickup_time: '23:45' }
  for (const [type, suppressed, independent] of [['school_dropoff', 'school-dropoff', 'school-pickup'], ['school_pickup', 'school-pickup', 'school-dropoff']]) {
    for (const days_of_week of [[1], [3]]) {
      const blocks = [template(type, { days_of_week })]
      const events = fixed(client, tuesday, blocks)
      const expected = [`virtual-${independent}-${monday}`]
      if (days_of_week.includes(1)) expected.push(`commitment-synthetic-${type}-${monday}`)
      assert.deepEqual(ids(events), expected.sort(), `${type} template weekdays ${days_of_week}`)
      assert.ok(!events.some(event => event.id === `virtual-${suppressed}-${monday}`))
      assert.ok(events.every(event => event.action_route === `/dashboard/schedule?date=${monday}#event-${event.id}`))
      assert.deepEqual(ids(project(client, range(client, tuesday), blocks)), expected)
    }
  }
})

test('school carryovers follow local weekdays and preserve occurrence identity across UTC +14 and −10', () => {
  for (const timezone of ['Pacific/Kiritimati', 'Pacific/Honolulu']) for (const [field, kind] of [['school_dropoff_time', 'school-dropoff'], ['school_pickup_time', 'school-pickup']]) {
    const client = profile(field, timezone), [event] = fixed(client, tuesday)
    assert.ok(event)
    assert.equal(event.id, `virtual-${kind}-${monday}`)
    assert.equal(localDateKey(new Date(event.start_at), timezone), monday)
    assert.equal(localDateKey(new Date(event.end_at), timezone), tuesday)
    assert.equal(event.start_at, iso(monday, '23:45', timezone))
    assert.equal(event.end_at, iso(tuesday, '00:15', timezone))
    assert.deepEqual(project(client, range(client, tuesday)), [event])
    assert.equal(getActionRouteForEvent(event), `/dashboard/schedule?date=${monday}#event-${event.id}`)
  }
})

test('school carryovers intersect US DST days and Havana midnight transitions using instants', () => {
  for (const [timezone, date, dayHours] of [['America/Chicago', '2026-03-08', 23], ['America/Chicago', '2026-11-01', 25],
    ['America/Havana', '2026-03-08', 23], ['America/Havana', '2026-11-01', 25]]) {
    for (const [field, kind] of [['school_dropoff_time', 'school-dropoff'], ['school_pickup_time', 'school-pickup']]) {
      const previous = addLocalDays(date, -1), client = profile(field, timezone)
      client.onboarding_data.scheduleCommitmentWeekdays = { work_days_of_week: [], school_dropoff_days_of_week: [6], school_pickup_days_of_week: [6] }
      const events = fixed(client, date), day = getClientDayRange(client, date)
      assert.deepEqual(ids(events), [`virtual-${kind}-${previous}`], `${timezone} ${date}`)
      const [event] = events
      assert.equal(Date.parse(event.end_at) - Date.parse(event.start_at), 30 * 60000)
      assert.equal((day.end - day.start) / 3600000, dayHours)
      assert.equal(Date.parse(event.end_at) - day.start.getTime(), 15 * 60000)
      assert.ok(Date.parse(event.start_at) < day.start.getTime())
      assert.deepEqual(project(client, range(client, date)), events)
      const firstHalfHour = new Date(day.start.getTime() + 30 * 60000)
      assert.deepEqual(getOpenWindows(events, day.start, firstHalfHour, 10, 0), [{ start_at: event.end_at, end_at: firstHalfHour.toISOString(), minutes: 15 }])
    }
  }
})

test('profile anchors and every supported recurring block ending exactly at midnight do not intersect the next day', async () => {
  for (const field of ['school_dropoff_time', 'school_pickup_time']) {
    const client = { ...profile(field), [field]: '23:30' }
    assert.equal(fixed(client, monday).length, 1)
    assert.deepEqual(fixed(client, tuesday), [])
    assert.deepEqual(project(client, range(client, tuesday)), [])
    assert.deepEqual((await load(fixture(client), { includeVirtualPlan: false })).events, [])
  }
  const client = profile(); client.school_dropoff_time = null
  for (const type of blockTypes) {
    const blocks = [template(type, { start_time: '22:00', end_time: '00:00' })]
    assert.deepEqual(ids(fixed(client, monday, blocks)), [`commitment-synthetic-${type}-${monday}`])
    assert.deepEqual(fixed(client, tuesday, blocks), [], type)
    assert.deepEqual(project(client, range(client, tuesday), blocks), [], type)
    assert.deepEqual((await load(fixture(client, blocks), { includeVirtualPlan: false })).events, [], type)
  }
})

test('all supported overnight recurring block types retain original IDs across midnight and DST', () => {
  const client = profile(); client.school_dropoff_time = null
  for (const type of blockTypes) {
    const blocks = [template(type)]
    const [event] = fixed(client, tuesday, blocks)
    assert.equal(event.id, `commitment-synthetic-${type}-${monday}`)
    assert.equal(event.start_at, iso(monday, '23:45', client.timezone))
    assert.equal(event.end_at, iso(tuesday, '00:15', client.timezone))
    assert.deepEqual(project(client, range(client, tuesday), blocks), [event])
    assert.deepEqual(ids(project(client, { start: range(client, monday).start, end: range(client, tuesday).end }, blocks)), [event.id])
    for (const [date, expectedHours] of [['2026-03-08', 8], ['2026-11-01', 10]]) {
      const overnight = [template(type, { days_of_week: [6], start_time: '22:00', end_time: '07:00' })]
      const [dst] = fixed(client, date, overnight)
      assert.equal(dst.id, `commitment-synthetic-${type}-${addLocalDays(date, -1)}`)
      assert.equal((Date.parse(dst.end_at) - Date.parse(dst.start_at)) / 3600000, expectedHours)
      assert.deepEqual(project(client, range(client, date), overnight), [dst])
    }
  }
})

test('carryover projection is independent of the host timezone at UTC and midnight-transition boundaries', () => {
  const script = `import {importTs} from './tests/typescriptModule.mjs';const a=await importTs('lib/schedule/dailyPlanAdapter.ts');const result=[];
    for(const [timezone,date,day] of [['Pacific/Kiritimati','2030-06-18',1],['Pacific/Honolulu','2030-06-18',1],['America/Havana','2026-03-08',6],['America/Havana','2026-11-01',6]]) {
      const client={client_id:'synthetic',timezone,school_pickup_time:'23:45',onboarding_data:{scheduleCommitmentWeekdays:{school_pickup_days_of_week:[day]}}};
      result.push(a.fixedCommitmentsForDate({userId:'synthetic',client,date,timezone,blocks:[]}).map(e=>[e.id,e.start_at,e.end_at]));}
    console.log(JSON.stringify(result))`
  const outputs = []
  for (const TZ of ['UTC', 'America/Chicago', 'Pacific/Auckland']) {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { env: { ...process.env, TZ }, encoding: 'utf8' })
    assert.equal(result.status, 0, `${TZ}: ${result.stderr}`)
    outputs.push(result.stdout.trim())
  }
  for (const result of outputs) assert.equal(result, outputs[0])
})
