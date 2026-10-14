import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { importTs } from './typescriptModule.mjs'

const { logRecommendationAudit } = await importTs('lib/legal/logRecommendationAudit.ts', {
  '@/lib/supabase/admin': 'export const createAdminClient = () => { globalThis.auditAdminCreations++; return globalThis.authorizedAuditDb }',
})
const owner = 'qa-verified-owner'
const clientId = 'QA-OWNED-CLIENT'
const args = { userId: owner, clientId, recommendationType: 'daily_program_logic',
  engineVersion: 'qa-v1', recommendationOutput: { action: 'Recovery' } }

function requestClient({ signedIn = true, authError = null, owned = true, clientError = null, row } = {}) {
  const reads = []
  return {
    reads,
    auth: { getUser: async () => ({ data: { user: signedIn ? { id: owner } : null }, error: authError }) },
    from(table) {
      const filters = [], query = {
        select(columns) { reads.push({ table, columns, filters }); return query },
        eq(column, value) { filters.push([column, value]); return query },
        maybeSingle: async () => ({ data: row || (owned ? { client_id: clientId, auth_user_id: owner } : null), error: clientError }),
      }
      assert.equal(table, 'clients', 'the request transport may read ownership but cannot append audit records')
      return query
    },
  }
}

function admin({ error = null, throws = false } = {}) {
  const writes = []
  globalThis.auditAdminCreations = 0
  globalThis.authorizedAuditDb = {
    writes,
    from(table) {
      assert.equal(table, 'recommendation_audit_logs')
      return { insert: async payload => {
        if (throws) throw new Error('Transport failure with a private payload')
        if (error) return { error }
        writes.push(structuredClone(payload))
        return { error: null }
      } }
    },
  }
  return globalThis.authorizedAuditDb
}

test('verified server recommendation uses privileged transport only after minimal ownership verification', async () => {
  const request = requestClient(), privileged = admin()
  const result = await logRecommendationAudit({ ...args, supabase: request,
    inputSnapshot: { capacity: 'low', client_id: 'SPOOFED-SNAPSHOT-CLIENT' },
    inputReference: 'saved-member-records', safetyFlags: [],
  })
  assert.equal(result, true)
  assert.equal(globalThis.auditAdminCreations, 1)
  assert.deepEqual(request.reads, [{ table: 'clients', columns: 'client_id,auth_user_id',
    filters: [['client_id', clientId], ['auth_user_id', owner]] }])
  assert.equal(privileged.writes.length, 1)
  assert.equal(privileged.writes[0].user_id, owner)
  assert.deepEqual(privileged.writes[0].input_snapshot, { capacity: 'low', client_id: clientId })
  assert.equal(privileged.writes[0].recommendation_type, 'daily_program_logic')
  assert.equal(privileged.writes[0].recommendation_output.action, 'Recovery')
})

test('forged users, foreign clients, unauthenticated sessions and unsupported operations never instantiate privileged transport', async t => {
  t.mock.method(console, 'error', () => {})
  const fixtures = [
    { request: requestClient(), values: { userId: 'forged-user' } },
    { request: requestClient({ owned: false }), values: { clientId: 'FOREIGN-CLIENT' } },
    { request: requestClient({ signedIn: false }) },
    { request: requestClient({ authError: { message: 'Expired session' } }) },
    { request: requestClient({ clientError: { message: 'Ownership read unavailable' } }) },
    { request: requestClient({ row: { client_id: clientId, auth_user_id: 'foreign-owner' } }) },
    { request: requestClient({ row: { client_id: 'FOREIGN-CLIENT', auth_user_id: owner } }) },
    { request: requestClient(), values: { recommendationType: 'client_controlled_event' } },
    { request: requestClient(), values: { clientId: '' } },
  ]
  for (const fixture of fixtures) {
    const privileged = admin()
    assert.equal(await logRecommendationAudit({ ...args, ...fixture.values, supabase: fixture.request }), false)
    assert.equal(globalThis.auditAdminCreations, 0)
    assert.equal(privileged.writes.length, 0)
  }
})

test('audit permission and transport failures remain observable without leaking recommendation inputs or rejecting recommendations', async t => {
  const errors = []
  t.mock.method(console, 'error', (...values) => errors.push(values))
  const request = requestClient()
  admin({ error: { code: '42501', message: 'private member health payload' } })
  assert.equal(await logRecommendationAudit({ ...args, supabase: request }), false)
  admin({ throws: true })
  assert.equal(await logRecommendationAudit({ ...args, supabase: request }), false)
  assert.equal(errors.length, 2)
  assert.equal(errors[0][2].code, '42501')
  assert.match(errors[0][1], /Database write rejected/)
  assert.match(errors[1][1], /Audit operation unavailable/)
  assert.doesNotMatch(JSON.stringify(errors), /private|health payload|qa-verified-owner|Recovery/)
})

test('audit helper has a server-only boundary and application contexts use it instead of direct client audit inserts', () => {
  assert.match(readFileSync('lib/legal/logRecommendationAudit.ts', 'utf8'), /^import 'server-only'/)
  const route = readFileSync('app/api/program/generate/route.ts', 'utf8')
  assert.doesNotMatch(route, /supabase\.from\('recommendation_audit_logs'\)/)
  assert.equal((route.match(/await logRecommendationAudit\(/g) || []).length, 2)
  assert.equal((route.match(/clientId: client\.client_id/g) || []).length, 2)
})
