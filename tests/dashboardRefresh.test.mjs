import assert from 'node:assert/strict'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'

const reactMock = 'export const useEffect=(...args)=>globalThis.dashboardRefreshHooks.useEffect(...args); export const useRef=(...args)=>globalThis.dashboardRefreshHooks.useRef(...args); export const useCallback=fn=>fn; export const useState=initial=>[initial,()=>{}]'
const { useDailyScheduleRefresh } = await importTs('lib/schedule/client.ts', {
  react: reactMock,
  'next/navigation': 'export const useRouter=()=>globalThis.dashboardRefreshRouter',
})
const { CALENDAR_CHANGE_STORAGE_KEY } = await importTs('lib/calendar/client.ts', { react: reactMock })
const { default: DailyPlanRefresh } = await importTs('components/DailyPlanRefresh.tsx', {
  react: reactMock,
  'next/navigation': 'export const useRouter=()=>globalThis.dashboardRefreshRouter',
})
const NativeDate = Date

function harness(date, timezone = 'America/Chicago', events = [], enabled = true, refreshSurface = 'schedule') {
  let now = new NativeDate(date).getTime(), nextTimerId = 0, cursor = 0
  const slots = [], timers = new Map(), windowListeners = new Map(), documentListeners = new Map()
  const registrations = [], removals = [], refreshes = []
  let schedule = { date: new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new NativeDate(now)), timezone, events }
  const previous = { Date: globalThis.Date, window: globalThis.window, document: globalThis.document }
  globalThis.Date = class extends NativeDate { constructor(...args) { super(...(args.length ? args : [now])) } static now() { return now } }
  function surface(name, registry) {
    return {
      addEventListener(type, listener) { if (!registry.has(type)) registry.set(type, new Set()); registry.get(type).add(listener); registrations.push({ name, type, listener }) },
      removeEventListener(type, listener) { registry.get(type)?.delete(listener); removals.push({ name, type, listener }) },
    }
  }
  globalThis.window = { ...surface('window', windowListeners),
    setTimeout(fn, delay) { const id = ++nextTimerId; timers.set(id, { fn, at: now + delay }); return id },
    clearTimeout(id) { timers.delete(id) },
  }
  globalThis.document = { ...surface('document', documentListeners), visibilityState: 'visible' }
  globalThis.dashboardRefreshRouter = { refresh() { refreshes.push(now) } }
  globalThis.dashboardRefreshHooks = {
    useRef(initial) { const index = cursor++; return slots[index] ||= { current: initial } },
    useEffect(fn, dependencies) {
      const index = cursor++, previousEffect = slots[index]
      if (!previousEffect || dependencies.some((value, n) => value !== previousEffect.dependencies[n])) {
        previousEffect?.cleanup?.()
        slots[index] = { dependencies, cleanup: fn() }
      }
    },
  }
  function render(next = schedule, nextEnabled = enabled) {
    schedule = next; enabled = nextEnabled; cursor = 0
    if (refreshSurface === 'layout') DailyPlanRefresh({ timezone: schedule.timezone })
    else useDailyScheduleRefresh(schedule, enabled)
  }
  function emit(type, event = {}) {
    for (const listener of [...(windowListeners.get(type) || []), ...(documentListeners.get(type) || [])]) listener(event)
  }
  function advance(value) {
    const target = new NativeDate(value).getTime()
    for (;;) {
      const entry = [...timers].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0]
      if (!entry) break
      now = entry[1].at; timers.delete(entry[0]); entry[1].fn()
    }
    now = target
  }
  function unmount() { for (const slot of slots) { slot?.cleanup?.(); if (slot) slot.cleanup = undefined } }
  function restore() { unmount(); Object.assign(globalThis, previous) }
  render()
  return { render, emit, advance, unmount, restore, refreshes, timers, registrations, removals, get schedule() { return schedule }, set visible(value) { document.visibilityState = value ? 'visible' : 'hidden' }, get listeners() { return [...windowListeners.values(), ...documentListeners.values()].reduce((count, values) => count + values.size, 0) } }
}

