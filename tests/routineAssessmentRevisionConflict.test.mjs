import assert from 'node:assert/strict'
import test, { after, mock } from 'node:test'
import { importTs } from './typescriptModule.mjs'

assert.equal(process.env.PACKAGE_A_TEST_ISOLATED, '1', 'Use the pinned synthetic isolation guard.')
mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-18T20:00:00Z') })
after(() => mock.timers.reset())

// The actual two handlers and shared JSON CAS execute. The only storage is this
// strict, owner-scoped in-process fixture; no Auth/PostgREST/RLS claim is made.
const mocks = {
  'next/server': 'export const NextResponse = { json: (body, init) => Response.json(body, init) }',
  '@/lib/supabase/server': 'export const createClient = async () => globalThis.sharedRoutineRevisionFixture.db',
  '@/lib/dashboard/invalidateDailyPlan': 'export const invalidateDailyPlan = () => { globalThis.sharedRoutineRevisionFixture.invalidations++ }',
}
const assessment = await importTs('app/api/daily-structure/route.ts', mocks)
const routine = await importTs('app/api/daily-structure/routine/route.ts', mocks)
const { scheduleStructureMonthlyTask, getScheduleStructureSubmission } = await importTs('lib/assessment/scheduleStructure.ts')
const task = scheduleStructureMonthlyTask('2026-10')
const owner = 'synthetic-shared-revision-owner', clientId = 'SYNTHETIC-SHARED-REVISION'
const clone = value => structuredClone(value)
const everyDay = [0, 1, 2, 3, 4, 5, 6], weekdays = [1, 2, 3, 4, 5]
const oldAnswers = { execution_style: 'flow', carousel_style: 'section', wake_time: '07:00', bed_time: '22:00',
  work_start_time: '09:00', work_end_time: '17:00', school_dropoff_time: '08:00', school_pickup_time: '15:00',
  work_days_of_week: everyDay, school_dropoff_days_of_week: everyDay, school_pickup_days_of_week: everyDay,
  workout_days_available: 0 }
const assessedAnswers = { ...oldAnswers, wake_time: '06:30', work_start_time: '10:00', school_dropoff_time: '08:30',
  work_days_of_week: weekdays, school_dropoff_days_of_week: weekdays, school_pickup_days_of_week: weekdays }
const request = body => new Request('http://synthetic.invalid/api/shared-revision', { method: 'POST', body: JSON.stringify(body) })
const revision = f => f.row.onboarding_data.routinePreferences?.revision ?? 0
const assessmentBody = overrides => ({ action: 'submit', client_id: clientId, eventId: task.id,
  assessmentVersion: 1, expected_revision: 0, ...assessedAnswers, ...overrides })
const routineBody = overrides => ({ client_id: clientId, expected_revision: 0, ...oldAnswers, ...overrides })

