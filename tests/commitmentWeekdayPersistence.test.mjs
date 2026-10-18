import assert from 'node:assert/strict'
import test, { after, mock } from 'node:test'
import { importTs } from './typescriptModule.mjs'

const frozen = Date.parse('2026-10-12T15:00:00.000Z')
mock.timers.enable({ apis: ['Date'], now: frozen })
after(() => mock.timers.reset())

const { ALL_COMMITMENT_WEEKDAYS, COMMITMENT_WEEKDAYS, COMMITMENT_DAY_FIELDS,
  getCommitmentWeekdays, mergeCommitmentWeekdays, scheduleStructureProfileFields } =
  await importTs('lib/assessment/commitmentWeekdays.ts')
const { validateScheduleStructure } = await importTs('lib/assessment/validateScheduleStructure.ts')
const { getScheduleStructureSubmission, SCHEDULE_STRUCTURE_VERSION } = await importTs('lib/assessment/scheduleStructure.ts')
const routeMocks = {
  'next/server': 'export const NextResponse={json:(body,init)=>Response.json(body,init)}',
  '@/lib/supabase/server': 'export const createClient=async()=>globalThis.commitmentWeekdayFixture.db',
  '@/lib/dashboard/invalidateDailyPlan': 'export const invalidateDailyPlan=()=>{globalThis.commitmentWeekdayFixture.invalidations++}',
}
const assessmentRoute = await importTs('app/api/daily-structure/route.ts', routeMocks)
const routineRoute = await importTs('app/api/daily-structure/routine/route.ts', routeMocks)

const owner = 'qa-weekdays-owner', clientId = 'QA-WEEKDAYS-ONLY'
const event = { id: 'qa-weekday-assessment', user_id: owner, client_id: clientId,
  event_type: 'assessment', title: 'Schedule Structure Assessment', source: 'anastasis', status: 'scheduled' }
const dayFields = ['work_days_of_week', 'school_dropoff_days_of_week', 'school_pickup_days_of_week']
const legacyAnswers = { execution_style: 'flow', carousel_style: 'section', wake_time: '07:00', bed_time: '22:00',
  work_start_time: '09:00', work_end_time: '17:00', school_dropoff_time: '08:00', school_pickup_time: '15:00',
  workout_days_available: 0 }
const selectedDays = { work_days_of_week: [5, 1, 3, 1], school_dropoff_days_of_week: [4, 2], school_pickup_days_of_week: [6, 0] }
const normalizedDays = { work_days_of_week: [1, 3, 5], school_dropoff_days_of_week: [2, 4], school_pickup_days_of_week: [0, 6] }
// This whitelist models deployed clients columns. JSON-only weekday fields must
// never reach a flat update, even though the in-process mock could accept them.
const clientColumns = new Set(['onboarding_data', 'daily_structure_reviewed_at',
  'execution_style', 'carousel_style', 'wake_time', 'bed_time', 'work_start_time', 'work_end_time',
  'preferred_workout_time', 'school_dropoff_time', 'school_pickup_time', 'lunch_window_time', 'dinner_window_time',
  'workout_days_available', 'current_workout_days_per_week', 'current_workout_minutes_per_session',
  'current_training_intensity', 'workout_schedule_preference', 'daily_non_negotiables', 'day_structure_notes'])
const outcomes = {
  'virtual-work-2026-10-12': { status: 'completed', completed_at: '2026-10-12T14:00:00.000Z', title: 'Work block' },
  'virtual-school-dropoff-2026-10-12': { status: 'skipped', title: 'School drop-off' },
  'virtual-school-pickup-2026-10-12': { status: 'scheduled', adjusted_start_at: '2026-10-12T16:00:00.000Z', title: 'School pickup' },
}
const originalMetadata = { work_days_of_week: [1, 2], school_dropoff_days_of_week: [1, 2, 3, 4, 5], school_pickup_days_of_week: [0, 6], kept: 'future metadata' }
const request = body => new Request('https://disposable.invalid/api/daily-structure', { method: 'POST', body: JSON.stringify(body) })
const submitBody = overrides => ({ action: 'submit', assessmentVersion: 1, client_id: clientId, eventId: event.id, expected_revision: 0, ...legacyAnswers, ...overrides })
const routineBody = overrides => ({ client_id: clientId, expected_revision: 0, ...legacyAnswers, ...overrides })
const clone = value => structuredClone(value)

