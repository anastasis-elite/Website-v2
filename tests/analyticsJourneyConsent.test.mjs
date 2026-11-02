import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { createRequire } from 'node:module'
import { webcrypto } from 'node:crypto'
import ts from 'typescript'
import { importTs } from './typescriptModule.mjs'

const require = createRequire(import.meta.url)
const privacy = await importTs('lib/analytics/privacy.ts')
const tick = () => new Promise(resolve => setImmediate(resolve))
const memberA = '11111111-1111-4111-8111-111111111111'
const memberB = '22222222-2222-4222-8222-222222222222'
const plain = value => JSON.parse(JSON.stringify(value))

function view(storage = new Map([['cookie_consent', 'accepted']])) {
  const calls = [], timers = [], listeners = new Map(), initialized = []
  const document = { cookie: '' }
  const browser = {
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    setTimeout(fn) { timers.push(fn) }, requestIdleCallback(fn) { timers.push(fn) }, location: { protocol: 'https:' },
    addEventListener(name, fn) { listeners.set(name, fn) }, removeEventListener(name) { listeners.delete(name) },
    dispatchEvent(event) { listeners.get(event.type)?.(event) },
  }
  let config
  const sdk = { init(_key, next) { config = next; initialized.push(next) }, stopSessionRecording() {}, reset() {}, opt_in_capturing() {}, opt_out_capturing() {},
    capture(event, properties) {
      const capture = config.before_send({ uuid: webcrypto.randomUUID(), event, properties: { ...properties, '$current_url': 'https://site.test/?token=secret' }, $set: { email: 'unsafe@example.test' } })
      if (capture) calls.push(plain(capture))
    },
  }
  class FixedDate extends Date { static now() { return 1_800_000_000_000 } }
  const globals = { window: browser, document, crypto: webcrypto, TextEncoder, Date: FixedDate, Event: class Event { constructor(type) { this.type = type } }, process: { env: { NEXT_PUBLIC_POSTHOG_KEY: 'synthetic' } } }
  const compile = (path, mocks) => {
    const module = { exports: {} }
    const compiled = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
    runInNewContext(compiled, { ...globals, module, exports: module.exports, require: name => mocks[name] || require(name) })
    return module.exports
  }
  const consent = compile('lib/analytics/consent.ts', {})
  const api = compile('lib/posthog.ts', { '@/lib/analytics/consent': consent, '@/lib/analytics/privacy': { ...privacy, filterAnalyticsEvent: (event, properties) => privacy.filterAnalyticsEvent(event, properties, 'test') }, 'posthog-js': { __esModule: true, default: sdk } })
  return { storage, calls, initialized, api, consent, document, browser, listeners, compile,
    async flush() { while (timers.length) timers.shift()(); await tick(); await tick() },
  }
}

test('a consented anonymous journey joins the first hashed member without accepting caller identity properties', async () => {
  const app = view()
  const anonymous = plain(app.api.readAnalyticsConsentContext())
  app.api.default.capture('landing_page_viewed', { page: 'landing' })
  await app.flush()
  assert.equal(app.calls[0].properties.distinct_id, anonymous.journeyId)
  assert.equal(app.calls[0].properties.journey_id, anonymous.journeyId)
  await app.api.setAnalyticsIdentity(memberA)
  assert.deepEqual(plain(app.api.readAnalyticsConsentContext()), anonymous)
  app.api.default.capture('today_page_viewed', { tier: 'ignite', journey_id: 'anonymous_33333333-3333-4333-8333-333333333333', member_id: 'untrusted@example.test' })
  const member = app.calls.at(-1).properties
  assert.match(member.distinct_id, /^member_[0-9a-f]{64}$/)
  assert.equal(member.journey_id, anonymous.journeyId)
  assert.equal(member.member_id, member.distinct_id)
  assert.doesNotMatch(JSON.stringify(member), /11111111|untrusted|33333333|token/)
  assert.equal(privacy.filterAnalyticsEvent('analytics_identity_linked', { journey_id: anonymous.journeyId, member_id: member.distinct_id }, 'test').properties.journey_id, undefined)
  const before = app.calls.length
  app.api.default.capture('analytics_identity_linked', { journey_id: anonymous.journeyId, member_id: member.distinct_id })
  assert.equal(app.calls.length, before, 'Identity linkage is a trusted server event, never an ordinary browser claim.')
})