function fixture() {
  const profile = Object.fromEntries(Object.entries(clone(oldAnswers)).filter(([key]) => !key.endsWith('_days_of_week')))
  const row = { client_id: clientId, auth_user_id: owner, timezone: 'UTC', ...profile,
    daily_structure_reviewed_at: null, onboarding_data: {
      unrelated: { preserved: true }, scheduleOverrides: { 'synthetic-prior-occurrence': { status: 'completed' } },
      scheduleCommitmentWeekdays: { work_days_of_week: clone(everyDay), school_dropoff_days_of_week: clone(everyDay), school_pickup_days_of_week: clone(everyDay) },
    } }
  const f = { row, attempts: [], writes: [], reads: [], invalidations: 0, beforeUpdate: null, signedIn: true }
  f.db = { auth: { getUser: async () => ({ data: { user: f.signedIn ? { id: owner } : null }, error: null }) },
    from(table) {
      assert.equal(table, 'clients', 'Only owner-scoped synthetic client queries are allowed')
      const filters = []; let mutation, columns = '*'
      const q = {
        select(value) { columns = value; return q }, eq(key, value) { filters.push([key, value]); return q },
        is(key, value) { filters.push([key, value]); return q }, update(value) { mutation = clone(value); return q },
        async maybeSingle() {
          assert.ok(filters.some(([key, value]) => key === 'auth_user_id' && value === owner))
          assert.ok(filters.some(([key]) => key === 'client_id'))
          if (mutation) {
            assert.ok(filters.some(([key]) => key === 'onboarding_data'), 'Every update must use JSON CAS')
            assert.equal(Object.keys(mutation).some(key => key.endsWith('_days_of_week')), false, 'No undeployed weekday columns')
            const callback = f.beforeUpdate; f.beforeUpdate = null
            if (callback) await callback()
          } else f.reads.push({ columns, filters: clone(filters) })
          const matches = filters.every(([key, value]) => key === 'onboarding_data' && typeof value === 'string'
            ? JSON.stringify(row[key]) === value : row[key] === value)
          if (mutation) {
            f.attempts.push({ matches, mutation: clone(mutation) })
            if (matches) { Object.assign(row, clone(mutation)); f.writes.push(clone(mutation)) }
          }
          const selected = columns === '*' ? clone(row) : Object.fromEntries(columns.split(',').map(key => key.trim())
            .filter(key => key in row).map(key => [key, clone(row[key])]))
          return { data: matches ? selected : null, error: null }
        },
      }
      return q
    },
  }
  globalThis.sharedRoutineRevisionFixture = f
  return f
}

for (const duringCas of [false, true]) test(`stale routine rejects an intervening assessment ${duringCas ? 'during CAS retry' : 'before its request'}`, async () => {
  const f = fixture(), staleRequest = routineBody()
  let afterAssessment
  const saveAssessment = async () => {
    const response = await assessment.POST(request(assessmentBody()))
    assert.equal(response.status, 200)
    afterAssessment = clone(f.row)
  }
  if (duringCas) f.beforeUpdate = saveAssessment
  else await saveAssessment()
  const response = await routine.POST(request(staleRequest))
  assert.equal(response.status, 409, 'Related assessment choices must invalidate a stale routine revision')
  assert.deepEqual(f.row, afterAssessment, 'Rejecting the stale routine must not overwrite any assessed profile or proof')
  assert.deepEqual(f.row.onboarding_data.scheduleCommitmentWeekdays.school_dropoff_days_of_week, weekdays)
  assert.equal(revision(f), 1)
  assert.equal(f.writes.length, 1)
  assert.equal(f.invalidations, 1)
  if (duringCas) assert.equal(f.attempts.filter(attempt => !attempt.matches).length, 1)
})

for (const duringCas of [false, true]) test(`stale assessment rejects an intervening routine ${duringCas ? 'during CAS retry' : 'before its request'}`, async () => {
  const f = fixture(), staleRequest = assessmentBody()
  let afterRoutine
  const saveRoutine = async () => {
    const response = await routine.POST(request(routineBody({ work_days_of_week: [2, 4], school_dropoff_days_of_week: [2, 4], wake_time: '08:00' })))
    assert.equal(response.status, 200)
    afterRoutine = clone(f.row)
  }
  if (duringCas) f.beforeUpdate = saveRoutine
  else await saveRoutine()
  const response = await assessment.POST(request(staleRequest))
  assert.equal(response.status, 409, 'An explicitly revisioned assessment must not overwrite a newer routine')
  assert.deepEqual(f.row, afterRoutine)
  assert.equal(getScheduleStructureSubmission(f.row.onboarding_data, task), null)
  assert.equal(f.writes.length, 1)
  assert.equal(f.invalidations, 1)
  if (duringCas) assert.equal(f.attempts.filter(attempt => !attempt.matches).length, 1)
})

