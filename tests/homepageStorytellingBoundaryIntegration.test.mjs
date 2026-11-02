import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { runInContext, createContext } from 'node:vm'
import { webcrypto } from 'node:crypto'
import ts from 'typescript'

const memberA = '11111111-1111-4111-8111-111111111111'
const memberB = '22222222-2222-4222-8222-222222222222'
const plain = value => JSON.parse(JSON.stringify(value))
const tick = () => new Promise(resolve => setImmediate(resolve))

// These browser and SDK fixtures do not replace the collector, consent policy,
// identity boundary, schemas, or canonical funnel implementation under test.
function browserFixture(storage = new Map([['cookie_consent', 'accepted']])) {
  const captures = [], initialized = [], timers = [], microtasks = [], observers = []
  const attempted = [], rejectedEvents = new Set(), modules = new Map()
  class BrowserEvent {
    constructor(type, properties = {}) { this.type = type; Object.assign(this, properties) }
  }
  class EventTarget {
    listeners = new Map()
    addEventListener(type, callback) {
      if (!this.listeners.has(type)) this.listeners.set(type, new Set())
      this.listeners.get(type).add(callback)
    }
    removeEventListener(type, callback) {
      this.listeners.get(type)?.delete(callback)
      if (!this.listeners.get(type)?.size) this.listeners.delete(type)
    }
    dispatchEvent(event) {
      for (const callback of [...(this.listeners.get(event.type) || [])]) callback(event)
      return true
    }
  }
  class Element {
    constructor(tagName, { id = '', dataset = {}, href } = {}) {
      this.tagName = tagName.toUpperCase(); this.id = id; this.dataset = dataset
      this.parentElement = null; this.children = []; this.connected = true
      this.rect = { top: 1500, left: 0, width: 200, height: 50, right: 200, bottom: 1550 }
      if (href !== undefined) this.href = new URL(href, 'https://site.test').href
    }
    get isConnected() { return this.connected && (!this.parentElement || this.parentElement.isConnected) }
    append(...children) { for (const child of children) { child.parentElement = this; this.children.push(child) } }
    contains(element) { return element === this || this.children.some(child => child.contains(element)) }
    matches(selector) {
      return selector.split(',').some(part => {
        part = part.trim()
        if (part === 'a[href]') return this.tagName === 'A' && this.href !== undefined
        if (part === '[data-homepage-audit-cta]') return Object.hasOwn(this.dataset, 'homepageAuditCta')
        if (part.startsWith('#')) return this.id === part.slice(1)
        return this.tagName.toLowerCase() === part
      })
    }
    closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector) || null }
    querySelector(selector) {
      for (const child of this.children) {
        if (child.matches(selector)) return child
        const descendant = child.querySelector(selector)
        if (descendant) return descendant
      }
      return null
    }
    getBoundingClientRect() { return this.rect }
  }
  class IntersectionObserver {
    constructor(callback, options) {
      this.callback = callback; this.options = plain(options); this.observed = new Set()
      this.unobserved = []; this.disconnected = false; observers.push(this)
    }
    observe(element) { this.observed.add(element) }
    unobserve(element) { this.unobserved.push(element); this.observed.delete(element) }
    disconnect() { this.disconnected = true; this.observed.clear() }
    notify(entries) { this.callback(entries, this) }
  }
  const document = new EventTarget()
  document.cookie = ''; document.documentElement = { clientWidth: 1000, clientHeight: 800 }
  const window = new EventTarget()
  Object.assign(window, {
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) },
    location: { origin: 'https://site.test', protocol: 'https:', href: 'https://site.test/?token=unsafe#private' },
    innerWidth: 1000, innerHeight: 800,
    setTimeout(callback) { timers.push(callback) }, requestIdleCallback(callback) { timers.push(callback) },
  })
  const sdk = {
    init(key, config) { assert.equal(key, 'synthetic-key'); initialized.push(config) },
    stopSessionRecording() {}, reset() {}, opt_in_capturing() {}, opt_out_capturing() {},
    capture(event, properties) {
      attempted.push(event)
      const accepted = initialized.at(-1).before_send({ uuid: webcrypto.randomUUID(), event,
        properties: { ...properties, '$current_url': 'https://site.test/?token=unsafe#private', '$referrer': 'https://private.test', email: 'private@example.test', answers: { pain: true } },
        $set: { email: 'private@example.test' } })
      if (!accepted || rejectedEvents.has(event)) return undefined
      captures.push(plain(accepted))
      return accepted
    },
  }
  const env = { NODE_ENV: 'test', NEXT_PUBLIC_POSTHOG_KEY: 'synthetic-key' }
  const context = createContext({ window, document, crypto: webcrypto, TextEncoder, Date, URL,
    Element, HTMLElement: Element, Event: BrowserEvent, MouseEvent: BrowserEvent, IntersectionObserver,
    queueMicrotask: callback => microtasks.push(callback), process: { env },
  })
  function load(path) {
    if (modules.has(path)) return modules.get(path).exports
    const module = { exports: {} }; modules.set(path, module)
    const compiled = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
    } }).outputText
    const execute = runInContext(`(function (module, exports, require) {\n${compiled}\n})`, context, { filename: path })
    execute(module, module.exports, name => {
      if (name === 'posthog-js') return { __esModule: true, default: sdk }
      if (name.startsWith('@/')) return load(`${name.slice(2)}.ts`)
      throw new Error(`Unexpected dependency ${name}`)
    })
    return module.exports
  }
  const analytics = load('lib/analytics.ts'), boundary = load('lib/posthog.ts')
  const consent = load('lib/analytics/consent.ts'), collector = load('lib/analytics/homepageStorytelling.ts')
  const funnel = load('lib/analytics/funnel.ts')
  function root() {
    const main = new Element('main'), headings = {}, sections = {}
    for (const id of ['story', 'founder', 'community']) {
      const section = new Element('section', { id }), heading = new Element('h2')
      section.append(heading); main.append(section); headings[id] = heading; sections[id] = section
    }
    return { main, headings, sections }
  }
  function geometry(element, visible) {
    element.rect = { top: visible ? 100 : 1500, left: 0, width: 200, height: 50, right: 200, bottom: visible ? 150 : 1550 }
  }
  function intersect(observer, element, ratio = 1) {
    geometry(element, ratio >= 0.2)
    observer.notify([{ target: element, isIntersecting: ratio > 0, intersectionRatio: ratio }])
  }
  function click(link, event = new BrowserEvent('click', { target: link })) { document.dispatchEvent(event); return event }
  function auditLink(page, href = '/audit', location = 'hero') {
    const wrapper = new Element('div', { dataset: { homepageAuditCta: location } }), link = new Element('a', { href })
    wrapper.append(link); page.main.append(wrapper); return link
  }
  return { storage, captures, initialized, attempted, rejectedEvents, timers, microtasks, observers, window, document, env,
    analytics, boundary, consent, collector, funnel, root, Element, BrowserEvent, geometry, intersect, click, auditLink,
    ready() { window.dispatchEvent(new BrowserEvent(boundary.ANALYTICS_IDENTITY_READY_EVENT)) },
    async flush() {
      while (microtasks.length) microtasks.shift()()
      while (timers.length) timers.shift()()
      await tick(); await tick()
      while (microtasks.length) microtasks.shift()()
    },
  }
}

