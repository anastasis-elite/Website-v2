import assert from 'node:assert/strict'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'

// Model React's request dispatcher: arguments identify a read only within the
// currently active server render, even when the same client object is supplied
// on a later request. No production cache implementation is replaced.
const { hasCurrentLegalAcceptance } = await importTs('lib/legal/hasCurrentLegalAcceptance.ts', {
  react: `export const cache = fn => {
    const requests = new Map()
    return (...args) => {
      const scope = globalThis.__legalRequestScope
      if (!requests.has(scope)) requests.set(scope, [])
      const entries = requests.get(scope)
      const found = entries.find(entry => entry.args.length === args.length && entry.args.every((value, index) => value === args[index]))
      if (found) return found.result
      const result = fn(...args)
      entries.push({ args, result })
      return result
    }
  }`,
  '@/lib/supabase/admin': `export const createAdminClient = () => globalThis.__legalRequestAdmin`,
  '@/lib/performance/dashboardStartupRequest': `export const getDashboardStartupTiming = () => ({ measure(stage, task) {
    globalThis.__legalRequestTimings.push(stage)
    return task()
  } })`,
})

function fixture(t, { owner = 'legal-owner', accepted = true, readError = null } = {}) {
  const calls = { auth: 0, client: 0, legal: [], timings: [] }
  const state = { owner, accepted, readError }
  const supabase = {
    auth: { async getUser() { calls.auth += 1; return { data: { user: { id: state.owner } }, error: null } } },
    from(table) {
      assert.equal(table, 'clients')
      const filters = [], query = { select() { return query }, eq(...filter) { filters.push(filter); return query },
        async maybeSingle() { calls.client += 1; return { data: { client_id: 'LEGAL-CLIENT', auth_user_id: state.owner, program: 'ignite' }, error: null } } }
      return query
    },
  }
  globalThis.__legalRequestAdmin = { from(table) {
    assert.equal(table, 'legal_acceptances')
    const filters = [], query = { select() { return query }, eq(...filter) { filters.push(filter); return query }, limit() { return query },
      async maybeSingle() { calls.legal.push(filters); return { data: state.accepted ? { id: 'acceptance' } : null, error: state.readError } } }
    return query
  } }
  globalThis.__legalRequestScope = Symbol('server request')
  globalThis.__legalRequestTimings = calls.timings
  t.after(() => { delete globalThis.__legalRequestScope; delete globalThis.__legalRequestAdmin; delete globalThis.__legalRequestTimings })
  return { supabase, calls, state }
}

test('layout and page share the identical authorized legal read only within their server render', async t => {
  const { supabase, calls } = fixture(t)
  assert.deepEqual(await Promise.all([hasCurrentLegalAcceptance(supabase, 'legal-owner'), hasCurrentLegalAcceptance(supabase, 'legal-owner')]), [true, true])
  assert.equal(calls.auth, 1)
  assert.equal(calls.client, 1)
  assert.equal(calls.legal.length, 1)
  assert.deepEqual(calls.timings, ['legal'], 'Record the actual cached legal work once, including authorization, even when the page joins it later.')
  assert.ok(calls.legal[0].some(([column, value]) => column === 'user_id' && value === 'legal-owner'))
  globalThis.__legalRequestScope = Symbol('next server request')
  await hasCurrentLegalAcceptance(supabase, 'legal-owner')
  assert.equal(calls.auth, 2)
  assert.equal(calls.client, 2)
  assert.equal(calls.legal.length, 2)
  assert.deepEqual(calls.timings, ['legal', 'legal'])
})

test('different Supabase/user scopes retain authorization and a later account never inherits an acceptance', async t => {
  const { supabase, calls, state } = fixture(t)
  await hasCurrentLegalAcceptance(supabase, 'legal-owner')
  await assert.rejects(hasCurrentLegalAcceptance(supabase, 'foreign-user'), /own account/)
  assert.equal(calls.auth, 2)
  assert.equal(calls.legal.length, 1)
  const differentClient = { ...supabase }
  await hasCurrentLegalAcceptance(differentClient, 'legal-owner')
  assert.equal(calls.auth, 3)
  assert.equal(calls.legal.length, 2)
  globalThis.__legalRequestScope = Symbol('account switched')
  state.owner = 'new-owner'
  state.accepted = false
  await assert.rejects(hasCurrentLegalAcceptance(supabase, 'legal-owner'), /own account/)
  assert.equal(await hasCurrentLegalAcceptance(supabase, 'new-owner'), false)
  assert.equal(calls.legal.length, 3)
})

test('a failed request-scoped legal read remains closed and a new request can retry current evidence', async t => {
  const { supabase, calls, state } = fixture(t, { readError: { message: 'Synthetic legal source outage' } })
  const results = await Promise.allSettled([hasCurrentLegalAcceptance(supabase, 'legal-owner'), hasCurrentLegalAcceptance(supabase, 'legal-owner')])
  assert.ok(results.every(result => result.status === 'rejected' && /could not be verified/.test(result.reason.message)))
  assert.equal(calls.auth, 1)
  assert.equal(calls.legal.length, 1)
  state.readError = null
  globalThis.__legalRequestScope = Symbol('retry request')
  assert.equal(await hasCurrentLegalAcceptance(supabase, 'legal-owner'), true)
  assert.equal(calls.auth, 2)
  assert.equal(calls.legal.length, 2)
})