function fixture({ clients, failWrite = false, beforeWrite } = {}) {
  mock.timers.setTime(frozen)
  const rows = clone(clients || [
    { client_id: clientId, auth_user_id: owner, timezone: 'UTC', ...legacyAnswers,
      daily_structure_reviewed_at: '2026-09-12T15:00:00.000Z', onboarding_data: {
        kept: { nested: 'preserved' }, scheduleCommitmentWeekdays: originalMetadata,
        scheduleOverrides: outcomes, dashboardDismissals: { '2026-10-12': ['already-seen'] },
      } },
    { client_id: 'QA-WEEKDAYS-FOREIGN', auth_user_id: 'another-owner', onboarding_data: { kept: 'another member' } },
  ])
  const f = { rows, writes: [], attempts: [], rejectedColumns: [], invalidations: 0, failWrite, beforeWrite }
  f.db = { auth: { getUser: async () => ({ data: { user: { id: owner } }, error: null }) }, from(table) {
    assert.ok(['clients', 'anastasis_schedule_events'].includes(table), `Unexpected table ${table}`)
    const filters = []; let mutation
    const result = () => {
      if (table === 'clients') {
        assert.ok(filters.some(([key, value]) => key === 'auth_user_id' && value === owner), 'every client read and update is owner scoped')
        assert.ok(filters.some(([key]) => key === 'client_id'), 'every client query is client scoped')
      }
      if (mutation) {
        assert.equal(table, 'clients', 'weekday saves must not write schedule rows')
        assert.ok(filters.some(([key]) => key === 'onboarding_data'), 'flat fields and JSON metadata require the same compare-and-swap')
        f.attempts.push(clone(mutation))
        const unknown = Object.keys(mutation).filter(key => !clientColumns.has(key))
        if (unknown.length) {
          f.rejectedColumns.push(...unknown)
          return { data: null, error: { code: 'PGRST204', message: 'Unknown clients column' } }
        }
        if (f.failWrite) return { data: null, error: { message: 'Synthetic write failure' } }
        f.beforeWrite?.(rows[0], f.attempts.length)
      }
      const source = table === 'clients' ? rows : [event]
      const found = source.filter(row => filters.every(([key, value]) => key === 'onboarding_data' && typeof value === 'string'
        ? JSON.stringify(row[key]) === value : row[key] === value))
      if (mutation) for (const row of found) {
        Object.assign(row, clone(mutation)); f.writes.push(clone(mutation))
      }
      return { data: clone(found), error: null }
    }
    const q = { select() { return q }, eq(key, value) { filters.push([key, value]); return q },
      is(key, value) { filters.push([key, value]); return q }, update(value) { mutation = value; return q },
      async maybeSingle() { const value = result(); return { ...value, data: value.data?.[0] || null } } }
    return q
  } }
  globalThis.commitmentWeekdayFixture = f
  return f
}

function assertOutcomesUnchanged(f, original = outcomes) {
  assert.deepEqual(f.rows[0].onboarding_data.scheduleOverrides, original)
  assert.deepEqual(f.rows[0].onboarding_data.dashboardDismissals, { '2026-10-12': ['already-seen'] })
  assert.deepEqual(f.rows[0].onboarding_data.kept, { nested: 'preserved' })
  assert.deepEqual(f.rejectedColumns, [], 'weekday field names never target deployed flat columns')
  for (const write of f.attempts) for (const field of dayFields) assert.equal(Object.hasOwn(write, field), false)
}