test('member reload keeps its own journey while account switches and logout isolate all later events', async () => {
  const first = view()
  const original = plain(first.api.readAnalyticsConsentContext())
  await first.api.setAnalyticsIdentity(memberA)
  first.api.default.capture('today_page_viewed', { tier: 'ignite' }); await first.flush()
  const reloaded = view(first.storage)
  await reloaded.api.setAnalyticsIdentity(memberA)
  assert.deepEqual(plain(reloaded.api.readAnalyticsConsentContext()), original)
  reloaded.api.default.capture('today_page_viewed', { tier: 'ignite' }); await reloaded.flush()
  assert.equal(reloaded.calls[0].properties.journey_id, original.journeyId)
  await reloaded.api.setAnalyticsIdentity(memberB)
  const switched = plain(reloaded.api.readAnalyticsConsentContext())
  assert.notEqual(switched.clientId, original.clientId)
  assert.notEqual(switched.journeyId, original.journeyId)
  assert.ok(switched.revision > original.revision)
  reloaded.api.default.capture('today_page_viewed', { tier: 'ignite' })
  assert.equal(reloaded.calls.at(-1).properties.journey_id, switched.journeyId)
  const oldTabCount = first.calls.length
  first.api.default.capture('today_page_viewed', { tier: 'ignite' })
  assert.equal(first.calls.length, oldTabCount, 'An old tab cannot pair its old member ID with the new account journey.')
  reloaded.api.resetAnalyticsIdentity()
  const loggedOut = plain(reloaded.api.readAnalyticsConsentContext())
  assert.notEqual(loggedOut.clientId, switched.clientId)
  assert.notEqual(loggedOut.journeyId, switched.journeyId)
  reloaded.api.default.capture('landing_page_viewed', { page: 'landing' })
  assert.equal(reloaded.calls.at(-1).properties.distinct_id, loggedOut.journeyId)
  assert.equal(reloaded.calls.at(-1).properties.member_id, undefined)
})

test('anonymous consent posts retain revisions on restart, decline immediately and ignore reversed responses or stale storage notifications', async () => {
  const app = view(), posts = []
  let cleanup
  // Supply a transport only to the component, never to PostHog or an external service.
  const module = { exports: {} }
  const source = ts.transpileModule(readFileSync('components/DeferredAnalytics.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  const mocks = {
    react: { useEffect(fn) { cleanup = fn() } }, '@/lib/posthog': app.api, '@/lib/analytics/consent': app.consent,
    '@/lib/supabase/client': { createClient: () => ({ auth: { getUser: () => new Promise(() => {}), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) } }) },
  }
  runInNewContext(source, { module, exports: module.exports, window: app.browser,
    fetch(url, options) { const request = { url, body: JSON.parse(options.body) }; posts.push(request); return new Promise(resolve => { request.resolve = resolve }) },
    require: name => mocks[name] || require(name),
  })
  module.exports.default()
  assert.equal(posts.length, 1)
  const accepted = posts[0].body
  assert.equal(accepted.accepted, true); assert.match(accepted.journeyId, /^anonymous_/)
  app.api.default.capture('landing_page_viewed', { page: 'landing' }); await app.flush()
  const capturedBeforeDecline = app.calls.length
  app.api.setAnalyticsConsent('declined')
  assert.equal(app.api.hasAnalyticsConsent(), false)
  app.api.default.capture('landing_page_viewed', { page: 'landing' })
  assert.equal(app.calls.length, capturedBeforeDecline)
  const withdrawn = posts.at(-1).body
  assert.equal(withdrawn.accepted, false)
  assert.equal(withdrawn.clientId, accepted.clientId)
  assert.ok(withdrawn.revision > accepted.revision)
  assert.equal(withdrawn.journeyId, undefined)
  posts.at(-1).resolve({ ok: true }); posts[0].resolve({ ok: true }); await tick()
  assert.equal(app.api.hasAnalyticsConsent(), false)
  app.listeners.get('storage')({ key: app.consent.ANALYTICS_CONSENT_STORAGE_KEY, newValue: JSON.stringify(accepted) })
  assert.deepEqual(posts.at(-1).body, withdrawn)
  assert.deepEqual(plain(app.api.readAnalyticsConsentContext()), withdrawn)
  const cookie = JSON.parse(decodeURIComponent(app.document.cookie.split('=')[1].split(';')[0]))
  assert.deepEqual(cookie, withdrawn)
  cleanup()
  assert.equal(app.listeners.size, 0)
})

