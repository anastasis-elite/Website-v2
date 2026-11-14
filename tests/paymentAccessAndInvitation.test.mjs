import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'
import { importTs } from './typescriptModule.mjs'

const membershipPolicy = await importTs('lib/membership/policy.ts')
const memberAccess = { hasMemberAccess: membershipPolicy.hasActiveMembership }

const require = createRequire(import.meta.url)
function load(path, mocks = {}, env = {}) {
  const module = { exports: {} }
  const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX } }).outputText
  vm.runInNewContext(code, { module, exports: module.exports, require: name => name === 'server-only' ? {} : mocks[name] ?? require(name), process: { env }, Buffer, Date, URL, URLSearchParams, console })
  return module.exports
}

test('canceled access redirects member content while shared dashboard layout permits billing and support', async () => {
  const client = { client_id: 'AN-CANCELED', program: 'ember', access: false, active: false, verified_purchase: true, subscription_ends_at: '2025-01-01T00:00:00Z', onboarding_completed: true, birthdate: '1990-01-01', address_line_1: '1 Test Way', city: 'Test', state: 'IL', postal_code: '60000' }
  const db = { auth: { getUser: async () => ({ data: { user: { id: 'owned-user' } }, error: null }) }, from: table => ({ select() { return this }, eq() { return this }, async maybeSingle() { return { data: table === 'clients' ? client : null, error: null } } }) }
  const context = load('lib/dashboard/getDashboardContext.ts', {
    react: { ...require('react'), cache: fn => fn },
    'next/navigation': { redirect: path => { throw new Error('REDIRECT ' + path) } },
    '@/lib/supabase/server': { createClient: async () => db },
    '@/lib/performance/dashboardStartupRequest': { getDashboardStartupTiming: () => ({ measure: (_stage, task) => task() }) },
    '@/lib/commerce/access': memberAccess,
    '@/lib/membership/policy': membershipPolicy,
    '@/lib/dashboard/isClientOnboardingComplete': load('lib/dashboard/isClientOnboardingComplete.ts'),
  })
  await assert.rejects(context.getDashboardContext({ allowIncompleteOnboarding: true }), /REDIRECT \/dashboard\/payment-issue/)
  const options = []; let legalChecks = 0
  const layout = load('app/dashboard/layout.tsx', {
    '@/lib/dashboard/getDashboardContext': { getDashboardContext: async args => { options.push(args); return context.getDashboardContext(args) } },
    'next/navigation': { redirect: path => { throw new Error('REDIRECT ' + path) } },
    '@/lib/legal/hasCurrentLegalAcceptance': { hasCurrentLegalAcceptance: async () => { legalChecks++; return false } },
    '@/lib/commerce/access': memberAccess,
    '@/lib/membership/policy': membershipPolicy,
    '@/lib/dashboard/isClientOnboardingComplete': load('lib/dashboard/isClientOnboardingComplete.ts'),
    '@/components/DailyPlanRefresh': () => null,
    '@/components/membership/MembershipExperienceCard': () => null,
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
  const db = { async rpc(name,args) {
    if(name==='claim_purchase_invitation') {
      if(state.queryError) return {error:state.queryError}
      if(state.recent||state.limited) return {data:null,error:null}
      state.inserts.push({token_hash:args.p_token_hash})
      return {data:{session_id:'cs_test_QA',client_id:'AN-QA',email:'receipt@example.test',program:'ember',lease_token:'synthetic-lease'},error:null}
    }
    assert.equal(name,'finish_purchase_invitation')
    if(args.p_delivered) state.updates.push({delivered_at:new Date().toISOString()})
    if(state.saveError)return {error:state.saveError}
    state.recent=args.p_delivered?{id:'delivered'}:null
    return {data:true,error:null}
  },from() {return {select(){return this},eq(){return this},async maybeSingle(){return {data:{status:state.recent?'delivered':'pending'},error:null}}}} }
  class Resend { emails = { send: async value => { state.messages.push(value); return { data: state.mailError ? null : { id: 'mail-mock' }, error: state.mailError } } } }
  const invitations = load('lib/auth/clientInvitations.ts')
  const module = load('lib/commerce/invitationDelivery.ts', {
    resend: { Resend }, '@/lib/auth/clientInvitations': invitations,
  }, { RESEND_API_KEY: 're_mock_only', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-signing-secret' })
  const run = () => module.deliverPurchaseInvitation({ supabase: db, clientId: 'AN-QA', email: 'receipt@example.test', program: 'ember', sessionId: 'cs_test_QA', origin: 'https://isolated.example.test' })
  return { state, run, invitations }
}

test('purchase login capability is stored hashed and delivered only to receipt email', async () => {
  const f = invitationFixture()
  assert.equal(await f.run(), true)
  assert.equal(f.state.messages.length, 1)
  assert.equal(f.state.messages[0].to, 'receipt@example.test')
  assert.equal(f.state.inserts.length, 1)
  const token = f.state.messages[0].html.match(/token=([A-Za-z0-9_-]+)/)[1]
  assert.equal(f.state.inserts[0].token_hash, f.invitations.hashInvitationToken(token))
  assert.doesNotMatch(JSON.stringify(f.state.inserts[0]), new RegExp(token))
  assert.equal(f.state.updates.length, 1)
  assert.ok(f.state.updates[0].delivered_at)
  await f.run()
  assert.equal(f.state.messages.length, 1)
})

test('invitation delivery database, pending leases and provider failures never report successful delivery', async () => {
  const missing = load('lib/commerce/invitationDelivery.ts', { resend: {}, '@/lib/auth/clientInvitations': {} })
  await assert.rejects(missing.deliverPurchaseInvitation({}), /not configured/)
  const blocked = invitationFixture(); blocked.state.limited = true
  await assert.rejects(blocked.run(), /pending/); assert.equal(blocked.state.messages.length, 0)
  const unavailable = invitationFixture(); unavailable.state.queryError = { message: 'missing migration' }
  await assert.rejects(unavailable.run(), /administrator setup/); assert.equal(unavailable.state.messages.length, 0)
  const provider = invitationFixture(); provider.state.mailError = { message: 'unverified sender' }
  await assert.rejects(provider.run(), /Retry is required/); assert.equal(provider.state.updates.length, 0)
  const unsaved = invitationFixture(); unsaved.state.saveError = { message: 'database unavailable' }
  await assert.rejects(unsaved.run(), /Retry is required/)
})