test('weekday options use local numeric weekdays while metadata reads are strict, independent and copied', () => {
  assert.deepEqual(ALL_COMMITMENT_WEEKDAYS, [0, 1, 2, 3, 4, 5, 6])
  assert.deepEqual(COMMITMENT_WEEKDAYS, [
    { value: 1, label: 'Monday', shortLabel: 'Mon' }, { value: 2, label: 'Tuesday', shortLabel: 'Tue' },
    { value: 3, label: 'Wednesday', shortLabel: 'Wed' }, { value: 4, label: 'Thursday', shortLabel: 'Thu' },
    { value: 5, label: 'Friday', shortLabel: 'Fri' }, { value: 6, label: 'Saturday', shortLabel: 'Sat' },
    { value: 0, label: 'Sunday', shortLabel: 'Sun' },
  ])
  assert.deepEqual(COMMITMENT_DAY_FIELDS, dayFields)
  const client = { work_days_of_week: [3], onboarding_data: { scheduleCommitmentWeekdays: { ...selectedDays } } }
  assert.deepEqual(getCommitmentWeekdays(client, 'work_days_of_week'), [1, 3, 5])
  assert.deepEqual(getCommitmentWeekdays(client, 'school_dropoff_days_of_week'), [2, 4])
  const read = getCommitmentWeekdays(client, 'school_pickup_days_of_week'); read.push(3)
  assert.deepEqual(getCommitmentWeekdays(client, 'school_pickup_days_of_week'), [0, 6])
  assert.equal(getCommitmentWeekdays({ work_days_of_week: [1] }, 'work_days_of_week'), undefined, 'flat values cannot masquerade as canonical JSON metadata')
  assert.equal(getCommitmentWeekdays({ onboarding_data: { routinePreferences: { answers: selectedDays } } }, 'work_days_of_week'), undefined)
  assert.deepEqual(getCommitmentWeekdays({ onboarding_data: { scheduleCommitmentWeekdays: { work_days_of_week: [] } } }, 'work_days_of_week'), [])
  for (const bad of [undefined, null, {}, '1,2', ['1'], [1.5], [-1], [7], [NaN], [Infinity], [true], new Array(1)]) {
    assert.equal(getCommitmentWeekdays({ onboarding_data: { scheduleCommitmentWeekdays: { work_days_of_week: bad } } }, 'work_days_of_week'), undefined)
  }
})

test('metadata merge updates only explicit valid fields, preserves unrelated JSON and does not mutate its input', () => {
  const input = { kept: { nested: true }, scheduleCommitmentWeekdays: clone(originalMetadata), scheduleOverrides: clone(outcomes) }
  const before = clone(input)
  const merged = mergeCommitmentWeekdays(input, { work_days_of_week: [6, 1, 6], school_pickup_days_of_week: [] })
  assert.deepEqual(merged.scheduleCommitmentWeekdays, { ...originalMetadata, work_days_of_week: [1, 6], school_pickup_days_of_week: [] })
  assert.deepEqual(input, before)
  merged.scheduleCommitmentWeekdays.work_days_of_week.push(4)
  assert.deepEqual(input, before, 'merged day arrays are independent of existing JSON')
  assert.deepEqual(mergeCommitmentWeekdays(input, legacyAnswers), before, 'old clients omit fields without resetting saved choices')
  for (const bad of [undefined, null, '1', ['1'], [7], [1.5], new Array(1)]) {
    assert.deepEqual(mergeCommitmentWeekdays(input, { work_days_of_week: bad }), before)
  }
  assert.deepEqual(mergeCommitmentWeekdays({ kept: true }, legacyAnswers), { kept: true }, 'legacy save creates no synthetic weekday metadata')
  const inherited = Object.create({ work_days_of_week: [0] })
  assert.deepEqual(mergeCommitmentWeekdays(input, inherited), before, 'inherited values are not explicit saved selections')
})

test('profile writes strip only the three JSON-only weekday fields and retain valid existing columns', () => {
  const input = { ...legacyAnswers, ...selectedDays, day_structure_notes: 'Evenings open', unrelated: 'preserved' }
  const before = clone(input)
  assert.deepEqual(scheduleStructureProfileFields(input), { ...legacyAnswers, day_structure_notes: 'Evenings open', unrelated: 'preserved' })
  assert.deepEqual(input, before)
})

test('validation preserves legacy completion, normalizes numeric day arrays and rejects coercion or active empty selections', () => {
  assert.equal(SCHEDULE_STRUCTURE_VERSION, 1, 'new optional metadata does not invalidate completed assessments')
  const legacy = validateScheduleStructure(legacyAnswers)
  assert.ok(!('error' in legacy))
  for (const field of dayFields) assert.equal(Object.hasOwn(legacy.answers, field), false)
  const validated = validateScheduleStructure({ ...legacyAnswers, ...selectedDays })
  assert.ok(!('error' in validated))
  for (const field of dayFields) assert.deepEqual(validated.answers[field], normalizedDays[field])
  for (const field of dayFields) {
    for (const bad of [null, undefined, '1,2', ['1'], [false], [1.5], [-1], [7], [NaN], [Infinity], {}, [], new Array(1)]) {
      assert.ok('error' in validateScheduleStructure({ ...legacyAnswers, [field]: bad }), `${field}: ${JSON.stringify(bad)}`)
    }
  }
  const inactive = validateScheduleStructure({ ...legacyAnswers, work_start_time: null, work_end_time: null,
    school_dropoff_time: null, school_pickup_time: null, work_days_of_week: [], school_dropoff_days_of_week: [], school_pickup_days_of_week: [] })
  assert.ok(!('error' in inactive))
  for (const field of dayFields) assert.deepEqual(inactive.answers[field], [])
})

