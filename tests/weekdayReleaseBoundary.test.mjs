import assert from 'node:assert/strict'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'

const { dailyPlanToScheduleEvents, fixedCommitmentsForDate } = await importTs('lib/schedule/dailyPlanAdapter.ts')
const { projectCommitmentCalendar, getCommitmentCalendarRange } = await importTs('lib/schedule/commitmentCalendar.ts')
const { getCommitmentWeekdays } = await importTs('lib/assessment/commitmentWeekdays.ts')
const userId = 'synthetic-weekday-owner', clientId = 'SYNTHETIC-WEEKDAY-ONLY'
const weekdays = [1, 2, 3, 4, 5]
const week = ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25']
const clone = value => structuredClone(value)
const member = (days, changes = {}) => ({ client_id: clientId, auth_user_id: userId,
  timezone: 'UTC', school_dropoff_time: '08:00', school_pickup_time: '15:00',
  onboarding_data: days === undefined ? { retained: 'synthetic-existing-value' } : {
    retained: 'synthetic-existing-value', scheduleCommitmentWeekdays: clone(days),
  }, ...changes,
})
const daily = (client, date, blocks = []) => fixedCommitmentsForDate({ userId, client, date, timezone: client.timezone, blocks })
const calendar = (client, start, end, blocks = []) => projectCommitmentCalendar({ userId, client, start, end, blocks })
const kinds = events => events.map(event => event.id.includes('school-dropoff') ? 'dropoff' : event.id.includes('school-pickup') ? 'pickup' : event.event_type).sort()

test('explicit Monday-Friday school choices are absent on both weekend dates in daily and calendar projections', () => {
  const client = member({ school_dropoff_days_of_week: weekdays, school_pickup_days_of_week: weekdays })
  for (const [index, date] of week.entries()) {
    const events = daily(client, date)
    assert.deepEqual(kinds(events), index < 5 ? ['dropoff', 'pickup'] : [])
    const adapter = dailyPlanToScheduleEvents({ userId, client, dailyPlan: { date, timezone: 'UTC', timing: {} }, includeHealthActivities: false })
    assert.deepEqual(events.map(event => event.id), adapter.map(event => event.id))
  }
  const visible = calendar(client, '2026-10-19T00:00:00Z', '2026-10-26T00:00:00Z')
  assert.equal(visible.length, 10)
  assert.ok(visible.every(event => !/2026-10-(24|25)$/.test(event.id)))
})

test('chosen custom weekends remain valid and drop-off and pickup have independent days', () => {
  const client = member({ school_dropoff_days_of_week: [0], school_pickup_days_of_week: [6] })
  assert.deepEqual(kinds(daily(client, '2026-10-24')), ['pickup'])
  assert.deepEqual(kinds(daily(client, '2026-10-25')), ['dropoff'])
  assert.deepEqual(daily(client, '2026-10-26'), [])
  const visible = calendar(client, '2026-10-24T00:00:00Z', '2026-10-26T00:00:00Z')
  assert.deepEqual(visible.map(event => event.id), ['virtual-school-pickup-2026-10-24', 'virtual-school-dropoff-2026-10-25'])
})

test('missing explicit metadata retains all seven legacy days and an explicit empty choice removes only that kind', () => {
  const legacy = member()
  assert.equal(getCommitmentWeekdays(legacy, 'school_dropoff_days_of_week'), undefined)
  for (const date of week) assert.deepEqual(kinds(daily(legacy, date)), ['dropoff', 'pickup'])
  assert.equal(calendar(legacy, '2026-10-19T00:00:00Z', '2026-10-26T00:00:00Z').length, 14)
  const noDropoff = member({ school_dropoff_days_of_week: [] })
  for (const date of week) assert.deepEqual(kinds(daily(noDropoff, date)), ['pickup'])
})

test('an active drop-off template suppresses its profile fallback even on an excluded day without suppressing pickup', () => {
  const client = member()
  const block = { id: 'synthetic-dropoff-template', user_id: userId, client_id: clientId, active: true,
    block_type: 'school_dropoff', label: 'Synthetic school drop-off', days_of_week: weekdays, start_time: '07:30', end_time: '08:00' }
  const sunday = daily(client, '2026-10-25', [block])
  assert.deepEqual(sunday.map(event => event.id), ['virtual-school-pickup-2026-10-25'])
  const monday = daily(client, '2026-10-26', [block])
  assert.equal(monday.some(event => event.id === 'commitment-synthetic-dropoff-template-2026-10-26'), true)
  assert.equal(monday.some(event => event.id === 'virtual-school-dropoff-2026-10-26'), false)
  assert.equal(monday.some(event => event.id === 'virtual-school-pickup-2026-10-26'), true)
  assert.deepEqual(kinds(daily(client, '2026-10-25', [{ ...block, active: false }])), ['dropoff', 'pickup'])
})