test('the actual collector records one canonical landing per root across effect replay and keeps optional views out of funnel stages', async () => {
  const app = browserFixture(), page = app.root()
  const dispose = app.collector.mountHomepageAnalytics(page.main)
  const observer = app.observers[0]
  assert.deepEqual(observer.options.threshold, [0, 0.2])
  assert.deepEqual([...observer.observed], Object.values(page.headings), 'Observe h2 headings rather than entire tall sections.')
  app.intersect(observer, page.headings.story, 0.19)
  app.intersect(observer, page.headings.story, 0.2)
  app.intersect(observer, page.headings.founder)
  app.intersect(observer, page.headings.community)
  await app.flush()
  dispose()
  const replayCleanup = app.collector.mountHomepageAnalytics(page.main)
  app.ready(); await app.flush()
  assert.deepEqual(app.captures.map(row => row.event), ['landing_page_viewed', 'homepage_story_section_viewed', 'homepage_founder_section_viewed', 'homepage_community_section_viewed'])
  const report = app.funnel.buildLinkedFunnels(app.captures.map((row, index) => ({
    event: row.event, occurredAt: new Date(1_800_000_000_000 + index).toISOString(), journeyId: row.properties.journey_id,
  })))
  const acquisition = report.funnels.find(item => item.id === 'acquisition')
  assert.deepEqual(plain(acquisition.steps.map(step => [step.event, step.total])), [['landing_page_viewed', 1], ['checkout_started', 0], ['subscription_activated', 0]])
  assert.equal(report.quality.acceptedEvents, 1)
  assert.equal(report.quality.excludedEvents, 3, 'Optional content views are ordinary telemetry, not canonical conversion steps.')
  for (const row of app.captures) {
    assert.equal(row.properties.analytics_environment, 'test')
    assert.equal(row.properties.experiment_id, 'homepage_storytelling_v1')
    assert.equal(row.properties.homepage_version, 'storytelling_v1')
    assert.doesNotMatch(JSON.stringify(row), /unsafe|private|token|answers|email|\$current_url|\$referrer|\$set/)
  }
  const otherPage = app.root(), otherCleanup = app.collector.mountHomepageAnalytics(otherPage.main)
  await app.flush()
  assert.equal(app.captures.filter(row => row.event === 'landing_page_viewed').length, 2)
  replayCleanup(); otherCleanup()
})