test('idle greeting refreshes at member-local noon and 17:00 without per-minute requests', t => {
  const app = harness('2026-10-12T16:59:00Z'); t.after(app.restore)
  app.advance('2026-10-12T16:59:59.999Z'); assert.equal(app.refreshes.length, 0)
  app.advance('2026-10-12T17:00:00.100Z'); assert.equal(app.refreshes.length, 1)
  app.render()
  app.advance('2026-10-12T21:59:59.999Z'); assert.equal(app.refreshes.length, 1)
  app.advance('2026-10-12T22:00:00.100Z'); assert.equal(app.refreshes.length, 2)
})

test('morning guidance and local midnight are explicit refresh boundaries', t => {
  const morning = harness('2026-10-12T15:59:00Z')
  morning.advance('2026-10-12T16:00:00.100Z'); assert.equal(morning.refreshes.length, 1)
  morning.restore()
  const midnight = harness('2026-10-13T04:59:00Z'); t.after(midnight.restore)
  midnight.advance('2026-10-13T05:00:00.100Z'); assert.equal(midnight.refreshes.length, 1)
  midnight.render(); assert.equal(midnight.refreshes.length, 1, 'The just-requested midnight refresh also covers a stale snapshot')
  midnight.render(); assert.equal(midnight.refreshes.length, 1)
})

test('midnight timers follow the member timezone through both daylight-saving boundaries', t => {
  const fall = harness('2026-11-02T05:59:00Z')
  fall.advance('2026-11-02T05:59:59.999Z'); assert.equal(fall.refreshes.length, 0)
  fall.advance('2026-11-02T06:00:00.100Z'); assert.equal(fall.refreshes.length, 1)
  fall.restore()
  const spring = harness('2027-03-15T04:59:00Z'); t.after(spring.restore)
  spring.advance('2027-03-15T04:59:59.999Z'); assert.equal(spring.refreshes.length, 0)
  spring.advance('2027-03-15T05:00:00.100Z'); assert.equal(spring.refreshes.length, 1)
})

test('schedule timer follows adjusted event starts and ends and ignores completed events', t => {
  const app = harness('2026-10-12T15:00:00Z', 'America/Chicago', [
    { id: 'moved', start_at: '2026-10-12T15:30:00Z', end_at: '2026-10-12T15:45:00Z', adjusted_start_at: '2026-10-12T15:40:00Z', adjusted_end_at: '2026-10-12T15:55:00Z', status: 'scheduled' },
    { id: 'done', start_at: '2026-10-12T15:10:00Z', end_at: '2026-10-12T15:20:00Z', status: 'completed' },
  ]); t.after(app.restore)
  app.advance('2026-10-12T15:39:59.999Z'); assert.equal(app.refreshes.length, 0)
  app.advance('2026-10-12T15:40:00.100Z'); assert.equal(app.refreshes.length, 1)
  app.render(); app.advance('2026-10-12T15:55:00.100Z'); assert.equal(app.refreshes.length, 2)
})

test('hidden boundary waits for visibility restore and listener mutations refresh only visible views', t => {
  const app = harness('2026-10-12T16:59:00Z'); t.after(app.restore)
  app.visible = false; app.advance('2026-10-12T17:00:00.100Z'); assert.equal(app.refreshes.length, 0)
  app.emit('focus'); app.emit('calendar-events-updated'); app.emit('storage', { key: CALENDAR_CHANGE_STORAGE_KEY }); assert.equal(app.refreshes.length, 0)
  app.visible = true; app.emit('visibilitychange'); assert.equal(app.refreshes.length, 1)
  app.emit('focus'); app.emit('calendar-events-updated'); app.emit('storage', { key: 'unrelated-storage' }); assert.equal(app.refreshes.length, 2, 'Resume focus is coalesced; a confirmed calendar change still refreshes')
  app.emit('storage', { key: CALENDAR_CHANGE_STORAGE_KEY }); assert.equal(app.refreshes.length, 3)
})