test('real assessment POST persists normalized day metadata and immutable answers atomically and recognizes them after refresh', async () => {
  const f = fixture(), foreignBefore = clone(f.rows[1])
  const response = await assessmentRoute.POST(request(submitBody(selectedDays)))
  assert.equal(response.status, 200)
  const payload = await response.json()
  assert.equal(payload.success, true)
  assert.equal(f.writes.length, 1)
  assert.deepEqual(f.rows[0].onboarding_data.scheduleCommitmentWeekdays, { ...originalMetadata, ...normalizedDays })
  assert.equal(f.rows[0].daily_structure_reviewed_at, new Date(frozen).toISOString())
  const proof = getScheduleStructureSubmission(f.rows[0].onboarding_data, event)
  assert.ok(proof)
  assert.deepEqual(payload.submission, proof)
  for (const field of dayFields) {
    assert.deepEqual(proof.answers[field], normalizedDays[field])
    assert.equal(Object.hasOwn(f.rows[0], field), false)
  }
  assert.equal(f.rows[0].work_start_time, '09:00')
  assert.equal(f.rows[0].onboarding_data.routinePreferences.revision, 1)
  assert.deepEqual(f.rows[0].onboarding_data.routinePreferences.answers, proof.answers)
  assert.deepEqual(f.rows[1], foreignBefore)
  assert.equal(f.invalidations, 1)
  assertOutcomesUnchanged(f)
  const refreshed = fixture({ clients: f.rows })
  assert.deepEqual(getScheduleStructureSubmission(refreshed.rows[0].onboarding_data, event), proof)
  assert.equal(refreshed.writes.length, 0, 'reading persisted completion never resubmits an assessment')
})

test('old assessment proof accepts tokenless retries without replacing newer routine day metadata', async () => {
  const f = fixture()
  const validated = validateScheduleStructure(legacyAnswers)
  assert.ok(!('error' in validated))
  const proof = { assessmentVersion: 1, eventId: event.id, submittedAt: '2026-09-12T15:00:00.000Z', answers: validated.answers }
  f.rows[0].onboarding_data.scheduleStructureAssessments = { 1: { [event.id]: proof } }
  f.rows[0].onboarding_data.routinePreferences = { revision: 4, savedAt: '2026-10-12T14:00:00.000Z', answers: { ...validated.answers, work_days_of_week: [2, 4] } }
  f.rows[0].onboarding_data.scheduleCommitmentWeekdays.work_days_of_week = [2, 4]
  const before = clone(f.rows)
  assert.deepEqual(getScheduleStructureSubmission(f.rows[0].onboarding_data, event), proof)
  for (const days of [{}, selectedDays]) {
    const response = await assessmentRoute.POST(request(submitBody({ ...days, expected_revision: undefined, work_start_time: '10:00' })))
    assert.equal(response.status, 200)
    assert.deepEqual((await response.json()).submission, proof)
    assert.deepEqual(f.rows, before, 'legacy proof replay never rewrites current routine preferences')
  }
  assert.equal((await assessmentRoute.POST(request(submitBody({ expected_revision: null })))).status, 400)
  for (const assessmentVersion of [0, 2]) {
    assert.equal((await assessmentRoute.POST(request(submitBody({ expected_revision: undefined, assessmentVersion })))).status, 409)
  }
  assert.deepEqual(f.rows, before, 'completed proof retries cannot overwrite canonical routine selections or reviewed-at')
  assertOutcomesUnchanged(f)
})

test('revisioned assessment submissions omitting weekday fields preserve saved metadata and existing outcomes', async () => {
  const f = fixture(), before = clone(f.rows[0].onboarding_data.scheduleCommitmentWeekdays)
  const response = await assessmentRoute.POST(request(submitBody({ wake_time: '06:30' })))
  assert.equal(response.status, 200)
  assert.deepEqual(f.rows[0].onboarding_data.scheduleCommitmentWeekdays, before)
  const proof = getScheduleStructureSubmission(f.rows[0].onboarding_data, event)
  for (const field of dayFields) assert.equal(Object.hasOwn(proof.answers, field), false)
  for (const field of dayFields) assert.deepEqual(f.rows[0].onboarding_data.routinePreferences.answers[field], before[field], 'mutable snapshot retains canonical omitted weekdays')
  assert.equal(f.rows[0].onboarding_data.routinePreferences.revision, 1)
  assert.equal(f.rows[0].onboarding_data.routinePreferences.answers.wake_time, '06:30')
  assert.equal(f.rows[0].wake_time, '06:30')
  assertOutcomesUnchanged(f)
})

