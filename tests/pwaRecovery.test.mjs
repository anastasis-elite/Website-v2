import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const origin = 'https://disposable.anastasis.test'
const workerSource = readFileSync('public/sw.js', 'utf8')
const offlinePage = readFileSync('public/offline.html', 'utf8')
const asset = (body, type = 'application/javascript') => new Response(body, { headers: { 'content-type': type } })

// Execute the deployed worker policy against disposable browser caches and requests.
function workerHarness() {
  const listeners = new Map(), stores = new Map(), writes = []
  let skipCount = 0, network = async request => {
    const url = typeof request === 'string' ? request : request.url
    return url.endsWith('/offline.html') ? asset(offlinePage, 'text/html') : asset('icon', 'image/png')
  }
  const key = request => new URL(typeof request === 'string' ? request : request.url, origin).href
  const storage = name => {
    if (!stores.has(name)) stores.set(name, new Map())
    return stores.get(name)
  }
  const caches = {
    async open(name) { return {
      async addAll(urls) { for (const url of urls) { storage(name).set(key(url), await network(key(url))); writes.push({ name, url: key(url) }) } },
      async put(request, response) { storage(name).set(key(request), response); writes.push({ name, url: key(request) }) },
    } },
    async match(request, options) { return stores.get(options.cacheName)?.get(key(request))?.clone() },
    async keys() { return [...stores.keys()] },
    async delete() { throw new Error('Worker must not delete origin caches') },
  }
  const self = {
    location: { origin },
    addEventListener(type, callback) { listeners.set(type, callback) },
    async skipWaiting() { skipCount++ },
    clients: { claim() { throw new Error('Worker must not take over open screens automatically') } },
  }
  vm.runInNewContext(workerSource, { self, caches, URL, Response, fetch: request => network(request) })
  async function emit(type, data = {}) {
    const tasks = []; let handled = false, result
    const event = { ...data, waitUntil(task) { tasks.push(task) }, respondWith(task) { handled = true; result = task } }
    listeners.get(type)?.(event)
    const response = result ? await result : undefined
    await Promise.all(tasks)
    return { response, handled }
  }
  const request = (pathname, destination = '', options = {}) => ({ url: new URL(pathname, origin).href, method: 'GET', mode: 'cors', destination, ...options })
  return { emit, request, stores, writes, storage, set network(value) { network = value }, get skipCount() { return skipCount } }
}

test('PWA install waits for consent and preserves previous assets, offline queues, and unrelated caches', async () => {
  const sw = workerHarness()
  sw.storage('anastasis-shell-v1').set(`${origin}/_next/static/old.js`, asset('old chunk'))
  sw.storage('member-activity-queue').set('unsynced', asset('draft'))
  sw.storage('other-app-cache').set('other', asset('other'))
  await sw.emit('install'); await sw.emit('activate')
  assert.equal(sw.skipCount, 0)
  assert.equal(sw.stores.get('member-activity-queue').get('unsynced') !== undefined, true)
  assert.equal(sw.stores.get('other-app-cache').get('other') !== undefined, true)
  assert.equal(sw.stores.get('anastasis-shell-v1').size, 1)
  assert.equal(sw.writes.some(write => write.url === `${origin}/`), false)
  await sw.emit('message', { data: { type: 'UNRELATED' } }); assert.equal(sw.skipCount, 0)
  await sw.emit('message', { data: { type: 'ACTIVATE_UPDATE' } }); assert.equal(sw.skipCount, 1)
})

test('dashboard navigation always uses current HTML, with a static offline page only for connection failure', async () => {
  const sw = workerHarness(); await sw.emit('install')
  const request = sw.request('/dashboard/program/ignite', 'document', { mode: 'navigate' })
  sw.network = async () => asset('current deployment', 'text/html')
  assert.equal(await (await sw.emit('fetch', { request })).response.text(), 'current deployment')
  assert.equal(sw.writes.some(write => write.url.includes('/dashboard')), false)
  sw.network = async () => new Response('server unavailable', { status: 503 })
  assert.equal((await sw.emit('fetch', { request })).response.status, 503)
  sw.network = async () => { throw new Error('offline') }
  const result = await sw.emit('fetch', { request })
  assert.match(await result.response.text(), /Reconnect to load your dashboard/)
  assert.equal(sw.stores.get('anastasis-static-v2').has(request.url), false)
})