for (const [label, resolvedOwner] of [['same owner', memberA], ['different owner', memberB], ['no owner', null]]) {
  test(`a persisted owned journey waits for auth without queueing or marking, then resumes current views once for ${label}`, async () => {
    const original = browserFixture()
    await original.boundary.setAnalyticsIdentity(memberA)
    const previous = plain(original.boundary.readAnalyticsConsentContext())
    const previousOwner = original.storage.get(original.consent.ANALYTICS_JOURNEY_OWNER_KEY)
    const app = browserFixture(new Map(original.storage)), page = app.root()
    app.geometry(page.headings.story, true)
    const dispose = app.collector.mountHomepageAnalytics(page.main), observer = app.observers[0]
    app.intersect(observer, page.headings.story)
    app.intersect(observer, page.headings.founder)
    app.geometry(page.headings.founder, false) // Last observer record may be stale while auth resolves.
    app.ready()
    app.window.dispatchEvent(new app.BrowserEvent('analytics-consent-changed'))
    app.window.dispatchEvent(new app.BrowserEvent('storage', { key: app.consent.ANALYTICS_CONSENT_STORAGE_KEY }))
    await app.flush()
    assert.equal(app.boundary.canCaptureAnalytics(), false)
    assert.equal(app.initialized.length, 0)
    assert.equal(app.attempted.length, 0)
    assert.equal(app.captures.length, 0)
    assert.equal(app.timers.length, 0, 'An unresolved owned journey must not schedule the SDK.')
    assert.equal(observer.unobserved.length, 0, 'Suppressed section attempts must remain eligible to retry.')
    await app.boundary.setAnalyticsIdentity(resolvedOwner)
    await app.flush()
    assert.deepEqual(app.captures.map(row => row.event), ['landing_page_viewed', 'homepage_story_section_viewed'])
    assert.deepEqual(observer.unobserved, [page.headings.story])
    const current = plain(app.boundary.readAnalyticsConsentContext())
    assert.equal(current.journeyId === previous.journeyId, resolvedOwner === memberA)
    assert.equal(current.clientId === previous.clientId, resolvedOwner === memberA)
    for (const row of app.captures) {
      assert.equal(row.properties.journey_id, current.journeyId)
      if (resolvedOwner === memberA) assert.equal(row.properties.member_id, previousOwner)
      else assert.notEqual(row.properties.member_id, previousOwner)
      if (!resolvedOwner) {
        assert.equal(row.properties.member_id, undefined)
        assert.equal(row.properties.distinct_id, current.journeyId)
      } else assert.match(row.properties.member_id, /^member_[0-9a-f]{64}$/)
    }
    app.ready(); await app.boundary.setAnalyticsIdentity(resolvedOwner)
    app.window.dispatchEvent(new app.BrowserEvent('analytics-consent-changed'))
    await app.flush()
    assert.equal(app.captures.length, 2, 'Repeated readiness must not repeat already accepted views.')
    dispose()
  })
}

test('declined or absent consent sends nothing; same-tab acceptance resumes only current views, never historical clicks', async () => {
  for (const choice of [undefined, 'declined']) {
    const app = browserFixture(new Map(choice ? [['cookie_consent', choice]] : [])), page = app.root()
    const dispose = app.collector.mountHomepageAnalytics(page.main), observer = app.observers[0]
    app.intersect(observer, page.headings.story)
    app.intersect(observer, page.headings.founder)
    app.geometry(page.headings.founder, false)
    app.click(app.auditLink(page))
    await app.flush()
    assert.equal(app.initialized.length, 0); assert.equal(app.captures.length, 0)
    assert.equal(observer.unobserved.length, 0)
    app.boundary.setAnalyticsConsent('accepted')
    await app.flush()
    assert.deepEqual(app.captures.map(row => row.event), ['landing_page_viewed', 'homepage_story_section_viewed'])
    app.boundary.setAnalyticsConsent('declined')
    app.intersect(observer, page.headings.community)
    app.click(app.auditLink(page, '/audit', 'final_cta'))
    await app.flush()
    assert.equal(app.captures.length, 2, 'Withdrawal must immediately block new clicks and views.')
    app.geometry(page.headings.community, false)
    app.boundary.setAnalyticsConsent('accepted'); await app.flush()
    assert.equal(app.captures.length, 2, 'Consent restoration must not replay withdrawn clicks or scrolled-away views.')
    dispose()
  }
})