test('routine POST commits weekdays, profile and revision together while leaving assessment proof and outcomes intact', async () => {
  const f = fixture()
  f.rows[0].onboarding_data.scheduleStructureAssessments = { 1: { 'standalone:2026-09': { kept: 'previous assessment evidence' } } }
  const assessmentBefore = clone(f.rows[0].onboarding_data.scheduleStructureAssessments)
  const reviewedAt = f.rows[0].daily_structure_reviewed_at
  const response = await routineRoute.POST(request(routineBody({ ...selectedDays, work_start_time: '10:00' })))
  assert.equal(response.status, 200)
  const { routine } = await response.json()
  assert.equal(routine.revision, 1)
  for (const field of dayFields) assert.deepEqual(routine.answers[field], normalizedDays[field])
  assert.equal(f.writes.length, 1)
  assert.equal(f.rows[0].work_start_time, '10:00')
  assert.deepEqual(f.rows[0].onboarding_data.scheduleCommitmentWeekdays, { ...originalMetadata, ...normalizedDays })
  assert.deepEqual(f.rows[0].onboarding_data.scheduleStructureAssessments, assessmentBefore)
  assert.equal(f.rows[0].daily_structure_reviewed_at, reviewedAt)
  assert.equal(f.invalidations, 1)
  assertOutcomesUnchanged(f)
  const afterSave = clone(f.rows)
  assert.equal((await routineRoute.POST(request(routineBody({ work_days_of_week: [0] })))).status, 409)
  assert.deepEqual(f.rows, afterSave)
  assert.equal(f.writes.length, 1, 'a stale revision cannot reset metadata or profile fields')
})

test('old-client routine edits preserve omitted day selections, while explicit inactive selections persist empty arrays', async () => {
  const f = fixture(), before = clone(f.rows[0].onboarding_data.scheduleCommitmentWeekdays)
  assert.equal((await routineRoute.POST(request(routineBody({ wake_time: '06:00' })))).status, 200)
  assert.deepEqual(f.rows[0].onboarding_data.scheduleCommitmentWeekdays, before)
  for (const field of dayFields) assert.deepEqual(f.rows[0].onboarding_data.routinePreferences.answers[field], before[field])
  const response = await routineRoute.POST(request(routineBody({ expected_revision: 1,
    work_start_time: null, work_end_time: null, school_dropoff_time: null, school_pickup_time: null,
    work_days_of_week: [], school_dropoff_days_of_week: [], school_pickup_days_of_week: [] })))
  assert.equal(response.status, 200)
  for (const field of dayFields) assert.deepEqual(f.rows[0].onboarding_data.scheduleCommitmentWeekdays[field], [])
  assert.equal(f.rows[0].onboarding_data.routinePreferences.revision, 2)
  assertOutcomesUnchanged(f)
})

test('revisioned assessment rejects related changes during its CAS retry', async () => {
  const f = fixture({ beforeWrite(row, attempt) {
    if (attempt !== 1) return
    row.wake_time = '08:30'
    row.onboarding_data = { ...row.onboarding_data,
      scheduleCommitmentWeekdays: { ...row.onboarding_data.scheduleCommitmentWeekdays, school_pickup_days_of_week: [0, 6] },
      routinePreferences: { revision: 1, savedAt: '2026-10-12T14:59:00.000Z', answers: { ...legacyAnswers, wake_time: '08:30' } } }
  } })
  const response = await assessmentRoute.POST(request(submitBody(selectedDays)))
  assert.equal(response.status, 409)
  assert.equal(f.attempts.length, 1)
  assert.equal(f.writes.length, 0)
  assert.equal(f.rows[0].wake_time, '08:30')
  assert.equal(f.rows[0].onboarding_data.routinePreferences.revision, 1)
  assert.deepEqual(f.rows[0].onboarding_data.scheduleCommitmentWeekdays.school_pickup_days_of_week, [0, 6])
  assert.equal(getScheduleStructureSubmission(f.rows[0].onboarding_data, event), null)
  assert.equal(f.invalidations, 0)
  assertOutcomesUnchanged(f)
})

