import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { webcrypto } from 'node:crypto'
import { createRequire } from 'node:module'
import ts from 'typescript'
import { importTs } from './typescriptModule.mjs'

const privacy = await importTs('lib/analytics/privacy.ts')
const tick = () => new Promise(resolve => setImmediate(resolve))

function harness(consent, cryptoImpl = webcrypto, projectKey = 'synthetic-key') {
  const values = new Map(consent ? [['cookie_consent', consent]] : [])
  const calls = [], timers = [], initialized = []
  let resetCount = 0, optedOut = 0
  const sdk = {
    init(_key, config) { initialized.push(config) },
    capture(event, properties) {
      const result = initialized.at(-1).before_send({ uuid: '11111111-1111-4111-8111-111111111111', event, properties: { ...properties, token: 'synthetic-key', '$current_url': 'https://site.test/audit/results/secret?token=unsafe', '$referrer': 'https://secret.test', email: 'private@example.test' }, $set: { email: 'private@example.test' } })
      if (result) calls.push(result)
    },
    stopSessionRecording() {}, reset() { resetCount++ }, opt_out_capturing() { optedOut++ }, opt_in_capturing() {},
  }
  const browser = { localStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) },
    setTimeout(fn) { timers.push(fn) }, requestIdleCallback(fn) { timers.push(fn) }, dispatchEvent() {}, location: { protocol: 'https:' } }
  const document = { cookie: '' }
  const consentModule = { exports: {} }
  const consentCompiled = ts.transpileModule(readFileSync('lib/analytics/consent.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  runInNewContext(consentCompiled, { module: consentModule, exports: consentModule.exports, window: browser, document, crypto: cryptoImpl, Date })
  const module = { exports: {} }
  const compiled = ts.transpileModule(readFileSync('lib/posthog.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  runInNewContext(compiled, { module, exports: module.exports, process: { env: { NEXT_PUBLIC_POSTHOG_KEY: projectKey } }, window: browser, document, crypto: cryptoImpl, TextEncoder, URL, Date, Event: class Event {},
    require(name) {
      if (name === 'posthog-js') return { __esModule: true, default: sdk }
      if (name === '@/lib/analytics/privacy') return { ...privacy, filterAnalyticsEvent: (event, properties) => privacy.filterAnalyticsEvent(event, properties, 'test') }
      if (name === '@/lib/analytics/consent') return consentModule.exports
      throw new Error(`Unexpected dependency ${name}`)
    },
  })
  const api = module.exports
  return { api, values, calls, initialized, document, async flush() { while (timers.length) timers.shift()(); await tick(); await tick() },
    get resetCount() { return resetCount }, get optedOut() { return optedOut } }
}

test('event and property allowlists reject sensitive values and assessment, payment and recommendation details', () => {
  const audit = privacy.filterAnalyticsEvent('audit_page_completed', { page: 'audit', capacity_score: 91, recommended_program: 'phoenix', audit_id: 'sensitive', email: 'private@example.test', answers: { pain: true } }, 'test')
  assert.deepEqual(audit.properties, { page: 'audit', analytics_environment: 'test', analytics_schema: 1 })
  const supplement = privacy.filterAnalyticsEvent('supplement_recommendation_shown', { recommendation_category: 'cycle_support', product_id: 'pregnancy-support', source: 'private@example.test', tier: 'ignite' }, 'test')
  assert.deepEqual(supplement.properties, { analytics_environment: 'test', analytics_schema: 1, tier: 'ignite' })
  assert.equal(privacy.filterAnalyticsEvent('$snapshot', { data: 'private' }), null)
  assert.equal(privacy.filterAnalyticsEvent('raw_secret_event', { source: 'landing' }), null)
  assert.equal(privacy.safeAnalyticsPath('/audit/results/private-audit-id?token=secret#email'), '/audit/results')
  assert.equal(privacy.safeAnalyticsPath('/dashboard/assessment/private?answer=secret'), '/dashboard/progress')
  assert.equal(privacy.safeAnalyticsPath('/dashboard/cycle?date=2026-11-01'), '/dashboard/account')
  assert.equal(privacy.safeAnalyticsPath('/unknown/private-value'), undefined)
  const nav = privacy.filterAnalyticsEvent('dashboard_navigation_clicked', { href: '/dashboard/nutrition?token=secret#health', item: 'private@example.test' }, 'test')
  assert.equal(nav.properties.href, '/dashboard/nutrition'); assert.equal(nav.properties.item, undefined)
})

test('SDK never initializes or queues tracking without accepted consent and rechecks consent before deferred load', async () => {
  const view = harness()
  view.api.startDeferredAnalytics(); view.api.default.capture('landing_page_viewed', { page: 'landing' }); await view.flush()
  assert.equal(view.initialized.length, 0); assert.equal(view.calls.length, 0)
  view.api.setAnalyticsConsent('accepted')
  view.api.default.capture('landing_page_viewed', { page: 'landing' })
  view.api.setAnalyticsConsent('declined')
  await view.flush()
  assert.equal(view.initialized.length, 0); assert.equal(view.calls.length, 0)
  assert.match(view.document.cookie, /analytics_context=/)
  assert.equal(JSON.parse(decodeURIComponent(view.document.cookie.split('=')[1].split(';')[0])).accepted, false)
})

test('SDK disables automatic collection and strips enriched properties and person data at before_send', async () => {
  const view = harness('accepted')
  view.api.default.capture('audit_page_completed', { page: 'audit', capacity_score: 80, recommended_program: 'phoenix', audit_id: 'secret' })
  await view.flush()
  const config = view.initialized[0]
  for (const key of ['capture_pageview', 'capture_pageleave', 'autocapture', 'enable_recording_console_log', 'capture_exceptions', 'capture_performance', 'ip']) assert.equal(config[key], false)
  for (const key of ['disable_session_recording', 'disable_surveys', 'advanced_disable_flags', 'disable_external_dependency_loading']) assert.equal(config[key], true)
  assert.equal(config.person_profiles, 'never'); assert.equal(config.persistence, 'memory')
  assert.equal(view.calls.length, 1)
  assert.deepEqual(Object.keys(view.calls[0].properties).sort(), ['$geoip_disable', '$process_person_profile', 'analytics_environment', 'analytics_schema', 'distinct_id', 'journey_id', 'page', 'token'])
  assert.equal(view.calls[0].properties.token, 'synthetic-key')
  assert.equal(view.calls[0].properties.$geoip_disable, true)
  assert.equal(view.calls[0].properties.$process_person_profile, false)
  assert.match(view.calls[0].properties.distinct_id, /^anonymous_[0-9a-f-]{36}$/)
  assert.equal(view.calls[0].$set, undefined)
  assert.equal(config.before_send({ uuid: 'test', event: '$identify', properties: { email: 'private@example.test' } }), null)
  assert.equal(config.before_send({ uuid: 'test', event: 'first_workout_completed', properties: { tier: 'phoenix' } }), null)
  view.api.default.capture('subscription_activated', { tier: 'phoenix' })
  assert.equal(view.calls.length, 1)
  view.api.setAnalyticsConsent('declined')
  view.api.default.capture('landing_page_viewed', { page: 'landing' })
  assert.equal(view.calls.length, 1); assert.equal(view.optedOut, 1)
})

test('identity changes hash only validated UUIDs, discard prior queued events, and reset on logout', async () => {
  const view = harness('accepted')
  view.api.default.capture('landing_page_viewed', { page: 'landing' })
  await view.api.setAnalyticsIdentity('11111111-1111-4111-8111-111111111111')
  await view.flush()
  assert.equal(view.calls.length, 0, 'A prior anonymous queue is discarded at a member identity boundary.')
  view.api.default.capture('today_page_viewed', { tier: 'ignite' })
  const memberA = view.calls[0].properties.distinct_id
  assert.match(memberA, /^member_[0-9a-f]{64}$/)
  assert.doesNotMatch(memberA, /11111111/)
  await view.api.setAnalyticsIdentity('22222222-2222-4222-8222-222222222222')
  view.api.default.capture('today_page_viewed', { tier: 'ignite' })
  assert.notEqual(view.calls[1].properties.distinct_id, memberA)
  view.api.resetAnalyticsIdentity()
  view.api.default.capture('landing_page_viewed', { page: 'landing' })
  assert.match(view.calls[2].properties.distinct_id, /^anonymous_/)
  await view.api.setAnalyticsIdentity('private@example.test')
  view.api.default.capture('landing_page_viewed', { page: 'landing' })
  assert.match(view.calls[3].properties.distinct_id, /^anonymous_/)
})

test('production environment collection requires explicit configuration and consent UI keeps automatic Google page data disabled', () => {
  const previous = process.env.NEXT_PUBLIC_ANALYTICS_ENV
  delete process.env.NEXT_PUBLIC_ANALYTICS_ENV
  assert.notEqual(privacy.analyticsEnvironment(), 'production')
  process.env.NEXT_PUBLIC_ANALYTICS_ENV = 'production'
  assert.equal(privacy.analyticsEnvironment(), process.env.NODE_TEST_CONTEXT || process.env.NODE_ENV === 'test' ? 'test' : 'production')
  if (previous === undefined) delete process.env.NEXT_PUBLIC_ANALYTICS_ENV; else process.env.NEXT_PUBLIC_ANALYTICS_ENV = previous
  const banner = readFileSync('components/CookieBanner.tsx', 'utf8')
  assert.match(banner, /setAnalyticsConsent\('accepted'\)/)
  assert.match(banner, /setAnalyticsConsent\('declined'\)/)
  assert.match(banner, /send_page_view: false/)
  assert.match(banner, /page_referrer: ''/)
})

test('a stale initial identity read cannot restore a logged-out account; consent persistence sends only the current choice', async () => {
  const require = createRequire(import.meta.url)
  const module = { exports: {} }, identities = [], posts = [], listeners = new Map()
  let finishIdentityRead, authChange, cleanup
  const compiled = ts.transpileModule(readFileSync('components/DeferredAnalytics.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  const mocks = {
    react: { useEffect(fn) { cleanup = fn() } },
    '@/lib/posthog': { refreshAnalyticsConsent() {}, startDeferredAnalytics() {}, canCaptureAnalytics: () => true, setAnalyticsIdentity(id) { identities.push(id) }, readAnalyticsConsentContext: () => ({ accepted: true, revision: 1, clientId: '11111111-1111-4111-8111-111111111111' }) },
    '@/lib/analytics/consent': { ANALYTICS_CONSENT_STORAGE_KEY: 'anastasis:analytics-consent:v1', writeAnalyticsContextCookie() {} },
    '@/lib/supabase/client': { createClient: () => ({ auth: {
      getUser: () => new Promise(resolve => { finishIdentityRead = resolve }),
      onAuthStateChange(fn) { authChange = fn; return { data: { subscription: { unsubscribe() {} } } } },
    } }) },
  }
  runInNewContext(compiled, { module, exports: module.exports,
    window: { localStorage: { getItem: () => 'accepted' }, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) },
    fetch(url, options) { posts.push({ url, body: JSON.parse(options.body) }); return Promise.resolve({ ok: true }) },
    require: name => mocks[name] || require(name),
  })
  module.exports.default()
  authChange('SIGNED_OUT', null)
  finishIdentityRead({ data: { user: { id: 'old-member' } } })
  await tick()
  assert.deepEqual(identities, [null]); assert.equal(posts.length, 2)
  authChange('SIGNED_IN', { user: { id: 'current-member' } })
  await tick()
  assert.deepEqual(identities, [null, 'current-member'])
  assert.equal(posts.length, 3)
  for (const post of posts) assert.deepEqual(post, { url: '/api/analytics/consent', body: { accepted: true, revision: 1, clientId: '11111111-1111-4111-8111-111111111111' } })
  cleanup(); assert.equal(listeners.size, 0)
})

test('unavailable cryptographic identity drops optional telemetry without failing an action', async () => {
  const view = harness('accepted', {})
  view.api.default.capture('landing_page_viewed', { page: 'landing' })
  await view.flush()
  assert.equal(view.calls.length, 0)
})


// Exercise the wire boundary directly, including attempted transport overrides.
test('ingestion token comes only from the configured project, without reopening payload fields', async () => {
  const view = harness('accepted')
  const capture = { uuid: '11111111-1111-4111-8111-111111111111', event: 'today_page_viewed',
    properties: { tier: 'ember', token: 'wrong-project', api_key: 'untrusted', email: 'private@example.test', $set: { private: true } } }
  const result = view.api.scrubAnalyticsCapture(capture)
  assert.equal(result.properties.token, 'synthetic-key')
  assert.equal(result.properties.tier, 'ember')
  for (const key of ['api_key', 'email', '$set']) assert.equal(result.properties[key], undefined)
  assert.equal(harness('accepted', webcrypto, '').api.scrubAnalyticsCapture(capture), null)
  assert.equal(harness('declined').api.scrubAnalyticsCapture(capture), null)
  assert.equal(view.api.scrubAnalyticsCapture({ ...capture, event: '$pageview' }), null)
})

test('deployment environment labels production without mistaking preview or local builds for production', () => {
  const source = ts.transpileModule(readFileSync('lib/analytics/privacy.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  function label(env) {
    const module = { exports: {} }
    runInNewContext(source, { module, exports: module.exports, process: { env }, URL })
    return module.exports.analyticsEnvironment()
  }
  assert.equal(label({ NODE_ENV: 'production' }), 'development')
  assert.equal(label({ NODE_ENV: 'production', NEXT_PUBLIC_VERCEL_ENV: 'production' }), 'production')
  assert.equal(label({ VERCEL_ENV: 'production' }), 'production')
  assert.equal(label({ NODE_ENV: 'production', NEXT_PUBLIC_VERCEL_ENV: 'preview' }), 'development')
  assert.equal(label({ NEXT_PUBLIC_VERCEL_ENV: 'preview', VERCEL_ENV: 'production' }), 'development')
  assert.equal(label({ NEXT_PUBLIC_ANALYTICS_ENV: 'development', NEXT_PUBLIC_VERCEL_ENV: 'production' }), 'development')
  assert.equal(label({ NEXT_PUBLIC_ANALYTICS_ENV: 'test', NEXT_PUBLIC_VERCEL_ENV: 'production' }), 'test')
  assert.equal(label({ NEXT_PUBLIC_ANALYTICS_ENV: 'production' }), 'production')
  assert.equal(label({ NODE_ENV: 'test', NEXT_PUBLIC_VERCEL_ENV: 'production' }), 'test')
})