test('completed assessment retry preserves its proof and newer routine without advancing the revision again', async () => {
  const f = fixture(), originalRequest = assessmentBody()
  assert.equal((await assessment.POST(request(originalRequest))).status, 200)
  const proof = clone(getScheduleStructureSubmission(f.row.onboarding_data, task))
  const reviewedAt = f.row.daily_structure_reviewed_at
  assert.equal((await routine.POST(request(routineBody({ expected_revision: revision(f), work_days_of_week: [0, 6], school_pickup_days_of_week: [6] })))).status, 200)
  const beforeReplay = clone(f.row), beforeRevision = revision(f)
  const response = await assessment.POST(request(originalRequest))
  assert.equal(response.status, 200)
  assert.deepEqual((await response.json()).submission, proof)
  assert.deepEqual(f.row, beforeReplay)
  assert.equal(revision(f), beforeRevision)
  assert.equal(f.row.daily_structure_reviewed_at, reviewedAt)
})

test('unrelated JSON CAS collisions still retry while retaining outcomes and selected preferences', async () => {
  const f = fixture()
  f.beforeUpdate = () => { f.row.onboarding_data = { ...f.row.onboarding_data,
    unrelated: { preserved: true, addedConcurrently: true },
    scheduleOverrides: { ...f.row.onboarding_data.scheduleOverrides, 'synthetic-new-outcome': { status: 'skipped' } } } }
  const response = await routine.POST(request(routineBody({ work_days_of_week: [6], school_dropoff_days_of_week: [0] })))
  assert.equal(response.status, 200)
  assert.equal(revision(f), 1)
  assert.equal(f.attempts.filter(attempt => !attempt.matches).length, 1)
  assert.deepEqual(f.row.onboarding_data.unrelated, { preserved: true, addedConcurrently: true })
  assert.deepEqual(f.row.onboarding_data.scheduleOverrides, { 'synthetic-prior-occurrence': { status: 'completed' }, 'synthetic-new-outcome': { status: 'skipped' } })
  assert.deepEqual(f.row.onboarding_data.scheduleCommitmentWeekdays.work_days_of_week, [6])
  assert.deepEqual(f.row.onboarding_data.scheduleCommitmentWeekdays.school_dropoff_days_of_week, [0])
  assert.equal(f.row.daily_structure_reviewed_at, null)
})

test('legacy omission keeps chosen weekday metadata and binds the assessment request to its first owned read', async () => {
  const f = fixture()
  f.row.onboarding_data.scheduleCommitmentWeekdays.school_dropoff_days_of_week = [0, 2, 6]
  const legacyRequest = assessmentBody()
  delete legacyRequest.expected_revision
  delete legacyRequest.work_days_of_week
  delete legacyRequest.school_dropoff_days_of_week
  delete legacyRequest.school_pickup_days_of_week
  assert.equal((await assessment.POST(request(legacyRequest))).status, 200)
  assert.deepEqual(f.row.onboarding_data.scheduleCommitmentWeekdays.school_dropoff_days_of_week, [0, 2, 6])
  assert.equal(revision(f), 1)
  const submitted = getScheduleStructureSubmission(f.row.onboarding_data, task)
  assert.equal(Object.hasOwn(submitted.answers, 'school_dropoff_days_of_week'), false)
})

test('shared revision handling preserves route authentication and foreign-client denial', async () => {
  const f = fixture(), before = clone(f.row)
  f.signedIn = false
  assert.equal((await assessment.POST(request(assessmentBody()))).status, 401)
  assert.equal((await routine.POST(request(routineBody()))).status, 401)
  f.signedIn = true
  assert.equal((await assessment.POST(request(assessmentBody({ client_id: 'SYNTHETIC-FOREIGN' })))).status, 404)
  assert.equal((await routine.POST(request(routineBody({ client_id: 'SYNTHETIC-FOREIGN' })))).status, 404)
  assert.deepEqual(f.row, before)
  assert.deepEqual(f.writes, [])
})
