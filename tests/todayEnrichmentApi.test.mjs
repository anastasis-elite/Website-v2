import assert from 'node:assert/strict'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'

const mocks = {
  'next/server': 'export const NextResponse = { json: (body, init) => Response.json(body, init) }',
  '@/lib/dashboard/todayAccess': `
    export async function getTodayAccessContext(input) {
      globalThis.enrichmentAccessCalls.push(input)
      if (globalThis.enrichmentAccessError) throw globalThis.enrichmentAccessError
      return globalThis.enrichmentContext
    }
    export function todayAccessError(error, fallback) {
      return Response.json({ error: fallback }, { status: error.status || 500, headers: { 'Cache-Control': 'private, no-store, max-age=0' } })
    }
  `,
  '@/lib/dashboard/loadTodayEnrichment': `
    export async function loadTodayEnrichment(context) {
      globalThis.enrichmentLoads++
      globalThis.enrichmentLoadedContext = context
      return globalThis.enrichmentLoad(context)
    }
  `,
  '@/lib/dashboard/logic/loadProgramLogicInputs': 'export class DashboardLocalDayChangedError extends Error {}',
}
const { GET } = await importTs('app/api/dashboard/today-enrichment/route.ts', mocks)
const scope = () => ({ ownerUserId: 'verified-owner', clientId: 'verified-client', program: 'ignite', date: new Date().toISOString().slice(0, 10), timezone: 'UTC' })
const request = (expected = scope()) => new Request(`http://localhost/api/dashboard/today-enrichment?${new URLSearchParams(expected)}`)
function setup() {
  const current = scope()
  globalThis.enrichmentAccessCalls = []
  globalThis.enrichmentLoads = 0
  globalThis.enrichmentAccessError = null
  globalThis.enrichmentContext = {
    supabase: {}, user: { id: current.ownerUserId }, program: current.program,
    client: { client_id: current.clientId, auth_user_id: current.ownerUserId, program: current.program, timezone: current.timezone },
  }
  globalThis.enrichmentLoad = async () => ({ ...current, version: 1, generatedAt: new Date().toISOString(), logic: {}, schedule: {} })
  return current
}

test('enrichment verifies current account scope before loading and never caches authenticated responses', async () => {
  const current = setup()
  const response = await GET(request(current))
  assert.equal(response.status, 200)
  assert.deepEqual(globalThis.enrichmentAccessCalls, [{ program: current.program }])
  assert.equal(globalThis.enrichmentLoads, 1)
  assert.equal(globalThis.enrichmentLoadedContext.includePhotoPreviews, false)
  assert.match(response.headers.get('cache-control'), /private, no-store/)
  assert.equal((await response.json()).ownerUserId, current.ownerUserId)
  for (const field of ['ownerUserId', 'clientId']) {
    setup()
    const rejected = await GET(request({ ...current, [field]: 'other-account' }))
    assert.equal(rejected.status, 409)
    assert.equal(globalThis.enrichmentLoads, 0)
    assert.equal((await rejected.json()).redirect, '/dashboard')
    assert.match(rejected.headers.get('cache-control'), /no-store/)
  }
})

test('stale local date or timezone fails before work and a midnight crossing cannot publish yesterday guidance', async () => {
  const current = setup()
  for (const expected of [{ ...current, date: '1900-01-01' }, { ...current, timezone: 'America/Chicago' }]) {
    setup()
    assert.equal((await GET(request(expected))).status, 409)
    assert.equal(globalThis.enrichmentLoads, 0)
  }
  setup()
  globalThis.enrichmentLoad = async () => ({ ...current, date: '1900-01-01' })
  const crossed = await GET(request(current))
  assert.equal(crossed.status, 409)
  assert.match((await crossed.json()).error, /new day/)
  assert.match(crossed.headers.get('cache-control'), /no-store/)
})

test('missing scope and rejected access never run recommendations; slow enrichment errors are locally retryable', async () => {
  const current = setup()
  const incomplete = { ...current }; delete incomplete.clientId
  assert.equal((await GET(request(incomplete))).status, 400)
  assert.equal(globalThis.enrichmentAccessCalls.length, 0)
  for (const status of [401, 403, 409, 503]) {
    setup()
    globalThis.enrichmentAccessError = { status }
    assert.equal((await GET(request(current))).status, status)
    assert.equal(globalThis.enrichmentLoads, 0)
  }
  setup()
  globalThis.enrichmentLoad = async () => { throw new Error('private database details') }
  const failed = await GET(request(current))
  assert.equal(failed.status, 500)
  assert.doesNotMatch((await failed.json()).error, /private database/)
  globalThis.enrichmentLoad = async () => ({ ...current, version: 1 })
  assert.equal((await GET(request(current))).status, 200)
})
