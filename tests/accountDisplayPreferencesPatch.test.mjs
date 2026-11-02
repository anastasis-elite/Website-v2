import assert from 'node:assert/strict'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'

const { PATCH } = await importTs('app/api/dashboard/preferences/route.ts', {
  'next/server': 'export const NextResponse = { json: (body, init) => Response.json(body, init) }',
  '@/lib/supabase/server': 'export const createClient = async () => globalThis.accountPreferenceTransport',
  '@/lib/dashboard/invalidateDailyPlan': 'export const invalidateDailyPlan = () => { globalThis.accountPreferenceInvalidations++ }',
})
const owner = 'qa-account-owner', clientId = 'QA-ACCOUNT-PREFERENCES'
const request = values => new Request('http://disposable.test/api/dashboard/preferences', {
  method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values),
})

function fixture({ user = { id: owner }, missing = false, conflict, writeFailure = false } = {}) {
  const rows = [
    ...missing ? [] : [{ client_id: clientId, auth_user_id: owner, program: 'ignite', access: true,
      execution_style: 'schedule', carousel_style: 'section',
      onboarding_data: { timezone: 'America/Chicago', transitionMinutes: 15,
        dailyGuide: { date: '2026-11-02', activities: { water: { status: 'skipped' } } }, kept: 'saved profile context' } }],
    { client_id: 'QA-OTHER', auth_user_id: 'someone-else', program: 'ember',
      execution_style: 'flow', carousel_style: 'step', onboarding_data: { kept: 'other account' } },
  ]
  let attempts = 0
  const writes = [], reads = []
  const transport = {
    auth: { getUser: async () => ({ data: { user } }) },
    from(table) {
      assert.equal(table, 'clients', 'Display preference saving uses the existing profile path only.')
      const filters = []
      let mutation
      const query = {
        select() { return query },
        eq(key, value) { filters.push([key, value]); return query },
        is(key, value) { filters.push([key, value]); return query },
        update(value) { mutation = value; return query },
        async maybeSingle() {
          reads.push(structuredClone(filters))
          if (mutation) {
            attempts++
            assert.ok(filters.some(([key, value]) => key === 'auth_user_id' && value === owner))
            assert.ok(filters.some(([key, value]) => key === 'client_id' && value === clientId))
            if (writeFailure) return { data: null, error: { message: 'Synthetic private database detail' } }
            conflict?.(rows[0], attempts)
          }
          const row = rows.find(item => filters.every(([key, value]) => key === 'onboarding_data'
            ? value === null ? item[key] == null : JSON.stringify(item[key]) === value
            : item[key] === value))
          if (row && mutation) {
            Object.assign(row, structuredClone(mutation))
            writes.push({ fields: structuredClone(mutation), filters: structuredClone(filters) })
          }
          return { data: row ? structuredClone(row) : null, error: null }
        },
      }
      return query
    },
  }
  globalThis.accountPreferenceTransport = transport
  globalThis.accountPreferenceInvalidations = 0
  return { rows, writes, reads, get attempts() { return attempts } }
}

test('Account display preference PATCH saves the owned three fields including a zero buffer and retains unrelated profile data', async () => {
  const current = fixture(), before = structuredClone(current.rows)
  const response = await PATCH(request({ executionStyle: 'hybrid', carouselStyle: 'step', transitionMinutes: 0,
    clientId: 'QA-OTHER', userId: 'someone-else' }))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { success: true })
  assert.equal(current.rows[0].execution_style, 'hybrid')
  assert.equal(current.rows[0].carousel_style, 'step')
  assert.deepEqual(current.rows[0].onboarding_data, { ...before[0].onboarding_data, transitionMinutes: 0 })
  assert.equal(current.rows[0].program, before[0].program)
  assert.equal(current.rows[0].access, before[0].access)
  assert.deepEqual(current.rows[1], before[1])
  assert.deepEqual(Object.keys(current.writes[0].fields).sort(), ['carousel_style', 'execution_style', 'onboarding_data'])
  assert.ok(current.reads[0].some(([key, value]) => key === 'auth_user_id' && value === owner))
  assert.equal(globalThis.accountPreferenceInvalidations, 1)
})