test('immutable assets recover exact old chunks after a deploy and never return cached HTML as JS', async () => {
  const sw = workerHarness(); await sw.emit('install')
  const old = sw.request('/_next/static/chunks/old-hash.js?dpl=old', 'script')
  sw.network = async () => asset('old deployment chunk')
  await sw.emit('fetch', { request: old })
  sw.network = async () => new Response('missing', { status: 404 })
  assert.equal(await (await sw.emit('fetch', { request: old })).response.text(), 'old deployment chunk')
  const next = sw.request('/_next/static/chunks/old-hash.js?dpl=new', 'script')
  assert.equal((await sw.emit('fetch', { request: next })).response.status, 404, 'deployment query remains part of cache identity')
  sw.storage('anastasis-shell-v1').set(next.url, asset('<html>old home</html>', 'text/html'))
  sw.network = async () => { throw new Error('offline') }
  assert.equal((await sw.emit('fetch', { request: next })).response.type, 'error')
  const legacy = sw.request('/_next/static/chunks/legacy-hash.js', 'script')
  sw.storage('anastasis-shell-v1').set(legacy.url, asset('retained legacy chunk'))
  assert.equal(await (await sw.emit('fetch', { request: legacy })).response.text(), 'retained legacy chunk')
})

test('repeat production chunk requests use exact cached assets without a network round trip', async () => {
  const sw = workerHarness(); await sw.emit('install')
  let requests = 0
  const old = sw.request('/_next/static/chunks/app/page-a1b2c3d4.js?dpl=old', 'script')
  sw.network = async () => { requests++; return asset('content addressed chunk') }
  assert.equal(await (await sw.emit('fetch', { request: old })).response.text(), 'content addressed chunk')
  assert.equal(await (await sw.emit('fetch', { request: old })).response.text(), 'content addressed chunk')
  assert.equal(requests, 1)
  await sw.emit('fetch', { request: sw.request('/_next/static/chunks/app/page-a1b2c3d4.js?dpl=new', 'script') })
  assert.equal(requests, 2, 'new deployment identity requires its own verified response')
  await sw.emit('fetch', { request: sw.request('/_next/static/chunks/app/page.js', 'script') })
  await sw.emit('fetch', { request: sw.request('/_next/static/chunks/app/page.js', 'script') })
  assert.equal(requests, 4, 'stable development filenames are never treated as immutable')
})

test('wrong asset MIME types and unavailable CSS never fall back to home HTML', async () => {
  const sw = workerHarness(); await sw.emit('install')
  const request = sw.request('/_next/static/chunks/new.js', 'script')
  sw.network = async () => asset('<html>deployment error</html>', 'text/html')
  assert.equal((await sw.emit('fetch', { request })).response.type, 'error')
  assert.equal(sw.stores.get('anastasis-static-v2').has(request.url), false)
  sw.network = async () => { throw new Error('offline') }
  assert.equal((await sw.emit('fetch', { request: sw.request('/_next/static/css/new.css', 'style') })).response.type, 'error')
})

test('cache quota failure does not turn a successfully fetched asset into an outage', async () => {
  const sw = workerHarness(); await sw.emit('install')
  sw.network = async () => asset('current chunk')
  const store = sw.storage('anastasis-static-v2')
  store.set = () => { throw new Error('Quota exceeded') }
  const result = await sw.emit('fetch', { request: sw.request('/_next/static/chunks/current.js', 'script') })
  assert.equal(await result.response.text(), 'current chunk')
})

test('API writes, auth data, RSC, and cross-origin requests bypass the SW cache', async () => {
  const sw = workerHarness(); await sw.emit('install')
  sw.network = async () => { throw new Error('must bypass') }
  const requests = [
    sw.request('/api/daily-check-in', '', { method: 'POST' }),
    sw.request('/api/nutrition/add-water'), sw.request('/dashboard?_rsc=release'),
    sw.request('/dashboard/program/phoenix'), sw.request('/auth/callback'),
    sw.request('/private-image', 'image'), sw.request('/sw.js', 'script'),
    sw.request('/_next/static/external.js', 'script', { url: 'https://other.test/external.js' }),
  ]
  for (const request of requests) assert.equal((await sw.emit('fetch', { request })).handled, false)
})

const dataUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
const { outputText } = ts.transpileModule(readFileSync('components/PwaRegistration.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ES2020, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
})
const PwaRegistration = (await import(dataUrl(outputText.replace(/from ['"]([^'"]+)['"]/g, (match, specifier) => {
  const source = specifier === 'react'
    ? 'export const useState=(...args)=>globalThis.pwaHooks.useState(...args); export const useEffect=(...args)=>globalThis.pwaHooks.useEffect(...args); export const useRef=(...args)=>globalThis.pwaHooks.useRef(...args)'
    : 'export const jsx=(type,props)=>({type,props}); export const jsxs=jsx'
  return `from '${dataUrl(source)}'`
})))).default