test('real shared capture rejection leaves homepage views retryable and queue acceptance prevents effect replay duplicates', async () => {
  const app = browserFixture(), page = app.root()
  app.boundary.startDeferredAnalytics(); await app.flush()
  assert.equal(app.initialized.length, 1)
  app.rejectedEvents.add('landing_page_viewed'); app.rejectedEvents.add('homepage_story_section_viewed')
  const dispose = app.collector.mountHomepageAnalytics(page.main), observer = app.observers[0]
  app.intersect(observer, page.headings.story)
  assert.equal(app.captures.length, 0)
  assert.equal(observer.unobserved.length, 0)
  app.rejectedEvents.clear(); app.ready(); await app.flush()
  assert.deepEqual(app.captures.map(row => row.event), ['landing_page_viewed', 'homepage_story_section_viewed'])
  app.ready(); await app.flush()
  assert.equal(app.captures.length, 2)
  dispose()
  const queued = browserFixture(), queuedPage = queued.root()
  const firstCleanup = queued.collector.mountHomepageAnalytics(queuedPage.main)
  firstCleanup()
  const secondCleanup = queued.collector.mountHomepageAnalytics(queuedPage.main)
  await queued.flush()
  assert.deepEqual(queued.captures.map(row => row.event), ['landing_page_viewed'])
  secondCleanup()
})

test('audit and program clicks use internal destinations, fixed metadata and per-event deduplication across listeners', async () => {
  const app = browserFixture(), page = app.root()
  const dispose = app.collector.mountHomepageAnalytics(page.main)
  const replayCleanup = app.collector.mountHomepageAnalytics(page.main)
  await app.flush()
  const audit = app.auditLink(page, '/audit?token=unsafe#private')
  const clicked = app.click(audit); app.click(audit, clicked)
  app.click(app.auditLink(page, 'https://external.test/audit', 'outcome'))
  app.click(app.auditLink(page, '/dashboard/account', 'final_cta'))
  const program = new app.Element('a', { href: '/program/ignite?token=unsafe#private' })
  const child = new app.Element('span'); program.append(child); page.sections.story.append(program)
  const programEvent = app.click(child); app.click(child, programEvent)
  const external = new app.Element('a', { href: 'https://external.test/program/phoenix' }); page.sections.story.append(external)
  app.click(external)
  const nav = new app.Element('nav'), allPrograms = new app.Element('a', { href: '/program' })
  nav.append(allPrograms); app.click(allPrograms)
  await app.flush()
  assert.deepEqual(app.captures.map(row => row.event), ['landing_page_viewed', 'audit_cta_clicked_1', 'homepage_program_cta_clicked', 'homepage_program_cta_clicked'])
  assert.equal(app.captures[1].properties.cta_location, 'hero')
  assert.equal(app.captures[2].properties.program, 'ignite')
  assert.equal(app.captures[2].properties.location, 'story')
  assert.equal(app.captures[3].properties.program, 'all')
  assert.equal(app.captures[3].properties.location, 'navigation')
  assert.doesNotMatch(JSON.stringify(app.captures), /unsafe|private|token|external|\$current_url|\$referrer|\$set/)
  dispose(); replayCleanup()
})

test('dispose removes listeners and ignores queued microtasks, stale observer deliveries and detached roots', async () => {
  const app = browserFixture(new Map()), page = app.root()
  const dispose = app.collector.mountHomepageAnalytics(page.main), observer = app.observers[0]
  app.intersect(observer, page.headings.story)
  app.click(app.auditLink(page))
  assert.ok(app.microtasks.length > 0)
  dispose()
  assert.equal(observer.disconnected, true)
  assert.equal(app.document.listeners.size, 0)
  assert.equal(app.window.listeners.size, 0)
  app.boundary.setAnalyticsConsent('accepted')
  app.ready(); observer.notify([{ target: page.headings.story, isIntersecting: true, intersectionRatio: 1 }])
  await app.flush()
  assert.equal(app.captures.length, 0)
  page.main.connected = false
  const detachedCleanup = app.collector.mountHomepageAnalytics(page.main)
  app.ready(); await app.flush()
  assert.equal(app.captures.length, 0)
  detachedCleanup()
  page.main.connected = true
  const liveCleanup = app.collector.mountHomepageAnalytics(page.main)
  app.intersect(app.observers.at(-1), page.headings.story)
  app.ready(); await app.flush()
  assert.deepEqual(app.captures.map(row => row.event), ['landing_page_viewed', 'homepage_story_section_viewed'])
  liveCleanup()
})
