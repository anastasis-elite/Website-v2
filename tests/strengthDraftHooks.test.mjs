import assert from 'node:assert/strict'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'

const { StrengthDraftSession } = await importTs('lib/assessments/strengthDraftSession.ts')
const historyGuards = await importTs('lib/assessments/strengthHistoryGuard.ts')
const { useStrengthDraftAutosave, useUnsavedAssessmentGuard } = await importTs('lib/assessments/useStrengthDraft.ts', {
  react: 'export const useEffect=(...args)=>globalThis.strengthDraftHooks.useEffect(...args)',
})
const period = '2026-10-01'
const savedAt = '2026-10-16T15:00:00.000Z'
const response = assessment => ({ success: true, period, currentPeriod: period, assessment })
const flush = () => new Promise(resolve => setImmediate(resolve))

function harness(session, earlyRouter = false) {
  const previous = { window: globalThis.window, document: globalThis.document, Element: globalThis.Element, strengthDraftHooks: globalThis.strengthDraftHooks }
  let now = 0, nextId = 0, cursor = 0, offline = false
  const slots = [], timers = new Map(), listeners = new Map(), confirmations = [], historyWrites = []
  let allowLeave = false
  const surface = name => ({
    addEventListener(type, callback, capture) { const key = `${name}:${type}`; if (!listeners.has(key)) listeners.set(key, new Set()); listeners.get(key).add(callback) },
    removeEventListener(type, callback) { listeners.get(`${name}:${type}`)?.delete(callback) },
  })
  globalThis.window = {
    ...surface('window'),
    location: { href: 'https://qa.invalid/dashboard/assessment/start2' },
    history: { state: { __NA: true, synthetic: 'router-state' }, pushState() { throw new Error('Next patched pushState must not restore canceled traversal') } },
    History: { prototype: { pushState(state, title, href) { historyWrites.push({ state, href }); window.location.href = href } } },
    confirm(message) { confirmations.push(message); return allowLeave },
    setTimeout(callback, delay) { const id = ++nextId; timers.set(id, { callback, at: now + delay }); return id },
    clearTimeout(id) { timers.delete(id) },
  }
  globalThis.document = surface('document')
  globalThis.Element = class { constructor(anchor) { this.anchor = anchor } closest() { return this.anchor } }
  const releaseEarlyGuard = earlyRouter ? historyGuards.acquireStrengthHistoryGuard() : null
  let routerNavigations = 0
  const routerListener = () => { routerNavigations++; unmount() }
  if (earlyRouter) window.addEventListener('popstate', routerListener)
  globalThis.strengthDraftHooks = {
    useEffect(callback, dependencies) {
      const index = cursor++, prior = slots[index]
      if (!prior || dependencies.some((value, i) => value !== prior.dependencies[i])) {
        prior?.cleanup?.()
        slots[index] = { dependencies, cleanup: callback() }
      }
    },
  }
  function render() { cursor = 0; useStrengthDraftAutosave(session, session.getSnapshot(), offline); useUnsavedAssessmentGuard(session) }
  const unsubscribe = session.subscribe(render)
  render()
  function advance(milliseconds) {
    const target = now + milliseconds
    for (;;) {
      const entry = [...timers].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0]
      if (!entry) break
      now = entry[1].at; timers.delete(entry[0]); entry[1].callback()
    }
    now = target
  }
  function emit(surfaceName, type, extra = {}) {
    const event = { button: 0, defaultPrevented: false, prevented: false, stopped: false,
      preventDefault() { this.defaultPrevented = true; this.prevented = true }, stopPropagation() { this.stopped = true }, stopImmediatePropagation() { this.stopped = true }, ...extra }
    for (const listener of listeners.get(`${surfaceName}:${type}`) || []) { listener(event); if (event.stopped) break }
    return event
  }
  function unmount() { unsubscribe(); for (const slot of slots) slot?.cleanup?.() }
  function restore() { unmount(); releaseEarlyGuard?.(); window.removeEventListener('popstate', routerListener); Object.assign(globalThis, previous) }
  return { advance, emit, restore, unmount, timers, confirmations, historyWrites,
    get routerNavigations() { return routerNavigations },
    get listenerCount() { return [...listeners.values()].reduce((count, set) => count + set.size, 0) },
    set offline(value) { offline = value; render() }, set allowLeave(value) { allowLeave = value },
    anchor(href, extra = {}) { return new Element({ href, getAttribute: () => href, ...extra }) },
  }
}