function registrationHarness({ secure = true, waiting = true } = {}) {
  let cursor = 0, tree, cleanup, reloads = 0, updates = 0, now = 100_000
  const slots = [], messages = [], registrations = [], surfaces = []
  const eventSurface = () => {
    const listeners = new Map(); surfaces.push(listeners)
    return {
      addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn) },
      removeEventListener(type, fn) { listeners.get(type)?.delete(fn) },
      emit(type) { for (const fn of listeners.get(type) || []) fn() },
    }
  }
  const pendingWorker = { ...eventSurface(), postMessage(value) { messages.push(value) } }
  const registration = { ...eventSurface(), waiting: waiting ? pendingWorker : null, installing: pendingWorker,
    update: async () => { updates++ },
  }
  const serviceWorker = { ...eventSurface(), controller: {}, register: async (...args) => { registrations.push(args); return registration } }
  const originals = Object.fromEntries(['window', 'document', 'navigator', 'pwaHooks', 'Date'].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]))
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true, serviceWorker } })
  globalThis.window = { ...eventSurface(), isSecureContext: secure, location: { reload() { reloads++ } } }
  globalThis.document = { ...eventSurface(), visibilityState: 'visible' }
  globalThis.Date = class extends Date { static now() { return now } }
  globalThis.pwaHooks = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = value }] },
    useRef(initial) { return slots[cursor++] ||= { current: initial } },
    useEffect(fn) { const i = cursor++; if (!(i in slots)) { slots[i] = true; cleanup = fn() } },
  }
  const render = () => { cursor = 0; tree = PwaRegistration(); return tree }
  const flush = async () => { await new Promise(setImmediate); return render() }
  render()
  return { render, flush, serviceWorker, registration, messages, registrations,
    button(label) { return tree?.props.children.find(child => child.type === 'button' && child.props.children === label) },
    advance(ms) { now += ms },
    get reloads() { return reloads }, get updates() { return updates }, get tree() { return tree },
    get listenerCount() { return surfaces.reduce((count, surface) => count + [...surface.values()].reduce((sum, values) => sum + values.size, 0), 0) },
    unmount() { cleanup?.(); cleanup = null },
    restore() { cleanup?.(); for (const [name, descriptor] of Object.entries(originals)) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name] } },
  }
}

test('PWA checks updates uncached but only reloads after the member explicitly applies a waiting update', async t => {
  const app = registrationHarness(); t.after(app.restore); await app.flush()
  assert.deepEqual(app.registrations, [['/sw.js', { updateViaCache: 'none' }]])
  assert.equal(app.updates, 1); assert.equal(app.messages.length, 0); assert.equal(app.reloads, 0)
  assert.ok(app.button('Apply update'))
  app.serviceWorker.emit('controllerchange'); app.render(); assert.equal(app.reloads, 0)
  app.registration.emit('updatefound'); app.render()
  app.button('Apply update').props.onClick()
  assert.deepEqual(app.messages, [{ type: 'ACTIVATE_UPDATE' }]); assert.equal(app.reloads, 0)
  app.serviceWorker.emit('controllerchange'); assert.equal(app.reloads, 1)
  app.serviceWorker.emit('controllerchange'); assert.equal(app.reloads, 1)
  app.unmount(); assert.equal(app.listenerCount, 0)
})

test('update checks follow visibility and reconnect with throttling; postponing leaves the current screen intact', async t => {
  const app = registrationHarness(); t.after(app.restore); await app.flush()
  app.button('Later').props.onClick(); app.render(); assert.equal(app.tree, null)
  app.advance(60_001); document.visibilityState = 'hidden'; document.emit('visibilitychange'); assert.equal(app.updates, 1)
  document.visibilityState = 'visible'; document.emit('visibilitychange'); assert.equal(app.updates, 2)
  window.emit('online'); assert.equal(app.updates, 2)
  app.advance(60_001); navigator.onLine = false; window.emit('online'); assert.equal(app.updates, 2)
  navigator.onLine = true; window.emit('online'); assert.equal(app.updates, 3)
  assert.equal(app.messages.length, 0); assert.equal(app.reloads, 0)
})

test('insecure origins do not register a PWA worker', async t => {
  const app = registrationHarness({ secure: false }); t.after(app.restore); await app.flush()
  assert.equal(app.registrations.length, 0); assert.equal(app.listenerCount, 0)
})

test('release identity is forwarded to Next and the worker script cannot be served from an HTTP cache', async () => {
  const require = createRequire(import.meta.url)
  const filename = require.resolve('../next.config.js')
  const previous = process.env.VERCEL_DEPLOYMENT_ID
  try {
    process.env.VERCEL_DEPLOYMENT_ID = 'disposable-release'
    delete require.cache[filename]
    const config = require(filename)
    assert.equal(config.deploymentId, process.env.NEXT_DEPLOYMENT_ID || 'disposable-release')
    const headers = await config.headers()
    assert.match(headers.find(rule => rule.source === '/sw.js').headers.find(header => header.key === 'Cache-Control').value, /no-store/)
  } finally {
    if (previous === undefined) delete process.env.VERCEL_DEPLOYMENT_ID
    else process.env.VERCEL_DEPLOYMENT_ID = previous
    delete require.cache[filename]
  }
})