test('weekday selection follows the member local date when Monday starts during UTC Sunday', () => {
  const client = member({ school_dropoff_days_of_week: [1], school_pickup_days_of_week: [] }, {
    timezone: 'Pacific/Auckland', school_dropoff_time: '00:15',
  })
  const monday = daily(client, '2026-10-19')
  assert.equal(monday.length, 1); assert.equal(monday[0].id, 'virtual-school-dropoff-2026-10-19')
  assert.equal(monday[0].start_at, '2026-10-18T11:15:00.000Z')
  const visible = calendar(client, '2026-10-18T11:00:00Z', '2026-10-19T11:00:00Z')
  assert.deepEqual(visible.map(event => event.id), monday.map(event => event.id))
  assert.deepEqual(daily(client, '2026-10-18'), [])
})

test('overnight occurrences retain the selected start-day identity and exact-midnight endings do not carry over', () => {
  const client = member({ school_dropoff_days_of_week: [5], school_pickup_days_of_week: [] }, { school_dropoff_time: '23:45' })
  const carried = daily(client, '2026-10-24')
  assert.equal(carried.length, 1); assert.equal(carried[0].id, 'virtual-school-dropoff-2026-10-23')
  assert.equal(carried[0].end_at, '2026-10-24T00:15:00.000Z')
  assert.deepEqual(daily(client, '2026-10-25'), [])
  const saturdayRange = calendar(client, '2026-10-24T00:00:00Z', '2026-10-24T00:10:00Z')
  assert.deepEqual(saturdayRange.map(event => event.id), ['virtual-school-dropoff-2026-10-23'])
  assert.deepEqual(daily({ ...client, school_dropoff_time: '23:30' }, '2026-10-24'), [])
  const block = { id: 'synthetic-overnight', active: true, block_type: 'work', label: 'Synthetic overnight block',
    days_of_week: [5], start_time: '22:00', end_time: '02:00' }
  const withoutSchool = member({ school_dropoff_days_of_week: [], school_pickup_days_of_week: [] })
  const templateCarry = daily(withoutSchool, '2026-10-24', [block])
  assert.deepEqual(templateCarry.map(event => event.id), ['commitment-synthetic-overnight-2026-10-23'])
  assert.equal(templateCarry[0].end_at, '2026-10-24T02:00:00.000Z')
})

test('the calendar range reader performs one owned active-template read and applies the same selected weekdays', async () => {
  const client = member({ school_dropoff_days_of_week: weekdays, school_pickup_days_of_week: weekdays })
  const original = clone(client), reads = [], violations = []
  const block = { id: 'synthetic-owned-school', user_id: userId, client_id: clientId, active: true,
    block_type: 'school_dropoff', days_of_week: weekdays, start_time: '07:30', end_time: '08:00' }
  const rows = [block, { ...block, id: 'synthetic-foreign', user_id: 'synthetic-foreign-owner', days_of_week: [0] }]
  const supabase = { from(table) {
    if (table !== 'client_schedule_blocks') { violations.push(table); throw new Error('Unexpected table') }
    const filters = []
    const q = {
      select(columns) { assert.equal(columns, '*'); return q },
      eq(key, value) { assert.ok(['user_id', 'client_id', 'active'].includes(key)); filters.push([key, value]); return q },
      then(resolve, reject) {
        assert.deepEqual(Object.fromEntries(filters), { user_id: userId, client_id: clientId, active: true })
        reads.push(clone(filters))
        return Promise.resolve({ data: clone(rows.filter(row => filters.every(([key, value]) => row[key] === value))), error: null }).then(resolve, reject)
      },
    }
    return new Proxy(q, { get(target, key) {
      if (key in target) return target[key]
      violations.push(String(key)); throw new Error(`Unexpected query method: ${String(key)}`)
    } })
  } }
  const result = await getCommitmentCalendarRange({ supabase, user: { id: userId }, client,
    start: '2026-10-24T00:00:00Z', end: '2026-10-26T00:00:00Z' })
  assert.equal(result.commitmentsUnavailable, false); assert.deepEqual(result.commitmentEvents, [])
  assert.equal(reads.length, 1); assert.deepEqual(violations, []); assert.deepEqual(client, original)
})

test('weekday normalization and repeated projection never mutate metadata, templates or selected arrays', () => {
  const client = member({ school_dropoff_days_of_week: [5, 1, 5], school_pickup_days_of_week: [0, 6] })
  const blocks = [{ id: 'synthetic-read-only', active: true, block_type: 'work', days_of_week: [5, 1],
    start_time: '10:00', end_time: '11:00' }]
  const before = { client: clone(client), blocks: clone(blocks) }
  const selected = getCommitmentWeekdays(client, 'school_dropoff_days_of_week')
  assert.deepEqual(selected, [1, 5]); selected.push(0)
  const first = calendar(client, '2026-10-19T00:00:00Z', '2026-10-26T00:00:00Z', blocks)
  const second = calendar(client, '2026-10-19T00:00:00Z', '2026-10-26T00:00:00Z', blocks)
  assert.deepEqual(second, first); assert.deepEqual(client, before.client); assert.deepEqual(blocks, before.blocks)
})