test('invalid explicit assessment revision tokens fail before any preference or completion write', async () => {
  const f = fixture(), before = clone(f.rows)
  for (const expected_revision of [null, -1, 0.5, '0', {}, Number.MAX_SAFE_INTEGER]) {
    assert.equal((await assessmentRoute.POST(request(submitBody({ expected_revision })))).status, 400)
  }
  assert.deepEqual(f.rows, before)
  assert.equal(f.writes.length, 0)
  assert.equal(f.invalidations, 0)
})

test('an unrelated CAS collision preserves the latest outcome and omitted school days before retrying a routine edit', async () => {
  const concurrentOutcome = { status: 'completed', completed_at: '2026-10-12T14:59:00.000Z', title: 'School pickup' }
  const f = fixture({ beforeWrite(row, attempt) {
    if (attempt !== 1) return
    row.onboarding_data = { ...row.onboarding_data,
      scheduleCommitmentWeekdays: { ...row.onboarding_data.scheduleCommitmentWeekdays, school_pickup_days_of_week: [2] },
      scheduleOverrides: { ...row.onboarding_data.scheduleOverrides, 'virtual-school-pickup-2026-10-12': concurrentOutcome } }
  } })
  const response = await routineRoute.POST(request(routineBody({ work_days_of_week: [3, 1] })))
  assert.equal(response.status, 200)
  assert.equal(f.attempts.length, 2)
  assert.equal(f.writes.length, 1)
  assert.deepEqual(f.rows[0].onboarding_data.scheduleCommitmentWeekdays, { ...originalMetadata, work_days_of_week: [1, 3], school_pickup_days_of_week: [2] })
  assert.equal(f.rows[0].onboarding_data.routinePreferences.revision, 1)
  assertOutcomesUnchanged(f, { ...outcomes, 'virtual-school-pickup-2026-10-12': concurrentOutcome })
})

test('a concurrent routine revision returns conflict, preserves the winning choices and accepts a refreshed revision', async () => {
  const f = fixture({ beforeWrite(row, attempt) {
    if (attempt !== 1) return
    row.onboarding_data = { ...row.onboarding_data,
      scheduleCommitmentWeekdays: { ...row.onboarding_data.scheduleCommitmentWeekdays, work_days_of_week: [4] },
      routinePreferences: { revision: 1, savedAt: '2026-10-12T14:59:00.000Z', answers: { ...legacyAnswers, work_days_of_week: [4] } } }
  } })
  assert.equal((await routineRoute.POST(request(routineBody({ work_days_of_week: [1] })))).status, 409)
  assert.deepEqual(f.rows[0].onboarding_data.scheduleCommitmentWeekdays.work_days_of_week, [4])
  assert.equal(f.rows[0].onboarding_data.routinePreferences.revision, 1)
  assert.equal(f.writes.length, 0)
  assert.equal(f.invalidations, 0)
  assert.equal((await routineRoute.POST(request(routineBody({ expected_revision: 1, work_days_of_week: [2] })))).status, 200)
  assert.deepEqual(f.rows[0].onboarding_data.scheduleCommitmentWeekdays.work_days_of_week, [2])
  assert.equal(f.rows[0].onboarding_data.routinePreferences.revision, 2)
  assertOutcomesUnchanged(f)
})

test('failed or invalid saves do not change metadata or completion and a successful retry persists once', async () => {
  const f = fixture({ failWrite: true }), before = clone(f.rows)
  assert.equal((await assessmentRoute.POST(request(submitBody(selectedDays)))).status, 500)
  assert.deepEqual(f.rows, before)
  assert.equal(getScheduleStructureSubmission(f.rows[0].onboarding_data, event), null)
  assert.equal(f.invalidations, 0)
  assert.equal((await routineRoute.POST(request(routineBody({ school_dropoff_days_of_week: ['1'] })))).status, 400)
  assert.equal((await assessmentRoute.POST(request(submitBody({ work_days_of_week: [] })))).status, 400)
  assert.deepEqual(f.rows, before)
  f.failWrite = false
  assert.equal((await assessmentRoute.POST(request(submitBody(selectedDays)))).status, 200)
  assert.equal(f.writes.length, 1)
  assert.ok(getScheduleStructureSubmission(f.rows[0].onboarding_data, event))
  assertOutcomesUnchanged(f)
})