test('Account display preference saving reuses the existing CAS merge and does not report failed retries as saved', async () => {
  const concurrent = fixture({ conflict(row, attempt) {
    if (attempt === 1) row.onboarding_data = { ...row.onboarding_data, concurrent: 'another device',
      scheduleOverrides: { 'existing-event': { status: 'deferred' } } }
  } })
  const response = await PATCH(request({ executionStyle: 'flow', carouselStyle: 'section', transitionMinutes: 20 }))
  assert.equal(response.status, 200)
  assert.equal(concurrent.attempts, 2)
  assert.equal(concurrent.writes.length, 1)
  assert.equal(concurrent.rows[0].onboarding_data.concurrent, 'another device')
  assert.equal(concurrent.rows[0].onboarding_data.scheduleOverrides['existing-event'].status, 'deferred')
  assert.equal(concurrent.rows[0].onboarding_data.dailyGuide.activities.water.status, 'skipped')
  assert.equal(concurrent.rows[0].onboarding_data.transitionMinutes, 20)
  assert.equal(globalThis.accountPreferenceInvalidations, 1)

  const conflicted = fixture({ conflict(row, attempt) { row.onboarding_data = { ...row.onboarding_data, concurrentVersion: attempt } } })
  const conflictResponse = await PATCH(request({ executionStyle: 'hybrid', carouselStyle: 'step', transitionMinutes: 25 }))
  assert.equal(conflictResponse.status, 409)
  assert.match((await conflictResponse.json()).error, /could not be saved/)
  assert.equal(conflicted.attempts, 3)
  assert.equal(conflicted.writes.length, 0)
  assert.equal(conflicted.rows[0].execution_style, 'schedule')
  assert.equal(conflicted.rows[0].carousel_style, 'section')
  assert.equal(globalThis.accountPreferenceInvalidations, 0)

  const failed = fixture({ writeFailure: true }), before = structuredClone(failed.rows)
  const failureResponse = await PATCH(request({ executionStyle: 'flow', carouselStyle: 'step', transitionMinutes: 10 }))
  assert.equal(failureResponse.status, 500)
  const payload = await failureResponse.json()
  assert.match(payload.error, /could not be saved/)
  assert.doesNotMatch(payload.error, /Synthetic|private|database detail/)
  assert.deepEqual(failed.rows, before)
  assert.equal(failed.writes.length, 0)
  assert.equal(globalThis.accountPreferenceInvalidations, 0)
})

test('Account preference relocation retains existing authentication, owned-profile and input rejection before writes', async () => {
  for (const [options, status] of [[{ user: null }, 401], [{ missing: true }, 404], [{ user: { id: 'unknown-account' } }, 404]]) {
    const current = fixture(options), before = structuredClone(current.rows)
    const response = await PATCH(request({ executionStyle: 'flow', carouselStyle: 'step', transitionMinutes: 10 }))
    assert.equal(response.status, status)
    assert.deepEqual(current.rows, before)
    assert.equal(current.writes.length, 0)
    assert.equal(globalThis.accountPreferenceInvalidations, 0)
  }
  for (const invalid of [{ executionStyle: 'invented' }, { carouselStyle: 'invented' },
    { transitionMinutes: -1 }, { transitionMinutes: 121 }, { transitionMinutes: 1.5 }]) {
    const current = fixture(), before = structuredClone(current.rows)
    const response = await PATCH(request(invalid))
    assert.equal(response.status, 400)
    assert.deepEqual(current.rows, before)
    assert.equal(current.writes.length, 0)
    assert.equal(globalThis.accountPreferenceInvalidations, 0)
  }
})
