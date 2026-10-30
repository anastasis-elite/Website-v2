import assert from 'node:assert/strict'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'

const { mountHomepageAnalytics } = await importTs('lib/analytics/homepageStorytelling.ts', {
  '@/lib/analytics': 'export const trackEvent = (event, properties) => globalThis.homepageEvents.push({ event, properties })',
})

class FakeElement {
  constructor(options = {}) { Object.assign(this, options) }
  closest(selector) {
    if (selector === 'a[href]') return this.href ? this : this.link || null
    if (selector === '[data-homepage-audit-cta]') return this.auditWrapper || null
    if (selector === 'header, nav') return this.navigation || null
    if (selector === 'section') return this.section || null
    return null
  }
  querySelector(selector) { return selector === 'h2' ? this.heading || null : null }
}

function setup(consent = 'accepted') {
  const values = new Map(consent ? [['cookie_consent', consent]] : [])
  const documentListeners = new Map()
  const windowListeners = new Map()
  const observers = []
  globalThis.homepageEvents = []
  globalThis.Element = FakeElement
  const add = (listeners, name, callback) => {
    const callbacks = listeners.get(name) || new Set()
    callbacks.add(callback)
    listeners.set(name, callbacks)
  }
  globalThis.document = {
    addEventListener: (name, callback) => add(documentListeners, name, callback),
    removeEventListener: (name, callback) => documentListeners.get(name)?.delete(callback),
  }
  globalThis.window = {
    localStorage: { getItem: key => values.get(key) || null },
    location: { origin: 'https://anastasiselite.com' },
    addEventListener: (name, callback) => add(windowListeners, name, callback),
    removeEventListener: (name, callback) => windowListeners.get(name)?.delete(callback),
  }
  globalThis.IntersectionObserver = class {
    constructor(callback, options) { this.callback = callback; this.options = options; this.observed = new Set(); observers.push(this) }
    observe(element) { this.observed.add(element) }
    unobserve(element) { this.observed.delete(element) }
    disconnect() { this.observed.clear() }
  }
  const headings = Object.fromEntries(['story', 'founder', 'community'].map(id => [id, new FakeElement({ id: `${id}-title` })]))
  const sections = Object.fromEntries(['story', 'founder', 'community'].map(id => [id, new FakeElement({ id, heading: headings[id] })]))
  const contentLinks = new Set()
  const root = {
    querySelector: selector => sections[selector.slice(1)] || null,
    contains: link => contentLinks.has(link),
  }
  const dispatchClick = target => {
    const event = { target }
    for (const callback of documentListeners.get('click') || []) callback(event)
    return event
  }
  const expose = (id, ratio = 0.5, observer = observers.at(-1)) => observer.callback([{
    target: headings[id], isIntersecting: ratio > 0, intersectionRatio: ratio,
  }])
  return { values, root, sections, headings, observers, contentLinks, documentListeners, windowListeners, dispatchClick, expose }
}

const properties = {
  page: 'landing',
  experiment_id: 'homepage_storytelling_v1',
  homepage_version: 'storytelling_v1',
}

test('view and section exposure wait for accepted consent, including same-tab CookieBanner acceptance', async () => {
  const env = setup(null)
  const dispose = mountHomepageAnalytics(env.root)
  env.expose('story')
  assert.deepEqual(globalThis.homepageEvents, [])
  env.values.set('cookie_consent', 'accepted')
  env.dispatchClick(new FakeElement())
  await Promise.resolve()
  assert.deepEqual(globalThis.homepageEvents, [
    { event: 'landing_page_viewed', properties },
    { event: 'homepage_story_section_viewed', properties },
  ])
  dispose()
})

test('StrictMode effect replay and repeated section intersections produce one event per actual homepage visit', () => {
  const env = setup()
  const firstDispose = mountHomepageAnalytics(env.root)
  env.expose('story', 0.19)
  assert.deepEqual(globalThis.homepageEvents.map(item => item.event), ['landing_page_viewed'])
  env.expose('story', 0.2)
  firstDispose()
  const secondDispose = mountHomepageAnalytics(env.root)
  env.expose('story')
  env.expose('founder')
  env.expose('founder', 0)
  env.expose('founder')
  env.expose('community')
  assert.deepEqual(globalThis.homepageEvents.map(item => item.event), [
    'landing_page_viewed', 'homepage_story_section_viewed', 'homepage_founder_section_viewed', 'homepage_community_section_viewed',
  ])
  assert.equal(env.observers[0].observed.size, 0)
  secondDispose()
  const returnDispose = mountHomepageAnalytics({ ...env.root })
  assert.equal(globalThis.homepageEvents.filter(item => item.event === 'landing_page_viewed').length, 2)
  returnDispose()
})