test('autosave debounces actual edits and saves the final partial value once, without browser storage', async t => {
  const writes = []
  const session = new StrengthDraftSession({ weight: '', plank_time: '' }, async (method, body) => {
    if (method === 'GET') return response(null)
    writes.push(body)
    return response({ status: 'draft', values: body.values, revision: 1, savedAt, completedAt: null, assessmentDate: null })
  })
  const ui = harness(session); t.after(ui.restore)
  await session.load()
  assert.equal(ui.timers.size, 0)
  session.change('weight', '1')
  ui.advance(600)
  session.change('weight', '15')
  ui.advance(600)
  session.change('weight', '150.')
  ui.advance(799)
  assert.equal(writes.length, 0)
  assert.equal(session.getSnapshot().savedAt, null)
  ui.advance(1)
  await flush()
  assert.equal(writes.length, 1)
  assert.equal(writes[0].values.weight, '150.')
  assert.equal(session.getSnapshot().savedAt, savedAt)
  assert.equal(ui.timers.size, 0)
})

test('offline edits stay in memory without retry loops; reconnect schedules their cloud save', async t => {
  let writes = 0
  const session = new StrengthDraftSession({ weight: '' }, async (method, body) => {
    if (method === 'GET') return response(null)
    writes++
    return response({ status: 'draft', values: body.values, revision: 1, savedAt, completedAt: null, assessmentDate: null })
  })
  const ui = harness(session); t.after(ui.restore)
  await session.load()
  ui.offline = true
  session.change('weight', '150.')
  ui.advance(60_000)
  assert.equal(writes, 0)
  assert.equal(session.getSnapshot().values.weight, '150.')
  assert.equal(session.getSnapshot().unsaved, true)
  ui.offline = false
  ui.advance(800)
  await flush()
  assert.equal(writes, 1)
  assert.equal(session.getSnapshot().unsaved, false)
})

test('unsaved close, refresh, link, and browser-history navigation all require a leave choice', async t => {
  const session = new StrengthDraftSession({ weight: '' }, async () => response(null))
  const ui = harness(session); t.after(ui.restore)
  await session.load()
  assert.equal(ui.emit('window', 'beforeunload').prevented, false)
  session.change('weight', '150.')
  const unload = ui.emit('window', 'beforeunload')
  assert.equal(unload.prevented, true)
  assert.equal(unload.returnValue, '')
  const link = ui.emit('document', 'click', { target: ui.anchor('https://qa.invalid/dashboard') })
  assert.equal(link.prevented, true)
  assert.equal(link.stopped, true)
  window.location.href = 'https://qa.invalid/dashboard'
  assert.equal(ui.emit('window', 'popstate').stopped, true)
  assert.equal(window.location.href, 'https://qa.invalid/dashboard/assessment/start2')
  assert.equal(ui.historyWrites[0].state.synthetic, 'router-state')
  assert.equal(session.getSnapshot().values.weight, '150.')
  assert.equal(ui.emit('window', 'anastasis:before-assessment-navigation').prevented, true, 'Logout can be canceled before ending the session')
  ui.allowLeave = true
  assert.equal(ui.emit('document', 'click', { target: ui.anchor('https://qa.invalid/dashboard') }).prevented, false)
  assert.equal(ui.emit('window', 'popstate').stopped, false)
  assert.equal(ui.emit('document', 'click', { target: ui.anchor('https://qa.invalid/dashboard'), ctrlKey: true }).prevented, false)
})

test('unmount cancels pending autosave and removes the exact navigation listeners', async t => {
  const session = new StrengthDraftSession({ weight: '' }, async () => response(null))
  const ui = harness(session); t.after(ui.restore)
  await session.load()
  session.change('weight', '150')
  assert.equal(ui.timers.size, 1)
  assert.equal(ui.listenerCount, 4)
  ui.unmount()
  assert.equal(ui.timers.size, 0)
  assert.equal(ui.listenerCount, 0)
})

test('dashboard guard blocks Back before an existing router listener can unmount the dirty form', async t => {
  const session = new StrengthDraftSession({ weight: '' }, async () => response(null))
  const ui = harness(session, true); t.after(ui.restore)
  await session.load(); session.change('weight', '150.')
  window.location.href = 'https://qa.invalid/dashboard'
  assert.equal(ui.emit('window', 'popstate').stopped, true)
  assert.equal(ui.routerNavigations, 0)
  assert.equal(window.location.href, 'https://qa.invalid/dashboard/assessment/start2')
  assert.equal(session.getSnapshot().values.weight, '150.')
})