test('a persisted owned journey captures and queues nothing until initial auth resolves, then isolates a different or missing owner', async () => {
  for (const actualOwner of [memberB, null, memberA]) {
    const previous = view()
    const original = plain(previous.api.readAnalyticsConsentContext())
    await previous.api.setAnalyticsIdentity(memberA)
    const storedOwner = previous.storage.get(previous.consent.ANALYTICS_JOURNEY_OWNER_KEY)
    const app = view(previous.storage), posts = []
    let resolveAuth, resolveIdentity, cleanup
    const identityDone = new Promise(resolve => { resolveIdentity = resolve })
    // The component's fetch is injected into its own VM only.
    const module = { exports: {} }
    const compiled = ts.transpileModule(readFileSync('components/DeferredAnalytics.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
    const mocks = {
      react: { useEffect(fn) { cleanup = fn() } },
      '@/lib/posthog': { ...app.api, async setAnalyticsIdentity(id) { await app.api.setAnalyticsIdentity(id); resolveIdentity() } },
      '@/lib/analytics/consent': app.consent,
      '@/lib/supabase/client': { createClient: () => ({ auth: { getUser: () => new Promise(resolve => { resolveAuth = resolve }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) } }) },
    }
    runInNewContext(compiled, { module, exports: module.exports, window: app.browser, fetch(_url, options) { posts.push(JSON.parse(options.body)); return Promise.resolve({ ok: true }) }, require: name => mocks[name] || require(name) })
    module.exports.default()
    assert.equal(app.api.canCaptureAnalytics(), false)
    app.api.startDeferredAnalytics()
    app.api.default.capture('landing_page_viewed', { page: 'landing' })
    assert.equal(app.api.scrubAnalyticsCapture({ uuid: 'test', event: 'landing_page_viewed', properties: {} }), null)
    await app.flush()
    assert.equal(app.initialized.length, 0)
    assert.equal(app.calls.length, 0)
    assert.equal(posts.length, 0)
    resolveAuth({ data: { user: actualOwner ? { id: actualOwner } : null } })
    await identityDone; await app.flush()
    assert.equal(app.calls.length, 0, 'Suppressed attempts were never queued for later delivery.')
    const resolved = plain(app.api.readAnalyticsConsentContext())
    if (actualOwner === memberA) assert.equal(resolved.journeyId, original.journeyId)
    else {
      assert.notEqual(resolved.journeyId, original.journeyId)
      assert.notEqual(resolved.clientId, original.clientId)
    }
    app.api.default.capture('landing_page_viewed', { page: 'landing' }); await app.flush()
    assert.equal(app.calls.length, 1)
    assert.equal(app.calls[0].properties.journey_id, resolved.journeyId)
    if (actualOwner !== memberA) assert.notEqual(app.calls[0].properties.member_id, storedOwner)
    if (!actualOwner) assert.equal(app.calls[0].properties.member_id, undefined)
    cleanup()
  }
})

test('a rendered stage waits for owner resolution without marking a suppressed capture emitted', async () => {
  const previous = view()
  await previous.api.setAnalyticsIdentity(memberA)
  const original = previous.api.readAnalyticsConsentContext()
  const app = view(previous.storage), captures = []
  let cleanup
  const stage = app.compile('components/TrackEvent.tsx', {
    react: { useRef: () => ({ current: null }), useEffect(fn) { cleanup = fn() } },
    '@/lib/posthog': app.api,
    '@/lib/analytics': { trackEvent(event, properties) { captures.push(event); app.api.default.capture(event, properties) } },
  })
  stage.default({ event: 'landing_page_viewed', properties: { page: 'landing' } })
  await app.flush()
  assert.equal(captures.length, 0)
  await app.api.setAnalyticsIdentity(memberB); await app.flush()
  assert.deepEqual(captures, ['landing_page_viewed'])
  assert.equal(app.calls.length, 1)
  assert.notEqual(app.calls[0].properties.journey_id, original.journeyId)
  app.browser.dispatchEvent({ type: app.api.ANALYTICS_IDENTITY_READY_EVENT })
  assert.equal(captures.length, 1)
  cleanup()
})

test('before_send rejects an anonymous identity if another tab marks its journey as member-owned', async () => {
  const app = view()
  app.api.default.capture('landing_page_viewed', { page: 'landing' }); await app.flush()
  assert.equal(app.calls.length, 1)
  const member = view()
  await member.api.setAnalyticsIdentity(memberA)
  app.storage.set(app.consent.ANALYTICS_JOURNEY_OWNER_KEY, member.storage.get(member.consent.ANALYTICS_JOURNEY_OWNER_KEY))
  assert.equal(app.api.canCaptureAnalytics(), false)
  assert.equal(app.api.scrubAnalyticsCapture({ uuid: 'test', event: 'landing_page_viewed', properties: {} }), null)
  app.api.default.capture('landing_page_viewed', { page: 'landing' })
  assert.equal(app.calls.length, 1)
})