test('section visibility observes each heading so a tall section remains measurable in a short viewport', () => {
  const env = setup()
  const dispose = mountHomepageAnalytics(env.root)
  assert.deepEqual([...env.observers[0].observed], Object.values(env.headings))
  assert.ok(Object.values(env.sections).every(section => !env.observers[0].observed.has(section)))
  env.expose('founder', 0.2)
  assert.equal(globalThis.homepageEvents.at(-1).event, 'homepage_founder_section_viewed')
  dispose()
})

test('audit clicks retain their existing event names and locations without a duplicate primary CTA event', () => {
  const env = setup()
  const dispose = mountHomepageAnalytics(env.root)
  for (const [index, location] of ['hero', 'outcome', 'final_cta'].entries()) {
    const link = new FakeElement({ href: 'https://anastasiselite.com/audit', auditWrapper: { dataset: { homepageAuditCta: location } } })
    const click = env.dispatchClick(link)
    // A duplicate observer/listener receiving the same browser event must not count twice.
    for (const callback of env.documentListeners.get('click')) callback(click)
    assert.deepEqual(globalThis.homepageEvents.at(-1), {
      event: `audit_cta_clicked_${index + 1}`,
      properties: { ...properties, location, cta_location: location },
    })
  }
  assert.equal(globalThis.homepageEvents.length, 4)
  dispose()
})

test('program clicks include homepage content, header and footer and capture only fixed marketing properties', () => {
  const env = setup()
  const dispose = mountHomepageAnalytics(env.root)
  const content = new FakeElement({ href: 'https://anastasiselite.com/program/ember?email=private@example.com' })
  env.contentLinks.add(content)
  env.dispatchClick(content)
  env.dispatchClick(new FakeElement({ href: 'https://anastasiselite.com/program', navigation: new FakeElement() }))
  env.dispatchClick(new FakeElement({ href: 'https://anastasiselite.com/program/phoenix' }))
  env.dispatchClick(new FakeElement({ href: 'https://external.example/program/ignite' }))
  env.dispatchClick(new FakeElement({ href: 'https://anastasiselite.com/program/unsupported' }))
  assert.deepEqual(globalThis.homepageEvents.slice(1), [
    { event: 'homepage_program_cta_clicked', properties: { ...properties, program: 'ember', location: 'programs', cta_location: 'programs' } },
    { event: 'homepage_program_cta_clicked', properties: { ...properties, program: 'all', location: 'navigation', cta_location: 'navigation' } },
    { event: 'homepage_program_cta_clicked', properties: { ...properties, program: 'phoenix', location: 'footer', cta_location: 'footer' } },
  ])
  assert.ok(globalThis.homepageEvents.every(item => !JSON.stringify(item).includes('private@example.com')))
  dispose()
})

test('program CTA locations distinguish feature and closing sections using an explicit allowlist', () => {
  const env = setup()
  const dispose = mountHomepageAnalytics(env.root)
  for (const id of ['seen', 'start', 'arbitrary-private-section', 'toString']) {
    const link = new FakeElement({ href: 'https://anastasiselite.com/program', section: new FakeElement({ id }) })
    env.contentLinks.add(link)
    env.dispatchClick(link)
  }
  assert.deepEqual(globalThis.homepageEvents.slice(1).map(item => item.properties.cta_location), ['features', 'final_cta', 'programs', 'programs'])
  assert.ok(globalThis.homepageEvents.every(item => !JSON.stringify(item).includes('arbitrary-private-section')))
  dispose()
})

test('declined or inaccessible consent fails closed and cleanup disconnects every listener and observer', () => {
  const env = setup('declined')
  const dispose = mountHomepageAnalytics(env.root)
  env.expose('community')
  env.dispatchClick(new FakeElement({ href: 'https://anastasiselite.com/program' }))
  assert.deepEqual(globalThis.homepageEvents, [])
  Object.defineProperty(globalThis.window, 'localStorage', { get() { throw new Error('storage unavailable') } })
  env.expose('story')
  assert.deepEqual(globalThis.homepageEvents, [])
  dispose()
  assert.equal(env.documentListeners.get('click').size, 0)
  assert.equal(env.windowListeners.get('storage').size, 0)
  assert.equal(env.observers[0].observed.size, 0)
})

test('a consent change in another tab releases only the currently visible sections', () => {
  const env = setup(null)
  const dispose = mountHomepageAnalytics(env.root)
  env.expose('story')
  env.expose('story', 0)
  env.expose('founder')
  env.values.set('cookie_consent', 'accepted')
  for (const callback of env.windowListeners.get('storage')) callback({ key: 'cookie_consent' })
  assert.deepEqual(globalThis.homepageEvents.map(item => item.event), ['landing_page_viewed', 'homepage_founder_section_viewed'])
  dispose()
})
