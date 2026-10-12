import assert from 'node:assert/strict'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'

const { POST } = await importTs('app/api/onboarding/profile/route.ts', {
  'next/server': 'export const NextResponse = { json: (body, init) => Response.json(body, init) }',
  '@/lib/supabase/server': 'export const createClient = async () => globalThis.memberOnboardingDb',
  '@/lib/accountability/communicationProfile': 'export const getDefaultCommunicationProfile = () => ({}); export const applyExplicitPreferences = (profile, preferences) => ({...profile, ...preferences})',
  '@/lib/accountability/partnerPersona': 'export const createPartnerPersona = (args) => args',
})
const owner = 'fresh-ember-test-user'
const clientId = 'QA-EMBER-ONLY'
const input = { birthdate: '1992-05-15', addressLine1: '1 Test Street', city: 'Chicago', state: 'IL', postalCode: '60601', reproductiveStatus: 'not_tracking', executionStyle: 'hybrid' }
const request = (body = input) => new Request('http://qa.test/api/onboarding/profile', { method: 'POST', body: JSON.stringify(body) })

function database({ signedIn = true, initial = false, strength = false, plan = false, failLookup = false, completedAt = null } = {}) {
  const client = { client_id: clientId, auth_user_id: owner, program: 'ember', subscription_status: 'active', access: true, onboarding_completed: false, onboarding_completed_at: completedAt, onboarding_data: { kept: 'earlier revision' }, timezone: 'America/Chicago' }
  const tables = {
    clients: [client],
    // Other customers' assessments and outputs cannot determine this account's next step.
    assessments: [{ id: 'other-strength', client_id: 'OTHER', assessment_type: 'strength' }, ...(initial ? [{ id: 'initial', client_id: clientId, assessment_type: 'initial' }] : []), ...(strength ? [{ id: 'strength', client_id: clientId, assessment_type: 'strength' }] : [])],
    program_outputs: [{ id: 'other-plan', client_id: 'OTHER', program: 'ember' }, { id: 'other-tier', client_id: clientId, program: 'ignite' }, ...(plan ? [{ id: 'ember-plan', client_id: clientId, program: 'ember' }] : [])],
    client_current_profiles: [],
  }
  const writes = []
  const db = { client, tables, writes, auth: { getUser: async () => ({ data: { user: signedIn ? { id: owner } : null } }) }, from(table) {
    const filters = []; let mutation = null; let upsert = false
    const q = { select() { return q }, eq(key, value) { filters.push([key, value]); return q }, limit() { return q }, update(value) { mutation = value; return q }, upsert(value) { mutation = value; upsert = true; return q }, maybeSingle: async () => resolve(), then(done) { return Promise.resolve(resolve()).then(done) } }
    function resolve() {
      if (failLookup && table === 'program_outputs') return { data: null, error: { message: 'temporary lookup failure' } }
      let row = tables[table]?.find(candidate => filters.every(([key, value]) => candidate[key] === value)) || null
      if (mutation && (row || upsert)) {
        writes.push({ table, value: mutation })
        if (row) Object.assign(row, mutation)
        else { row = { ...mutation }; tables[table].push(row) }
      }
      return { data: row, error: null }
    }
    return q
  } }
  globalThis.memberOnboardingDb = db
  return db
}

test('fresh EMBER profile persists separately from the baseline and opens the real initial assessment', async () => {
  const db = database()
  const response = await POST(request())
  assert.equal(response.status, 200)
  const result = await response.json()
  assert.equal(result.redirect, '/dashboard/assessment/start')
  assert.equal(result.setupStep, 'initial_assessment')
  assert.equal(result.profileCompleted, true)
  assert.equal(result.baselineCompleted, false)
  assert.equal(db.client.onboarding_completed, true)
  assert.equal(db.client.birthdate, input.birthdate)
  assert.equal(db.client.timezone, 'America/Chicago')
  assert.equal(db.client.onboarding_data.kept, 'earlier revision')
  assert.equal(db.client.subscription_status, 'active')
  assert.equal(db.tables.client_current_profiles[0].client_id, clientId)
  assert.equal(db.tables.client_current_profiles[0].user_id, owner)
  assert.equal(db.tables.program_outputs.some(row => row.id === 'ember-plan'), false)
})

test('a saved initial assessment resumes at strength without repeating the initial form', async () => {
  const db = database({ initial: true })
  const response = await POST(request())
  const result = await response.json()
  assert.equal(result.redirect, '/dashboard/assessment/start2')
  assert.equal(result.setupStep, 'strength_assessment')
  assert.equal(result.baselineCompleted, false)
  assert.equal(db.tables.assessments.filter(row => row.client_id === clientId).length, 1)
})

test('returning customers keep prior assessments and can retry a missing plan without repeating them', async () => {
  for (const options of [{ plan: true }, { initial: true, strength: true }]) {
    const db = database({ ...options, completedAt: '2026-09-01T12:00:00Z' })
    const response = await POST(request())
    const result = await response.json()
    assert.equal(result.redirect, options.plan ? '/dashboard/program/ember' : '/dashboard/onboarding/plan')
    assert.equal(result.setupStep, options.plan ? 'dashboard' : 'plan_generation')
    assert.equal(result.baselineCompleted, Boolean(options.strength))
    assert.equal(db.client.onboarding_completed_at, '2026-09-01T12:00:00Z')
    assert.equal(db.writes.some(write => write.table === 'assessments' || write.table === 'program_outputs'), false)
  }
})

test('missing authorization, validation failures and unavailable saved progress do not claim profile completion', async () => {
  let db = database({ signedIn: false })
  assert.equal((await POST(request())).status, 401)
  assert.equal(db.writes.length, 0)
  db = database()
  assert.equal((await POST(request({ ...input, postalCode: '' }))).status, 400)
  assert.equal(db.writes.length, 0)
  db = database({ failLookup: true })
  assert.equal((await POST(request())).status, 503)
  assert.equal(db.writes.length, 0)
  assert.equal(db.client.onboarding_completed, false)
})