test('rerender leaves exactly one timer and listener per event, and cleanup removes their original callbacks', t => {
  const app = harness('2026-10-12T16:59:00Z'); t.after(app.restore)
  assert.equal(app.listeners, 4); assert.equal(app.timers.size, 1)
  app.render(); assert.equal(app.registrations.length, 4)
  app.render({ ...app.schedule, events: [{ start_at: '2026-10-12T16:59:30Z', end_at: '2026-10-12T16:59:40Z' }] })
  assert.equal(app.listeners, 4); assert.equal(app.timers.size, 1)
  app.unmount(); assert.equal(app.listeners, 0); assert.equal(app.timers.size, 0)
  assert.equal(app.removals.length, app.registrations.length)
  for (const added of app.registrations) assert.equal(app.removals.filter(removed => removed.name === added.name && removed.type === added.type && removed.listener === added.listener).length, 1)
})

test('timezone prop changes replace the old timer with the new local greeting boundary', t => {
  const app = harness('2026-10-12T16:59:00Z'); t.after(app.restore)
  app.render({ ...app.schedule, timezone: 'America/New_York' })
  app.advance('2026-10-12T17:00:00.100Z'); assert.equal(app.refreshes.length, 0, 'Chicago noon timer must be cancelled')
  app.advance('2026-10-12T21:00:00.100Z'); assert.equal(app.refreshes.length, 1, 'New York 17:00 boundary must replace it')
})

test('disabled embedded schedule hook does not duplicate parent listeners or refresh timers', t => {
  const app = harness('2026-10-12T16:59:00Z', 'America/Chicago', [], false); t.after(app.restore)
  assert.equal(app.listeners, 0); assert.equal(app.timers.size, 0)
  app.emit('focus'); assert.equal(app.refreshes.length, 0)
  app.render(app.schedule, true); assert.equal(app.listeners, 4); assert.equal(app.timers.size, 1)
  app.render(app.schedule, false); assert.equal(app.listeners, 0); assert.equal(app.timers.size, 0)
})

test('every dashboard page refreshes at local midnight even immediately after a previous-day save', t => {
  const app = harness('2026-10-14T04:58:00Z', 'America/Chicago', [], true, 'layout'); t.after(app.restore)
  app.advance('2026-10-14T04:59:59.900Z'); assert.equal(app.refreshes.length, 0, 'There is no per-minute polling')
  app.emit('anastasis:daily-plan-updated'); assert.equal(app.refreshes.length, 1)
  app.advance('2026-10-14T05:00:00.100Z'); assert.equal(app.refreshes.length, 2, 'The new local date cannot be suppressed by the old-day save refresh')
  app.advance('2026-10-15T05:00:00.100Z'); assert.equal(app.refreshes.length, 3, 'A persistent layout schedules the following midnight')
  assert.equal(app.timers.size, 1)
  app.unmount(); assert.equal(app.timers.size, 0)
})

test('universal midnight scheduling follows the 25-hour fall and 23-hour spring local days', t => {
  const fall = harness('2026-11-01T04:59:00Z', 'America/Chicago', [], true, 'layout')
  fall.advance('2026-11-01T05:00:00.100Z'); assert.equal(fall.refreshes.length, 1)
  fall.advance('2026-11-02T05:00:00.100Z'); assert.equal(fall.refreshes.length, 1)
  fall.advance('2026-11-02T06:00:00.100Z'); assert.equal(fall.refreshes.length, 2)
  fall.restore()
  const spring = harness('2027-03-14T05:59:00Z', 'America/Chicago', [], true, 'layout'); t.after(spring.restore)
  spring.advance('2027-03-14T06:00:00.100Z'); assert.equal(spring.refreshes.length, 1)
  spring.advance('2027-03-15T05:00:00.100Z'); assert.equal(spring.refreshes.length, 2)
})

test('a background dashboard keeps its next midnight timer and refreshes on visible resume', t => {
  const app = harness('2026-10-14T04:59:00Z', 'America/Chicago', [], true, 'layout'); t.after(app.restore)
  app.visible = false
  app.advance('2026-10-14T05:00:00.100Z'); assert.equal(app.refreshes.length, 0)
  assert.equal(app.timers.size, 1)
  app.visible = true
  app.emit('visibilitychange'); assert.equal(app.refreshes.length, 1)
})
