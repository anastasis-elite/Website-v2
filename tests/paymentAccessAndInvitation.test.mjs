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

test('canceled access redirects member content while shared dashboard layout permits billing and support', async () => {
  const client = { client_id: 'AN-CANCELED', program: 'ember', access: false, active: false, verified_purchase: true, subscription_ends_at: '2025-01-01T00:00:00Z', onboarding_completed: true, birthdate: '1990-01-01', address_line_1: '1 Test Way', city: 'Test', state: 'IL', postal_code: '60000' }
  const db = { auth: { getUser: async () => ({ data: { user: { id: 'owned-user' } }, error: null }) }, from: table => ({ select() { return this }, eq() { return this }, async maybeSingle() { return { data: table === 'clients' ? client : null, error: null } } }) }
  const context = load('lib/dashboard/getDashboardContext.ts', {
    react: { ...require('react'), cache: fn => fn },
    'next/navigation': { redirect: path => { throw new Error('REDIRECT ' + path) } },
    '@/lib/supabase/server': { createClient: async () => db },
    '@/lib/commerce/access': load('lib/commerce/access.ts'),
    '@/lib/dashboard/isClientOnboardingComplete': load('lib/dashboard/isClientOnboardingComplete.ts'),
  })
  await assert.rejects(context.getDashboardContext({ allowIncompleteOnboarding: true }), /REDIRECT \/dashboard\/payment-issue/)
  const options = []; let legalChecks = 0
  const layout = load('app/dashboard/layout.tsx', {
    '@/lib/dashboard/getDashboardContext': { getDashboardContext: async args => { options.push(args); return context.getDashboardContext(args) } },
    'next/navigation': { redirect: path => { throw new Error('REDIRECT ' + path) } },
    '@/lib/legal/hasCurrentLegalAcceptance': { hasCurrentLegalAcceptance: async () => { legalChecks++; return false } },
    '@/lib/commerce/access': load('lib/commerce/access.ts'),
    '@/lib/dashboard/isClientOnboardingComplete': load('lib/dashboard/isClientOnboardingComplete.ts'),
    '@/components/DailyPlanRefresh': () => null,
    '@/components/navigation/ClientDashboardNav': () => null,
    '@/components/tutorial/TutorialProvider': { TutorialProvider: () => null },
    '@/components/tutorial/TutorialDevPanel': () => null,
    '@/components/tutorial/TutorialRenderer': () => null,
    '@/components/program-dashboard/DashboardLoadingShell': () => null,
    '@/lib/timezone': { getClientTimeZone: () => 'America/Chicago' },
  }, { LEGAL_GATE_ENABLED: 'true' }).default
  const streamed = layout({ children: 'Billing remains reachable' })
  const protectedLayout = streamed.props.children
  const rendered = await protectedLayout.type(protectedLayout.props)
  assert.equal(options[0].allowInactiveAccess, true)
  assert.equal(options[0].allowIncompleteOnboarding, true)
  assert.equal(legalChecks, 0)
  assert.match(JSON.stringify(rendered), /Billing remains reachable/)
})

function invitationFixture() {
  const state = { recent: null, queryError: null, saveError: null, mailError: null, limited: false, inserts: [], updates: [], messages: [] }
  const db = { from(table) {
    assert.equal(table, 'client_invitations')
    const query = { select() { return this }, eq() { return this }, is() { return this }, gte() { return this }, limit() { return this }, async maybeSingle() { return { data: state.recent, error: state.queryError } }, async insert(row) { state.inserts.push(row); return { error: null } }, update(row) { state.updates.push(row); return this }, then(resolve) { return Promise.resolve({ error: state.saveError }).then(resolve) } }
    return query
  } }
  class Resend { emails = { send: async value => { state.messages.push(value); return { data: state.mailError ? null : { id: 'mail-mock' }, error: state.mailError } } } }
  const invitations = load('lib/auth/clientInvitations.ts')
  const module = load('lib/commerce/invitationDelivery.ts', {
    resend: { Resend }, '@/lib/auth/clientInvitations': invitations,
    '@/lib/auth/rateLimit': { enforceRateLimit: async () => !state.limited },
  }, { RESEND_API_KEY: 're_mock_only' })
  const run = () => module.deliverPurchaseInvitation({ supabase: db, clientId: 'AN-QA', email: 'receipt@example.test', program: 'ember', sessionId: 'cs_test_QA', origin: 'https://isolated.example.test' })
  return { state, run, invitations }
}

test('purchase login capability is stored hashed and delivered only to receipt email', async () => {
  const f = invitationFixture()
  assert.equal(await f.run(), undefined)
  assert.equal(f.state.messages.length, 1)
  assert.equal(f.state.messages[0].to, 'receipt@example.test')
  assert.equal(f.state.inserts.length, 1)
  const token = f.state.messages[0].html.match(/token=([A-Za-z0-9_-]+)/)[1]
  assert.equal(f.state.inserts[0].token_hash, f.invitations.hashInvitationToken(token))
  assert.doesNotMatch(JSON.stringify(f.state.inserts[0]), new RegExp(token))
  assert.equal(f.state.updates.length, 1)
  assert.ok(f.state.updates[0].delivered_at)
  f.state.recent = { id: 'already-delivered' }
  await f.run()
  assert.equal(f.state.messages.length, 1)
})

test('invitation delivery database, rate limit and provider failures never report successful delivery', async () => {
  const missing = load('lib/commerce/invitationDelivery.ts', { resend: {}, '@/lib/auth/clientInvitations': {}, '@/lib/auth/rateLimit': {} })
  await assert.rejects(missing.deliverPurchaseInvitation({}), /not configured/)
  const blocked = invitationFixture(); blocked.state.limited = true
  await assert.rejects(blocked.run(), /recently requested/); assert.equal(blocked.state.messages.length, 0)
  const unavailable = invitationFixture(); unavailable.state.queryError = { message: 'missing migration' }
  await assert.rejects(unavailable.run(), /administrator setup/); assert.equal(unavailable.state.messages.length, 0)
  const provider = invitationFixture(); provider.state.mailError = { message: 'unverified sender' }
  await assert.rejects(provider.run(), /could not send/); assert.equal(provider.state.updates.length, 0)
  const unsaved = invitationFixture(); unsaved.state.saveError = { message: 'database unavailable' }
  await assert.rejects(unsaved.run(), /delivery status could not be saved/)
})
