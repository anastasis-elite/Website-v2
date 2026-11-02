import assert from 'node:assert/strict'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'

const { POST } = await importTs('app/api/recovery/activity/route.ts', {
  'next/server': 'export const NextResponse = { json: (body, init) => Response.json(body, init) }',
  '@/lib/supabase/server': 'export const createClient = async () => globalThis.practiceCompletionDb',
  '@/lib/timezone': 'export const getClientLocalDate = () => "2026-10-29"',
  '@/lib/dashboard/invalidateDailyPlan': 'export const invalidateDailyPlan = () => { globalThis.practiceCompletionInvalidations++ }',
})

function database({ signedIn = true, ownsClient = true, error = null } = {}) {
  const writes = [], ownershipFilters = []
  globalThis.practiceCompletionInvalidations = 0
  globalThis.practiceCompletionDb = {
    auth: { getUser: async () => ({ data: { user: signedIn ? { id: 'owner' } : null } }) },
    from(table) {
      if (table === 'clients') {
        const query = {
          select() { return query },
          eq(key, value) { ownershipFilters.push([key, value]); return query },
          async maybeSingle() { return { data: ownsClient ? { client_id: 'client' } : null } },
        }
        return query
      }
      assert.equal(table, 'recovery_activity_logs')
      return { async insert(row) { if (!error) writes.push(row); return { error } } }
    },
  }
  return { writes, ownershipFilters }
}

const submit = body => POST(new Request('http://local.test/api/recovery/activity', {
  method: 'POST', body: JSON.stringify({ clientId: 'client', ...body }),
}))
const complete = (practiceId, elapsedMs, skipHolds = false) => ({
  practiceId, elapsedMs, skipHolds, minutes: 90,
  activityType: practiceId === 'breath-reset' ? 'Breathwork' : 'Meditation',
})

test('approved completed sequences log one insert with earned whole minutes and preserve ownership filters', async () => {
  for (const [practice, elapsed, skip, minutes] of [
    ['breath-reset', 114_500, false, 1], ['breath-reset', 101_500, true, 1],
    ['sleep-wind-down', 606_000, false, 10], ['sleep-wind-down', 549_000, true, 9],
  ]) {
    const db = database()
    assert.equal((await submit(complete(practice, elapsed, skip))).status, 200)
    assert.deepEqual(db.writes, [{
      user_id: 'owner', client_id: 'client', log_date: '2026-10-29',
      activity_type: practice === 'breath-reset' ? 'Breathwork' : 'Meditation', duration_minutes: minutes,
    }])
    assert.deepEqual(db.ownershipFilters, [['client_id', 'client'], ['auth_user_id', 'owner']])
    assert.equal(globalThis.practiceCompletionInvalidations, 1)
  }
})

test('partial, overlong, mismatched, and malformed sequence requests cannot use the completion exception', async () => {
  for (const body of [
    complete('breath-reset', 114_499), complete('breath-reset', 114_501),
    complete('breath-reset', 101_500, false), complete('sleep-wind-down', 605_999),
    { ...complete('breath-reset', 114_500), activityType: 'Meditation' },
    { ...complete('breath-reset', 114_500), elapsedMs: '114500' },
    { ...complete('breath-reset', 114_500), skipHolds: 'false' },
    { ...complete('breath-reset', 114_500), skipHolds: undefined },
    { ...complete('breath-reset', 114_500), practiceId: 'calm-reset' },
    { ...complete('breath-reset', 114_500), practiceId: null },
  ]) {
    const db = database()
    assert.equal((await submit(body)).status, 400)
    assert.equal(db.writes.length, 0)
    assert.equal(globalThis.practiceCompletionInvalidations, 0)
  }
})

test('all existing recovery logging minimums and caps remain unchanged outside bounded sequence completion', async () => {
  for (const [activityType, minutes, expected] of [
    ['Breathwork', 1, 2], ['Meditation', 1, 2], ['Mobility', 1, 5],
    ['Gentle walk', 100, 90], ['Warm soak', 15, 15], ['Full rest', 1, null],
  ]) {
    const db = database()
    assert.equal((await submit({ activityType, minutes })).status, 200)
    assert.equal(db.writes[0].duration_minutes, expected)
  }
})

test('completed sequences retain authentication, ownership, and save-failure behavior', async () => {
  for (const [options, status] of [
    [{ signedIn: false }, 401], [{ ownsClient: false }, 404], [{ error: { message: 'Fixture offline' } }, 500],
  ]) {
    const db = database(options)
    assert.equal((await submit(complete('breath-reset', 114_500))).status, status)
    assert.equal(db.writes.length, 0)
    assert.equal(globalThis.practiceCompletionInvalidations, 0)
  }
})
