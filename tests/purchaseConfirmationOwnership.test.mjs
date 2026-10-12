import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'
const require = createRequire(import.meta.url)
function load(path, mocks = {}, env = {}) {
  const module = { exports: {} }
  const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX } }).outputText
  vm.runInNewContext(code, { module, exports: module.exports, require: name => mocks[name] ?? require(name), process: { env }, Buffer, Date, URL, console })
  return module.exports
}
function fixture() {
  const env = { STRIPE_SECRET_KEY: 'sk_test_local', PAYMENT_TEST_DATABASE_ISOLATED: 'true' }
  const proof = load('lib/commerce/purchaseProof.ts')
  const token = proof.createPurchaseProof()
  const state = { cookie: undefined, user: null, invitations: [], fulfills: 0, claims: [], existingLogin: null }
  const session = { id: 'cs_test_QA', metadata: { purchase_proof_hash: proof.hashPurchaseProof(token) }, customer_email: 'qa@example.test' }
  class Stripe { checkout = { sessions: { retrieve: async () => session } } }
  const db = { from() { const query = { select() { return this }, eq() { return this }, not() { return this }, limit() { return this }, async maybeSingle() { return { data: state.existingLogin, error: null } } }; return query }, async rpc(name, args) { state.claims.push({ name, args }); return { data: { client_id: 'existing-owned', email: 'qa@example.test', program: 'ember', auth_user_id: state.user.id }, error: null } } }
  const page = load('app/verified/page.tsx', {
    stripe: Stripe, 'next/link': () => null, 'next/headers': { cookies: async () => ({ get: name => name === proof.purchaseCookieName(session.id) && state.cookie ? { value: state.cookie } : undefined }) }, '../styles/globalstyles': {},
    '@/lib/supabase/admin': { createAdminClient: () => db }, '@/lib/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: state.user } }) } }) },
    '@/lib/commerce/invitationDelivery': { deliverPurchaseInvitation: async value => { state.invitations.push(value) } },
    '@/lib/commerce/fulfillment': { fulfillPurchase: async () => { state.fulfills++; return { clientId: 'pending-owned', email: 'qa@example.test', program: 'ember', authUserId: null } } },
    '@/lib/commerce/purchaseProof': proof, '@/lib/commerce/environment': load('lib/commerce/environment.ts', {}, env),
  }, env).default
  return { state, token, page, session, render: () => page({ searchParams: Promise.resolve({ session_id: session.id }) }) }
}
test('a session reference or forged cookie does not issue a private login invitation', async () => {
  const f = fixture()
  await f.render()
  assert.equal(f.state.fulfills, 0); assert.equal(f.state.invitations.length, 0)
  f.state.cookie = 'forged'
  await f.render()
  assert.equal(f.state.fulfills, 0)
  f.state.user = { id: 'other', email: 'other@example.test', email_confirmed_at: '2026-10-12' }
  await f.render()
  assert.equal(f.state.claims.length, 0); assert.equal(f.state.invitations.length, 0)
})
test('the guest capability delivers a private login link to receipt email; verified returning email claims saved account', async () => {
  const f = fixture(); f.state.cookie = f.token
  const guest = await f.render()
  assert.equal(f.state.fulfills, 1); assert.equal(f.state.invitations.length, 1)
  assert.equal(f.state.invitations[0].clientId, 'pending-owned')
  assert.equal(f.state.invitations[0].email, 'qa@example.test')
  assert.match(JSON.stringify(guest), /Check your email/)
  assert.doesNotMatch(JSON.stringify(guest), /create-login|fixture-login-token|token=/)
  const returning = fixture(); returning.state.user = { id: 'existing-user', email: 'qa@example.test', email_confirmed_at: '2026-10-12' }
  const page = await returning.render()
  assert.equal(returning.state.claims[0].name, 'claim_checkout_purchase')
  assert.equal(returning.state.claims[0].args.p_user_id, 'existing-user')
  assert.equal(returning.state.invitations.length, 0)
  assert.match(JSON.stringify(page), /connected to your private login/)
})
test('an existing login purchase requires sign-in and never creates a replacement invitation', async () => {
  const f = fixture(); f.state.cookie = f.token; f.state.existingLogin = { client_id: 'existing-owned' }
  const page = await f.render()
  assert.equal(f.state.invitations.length, 0); assert.equal(f.state.claims.length, 0)
  assert.match(JSON.stringify(page), /Sign in and connect purchase/)
})
