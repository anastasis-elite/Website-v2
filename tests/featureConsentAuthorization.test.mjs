import assert from 'node:assert/strict'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'

const mocks = {
  'next/server': 'export const NextResponse = { json: (body, init) => Response.json(body, init) }',
  '@/lib/supabase/server': 'export const createClient = async () => globalThis.consentRequestDb',
  '@/lib/supabase/admin': 'export const createAdminClient = () => { globalThis.consentAdminCreations++; return globalThis.consentPrivilegedDb }',
}
const feature = await importTs('app/api/legal/feature-consent/route.ts', mocks)
const accept = await importTs('app/api/legal/accept/route.ts', mocks)
const { getFeatureConsent } = await importTs('lib/legal/getFeatureConsent.ts', mocks)
const { hasCurrentLegalAcceptance } = await importTs('lib/legal/hasCurrentLegalAcceptance.ts', mocks)
const config = await importTs('lib/legal/config.ts')
const userId = 'qa-consent-user', clientId = 'QA-CONSENT-CLIENT'
const req = body => new Request('http://qa.test/api/legal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
const acknowledgments = { terms: true, privacy: true, healthDisclaimer: true }

function requestDb({ signedIn = true, authError = null, owned = true, clientError = null } = {}) {
  const reads = []
  globalThis.consentRequestDb = {
    reads,
    auth: { getUser: async () => ({ data: { user: signedIn ? { id: userId } : null }, error: authError }) },
    from(table) {
      assert.equal(table, 'clients', 'request transport must never access restricted compliance tables')
      const filters = [], query = {
        select(columns) { reads.push({ columns, filters }); return query },
        eq(key, value) { filters.push([key, value]); return query },
        maybeSingle: async () => {
          const client = { client_id: clientId, auth_user_id: userId, program: 'ember' }
          return { data: owned && filters.every(([key, value]) => client[key] === value) ? client : null, error: clientError }
        },
      }
      return query
    },
  }
  return globalThis.consentRequestDb
}

function privilegedDb({ failTable = null } = {}) {
  const tables = { feature_consent_events: [], legal_acceptances: [] }, reads = [], writes = []
  globalThis.consentAdminCreations = 0
  globalThis.consentPrivilegedDb = {
    tables, reads, writes,
    from(table) {
      assert.ok(table in tables)
      const filters = []
      let columns = '*', descending = false, limit = null
      const query = {
        insert: async payload => {
          if (table === failTable) return { error: { message: 'Private storage detail' } }
          for (const value of Array.isArray(payload) ? payload : [payload]) {
            const row = { id: 'qa-' + table + '-' + tables[table].length, recorded_at: '2026-10-13T17:00:00.' + String(tables[table].length).padStart(3, '0') + 'Z', ...structuredClone(value) }
            tables[table].push(row); writes.push({ table, row })
          }
          return { error: null }
        },
        select(value) { columns = value; return query },
        eq(key, value) { filters.push([key, value]); return query },
        order(_key, { ascending }) { descending = !ascending; return query },
        limit(value) { limit = value; return query },
        maybeSingle: async () => {
          reads.push({ table, columns, filters })
          if (table === failTable) return { data: null, error: { message: 'Private storage detail' } }
          let rows = tables[table].filter(row => filters.every(([key, value]) => row[key] === value))
          if (descending) rows = [...rows].reverse()
          if (limit !== null) rows = rows.slice(0, limit)
          const row = rows[0]
          return { data: row ? Object.fromEntries(columns.split(',').map(key => key.trim()).map(key => [key, row[key]])) : null, error: null }
        },
      }
      return query
    },
  }
  return globalThis.consentPrivilegedDb
}

test('feature consent grant and withdrawal append verified user/tier records and latest state survives a new request session', async () => {
  const request = requestDb(), admin = privilegedDb()
  let response = await feature.POST(req({ consentType: 'nutrition_tracking', granted: true, version: 'nutrition-v2', source: 'nutrition_page',
    metadata: { purpose: 'progress feedback', client_id: 'FORGED', program: 'phoenix' },
  }))
  assert.equal(response.status, 200)
  assert.equal(admin.tables.feature_consent_events[0].user_id, userId)
  assert.deepEqual(admin.tables.feature_consent_events[0].metadata, { purpose: 'progress feedback', client_id: clientId, program: 'ember' })
  assert.equal(admin.tables.feature_consent_events[0].consent_version, 'nutrition-v2')
  assert.equal(request.reads[0].columns, 'client_id,auth_user_id,program')
  requestDb()
  let current = await getFeatureConsent(globalThis.consentRequestDb, userId, 'nutrition_tracking')
  assert.equal(current.granted, true)
  response = await feature.POST(req({ consentType: 'nutrition_tracking', granted: false, version: 'nutrition-v2' }))
  assert.equal(response.status, 200)
  requestDb()
  current = await getFeatureConsent(globalThis.consentRequestDb, userId, 'nutrition_tracking')
  assert.equal(current.granted, false)
  assert.equal(admin.tables.feature_consent_events.length, 2, 'withdrawal must preserve original consent history')
  assert.ok(admin.reads.every(read => read.filters.some(([key, value]) => key === 'user_id' && value === userId)))
})

test('legal acceptance preserves all required server versions and explicitly declined research remains optional', async () => {
  requestDb()
  const admin = privilegedDb()
  const response = await accept.POST(req({ ...acknowledgments, researchConsent: true,
    featureConsents: { anonymized_research_use: false },
    terms_version: 'client-controlled', source: 'dashboard_legal_gate',
  }))
  assert.equal(response.status, 200)
  const legal = admin.tables.legal_acceptances[0]
  assert.equal(legal.user_id, userId)
  assert.equal(legal.terms_version, config.TERMS_VERSION)
  assert.equal(legal.privacy_version, config.PRIVACY_VERSION)
  assert.equal(legal.health_disclaimer_version, config.HEALTH_DISCLAIMER_VERSION)
  assert.equal(legal.ai_disclaimer_version, null, 'A retired document is never recorded as accepted.')
  assert.ok(!admin.tables.feature_consent_events.some(row => row.consent_type === 'ai_recommendations'))
  assert.equal(legal.research_consent_version, null)
  assert.equal(legal.acceptance_source, 'dashboard_legal_gate')
  assert.equal(admin.tables.feature_consent_events.find(row => row.consent_type === 'anonymized_research_use').granted, false)
  assert.ok(admin.tables.feature_consent_events.every(row => row.metadata.client_id === clientId && row.metadata.program === 'ember'))
  requestDb()
  assert.equal(await hasCurrentLegalAcceptance(globalThis.consentRequestDb, userId), true)
  const current = structuredClone(admin.tables.legal_acceptances[0])
  admin.tables.legal_acceptances[0].ai_disclaimer_version = 'historical-v1'
  const historical = structuredClone(admin.tables.legal_acceptances[0])
  assert.equal(await hasCurrentLegalAcceptance(globalThis.consentRequestDb, userId), true)
  assert.deepEqual(admin.tables.legal_acceptances[0], historical, 'Verifying old acceptance never rewrites consent history.')
  assert.ok(admin.reads.every(read => !read.filters.some(([key]) => key === 'ai_disclaimer_version')))
  admin.tables.legal_acceptances[0] = current
  admin.tables.legal_acceptances[0].terms_version = 'old-version'
  assert.equal(await hasCurrentLegalAcceptance(globalThis.consentRequestDb, userId), false)
})

test('forged user/client identities, missing sessions and unread ownership are rejected before privileged access', async () => {
  for (const [options, body, status] of [
    [{}, { userId: 'FOREIGN' }, 403],
    [{}, { clientId: 'FOREIGN' }, 403],
    [{ signedIn: false }, {}, 401],
    [{ authError: { message: 'Expired token' } }, {}, 401],
    [{ owned: false }, {}, 403],
    [{ clientError: { message: 'Request lookup failed' } }, {}, 503],
  ]) {
    requestDb(options)
    const admin = privilegedDb()
    const featureResult = await feature.POST(req({ consentType: 'cycle_tracking', granted: true, ...body }))
    const legalResult = await accept.POST(req({ ...acknowledgments, ...body }))
    assert.equal(featureResult.status, status)
    assert.equal(legalResult.status, status)
    assert.equal(globalThis.consentAdminCreations, 0)
    assert.equal(admin.writes.length, 0)
  }
  const request = requestDb(), admin = privilegedDb()
  await assert.rejects(getFeatureConsent(request, 'FOREIGN', 'cycle_tracking'), /own account/)
  await assert.rejects(hasCurrentLegalAcceptance(request, 'FOREIGN'), /own account/)
  assert.equal(globalThis.consentAdminCreations, 0)
  assert.equal(admin.reads.length, 0)
})

test('invalid consent purpose, non-boolean grant and missing required legal acknowledgments cannot create compliance records', async () => {
  requestDb()
  const admin = privilegedDb()
  for (const body of [
    { consentType: 'unknown_feature', granted: true },
    { consentType: 'cycle_tracking', granted: 'true' },
  ]) assert.equal((await feature.POST(req(body))).status, 400)
  assert.equal((await accept.POST(req({ ...acknowledgments, terms: 'true' }))).status, 400)
  for (const key of ['terms', 'privacy', 'healthDisclaimer']) {
    assert.equal((await accept.POST(req({ ...acknowledgments, [key]: false }))).status, 400)
    const missing = { ...acknowledgments };delete missing[key]
    assert.equal((await accept.POST(req(missing))).status, 400)
  }
  assert.equal((await accept.POST(req({ ...acknowledgments, featureConsents: [] }))).status, 400)
  assert.equal(globalThis.consentAdminCreations, 0)
  assert.equal(admin.writes.length, 0)
})

test('compliance storage failures never report success or expose private database details', async () => {
  requestDb()
  privilegedDb({ failTable: 'feature_consent_events' })
  let response = await feature.POST(req({ consentType: 'cycle_tracking', granted: true }))
  assert.equal(response.status, 503)
  assert.doesNotMatch(JSON.stringify(await response.json()), /Private storage detail/)
  response = await accept.POST(req({ ...acknowledgments, featureConsents: { anonymized_research_use: true } }))
  assert.equal(response.status, 503)
  assert.equal(globalThis.consentPrivilegedDb.tables.legal_acceptances.length, 0)
  requestDb()
  privilegedDb({ failTable: 'legal_acceptances' })
  response = await accept.POST(req(acknowledgments))
  assert.equal(response.status, 503)
  assert.doesNotMatch(JSON.stringify(await response.json()), /Private storage detail/)
  await assert.rejects(hasCurrentLegalAcceptance(globalThis.consentRequestDb, userId), /could not be verified/)
})

test('cached retired acknowledgments require a fresh form and cannot append legal or feature acceptance', async () => {
  requestDb();const admin = privilegedDb()
  for (const body of [
    { ...acknowledgments, aiDisclaimer: true }, { ...acknowledgments, aiDisclaimer: false },
    { ...acknowledgments, aiDisclaimer: null },
    { ...acknowledgments, featureConsents: { ai_recommendations: true } },
    { ...acknowledgments, featureConsents: { ai_recommendations: false } },
  ]) {
    const response = await accept.POST(req(body))
    assert.equal(response.status, 409)
    assert.equal((await response.json()).code, 'retired_acknowledgment')
  }
  assert.equal(globalThis.consentAdminCreations, 0)
  assert.equal(admin.writes.length, 0)
})

test('retired feature grants fail while explicit withdrawal preserves historical consent and other purposes', async () => {
  requestDb();const admin = privilegedDb()
  admin.tables.feature_consent_events.push({ id: 'historical', user_id: userId, consent_type: 'ai_recommendations',
    granted: true, consent_version: 'v1.0', recorded_at: '2026-07-01T12:00:00Z' })
  const before = structuredClone(admin.tables.feature_consent_events[0])
  let response = await feature.POST(req({ consentType: 'ai_recommendations', granted: true }))
  assert.equal(response.status, 409);assert.equal(globalThis.consentAdminCreations, 0)
  assert.equal((await getFeatureConsent(globalThis.consentRequestDb, userId, 'ai_recommendations')).granted, true)
  response = await feature.POST(req({ consentType: 'ai_recommendations', granted: false }))
  assert.equal(response.status, 200)
  assert.equal((await getFeatureConsent(globalThis.consentRequestDb, userId, 'ai_recommendations')).granted, false)
  assert.deepEqual(admin.tables.feature_consent_events[0], before)
  assert.equal(admin.tables.feature_consent_events.length, 2)
  assert.ok(config.FEATURE_CONSENT_TYPES.includes('ai_recommendations'), 'Historical purpose remains readable.')
  assert.ok(!config.ACTIVE_FEATURE_CONSENT_TYPES.includes('ai_recommendations'), 'Retired purpose is not newly grantable.')
  response = await feature.POST(req({ consentType: 'posture_assessment_photos', granted: true }))
  assert.equal(response.status, 200, 'Actual photo permission remains distinct and explicit.')
})
