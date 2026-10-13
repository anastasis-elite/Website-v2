import assert from 'node:assert/strict'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'
const journey = await importTs('lib/analytics/todayJourney.ts', { '@/lib/analytics': 'export const trackEvent=(event,properties)=>globalThis.todayEvents.push({event,properties})' })
function setup() {
  const values = new Map()
  globalThis.todayEvents = []
  globalThis.window = { sessionStorage: { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) } }
}
test('returning from a saved workflow emits completion once and includes only fixed non-sensitive properties', () => {
  setup()
  journey.recordTodayActionOpened('LOCAL-QA-ONLY', '2026-10-13', 'food-input', 'ember')
  journey.recordTodayActionCompletions('LOCAL-QA-ONLY', '2026-10-13', ['nutrition'], null, 'ember')
  journey.recordTodayActionCompletions('LOCAL-QA-ONLY', '2026-10-13', ['nutrition'], [], 'ember')
  assert.deepEqual(globalThis.todayEvents, [ { event: 'next_action_opened', properties: { activity: 'nutrition', tier: 'ember' } }, { event: 'next_action_completed', properties: { activity: 'nutrition', tier: 'ember' } } ])
})
test('historical completion, another member, and a new local day do not inherit an opened workflow', () => {
  setup()
  journey.recordTodayActionCompletions('A', '2026-10-13', ['check-in'], null, 'ignite')
  assert.equal(globalThis.todayEvents.length, 0)
  journey.recordTodayActionOpened('A', '2026-10-13', 'check-in', 'ignite')
  journey.recordTodayActionCompletions('B', '2026-10-13', ['check-in'], null, 'ignite')
  journey.recordTodayActionCompletions('A', '2026-10-14', ['check-in'], null, 'ignite')
  assert.equal(globalThis.todayEvents.length, 1)
})
test('opening an already completed activity does not report historical work as a new completion', () => {
  setup()
  journey.recordTodayActionOpened('A', '2026-10-13', 'check-in', 'ignite', true)
  journey.recordTodayActionCompletions('A', '2026-10-13', ['check-in'], null, 'ignite')
  assert.deepEqual(globalThis.todayEvents, [{ event: 'next_action_opened', properties: { activity: 'check-in', tier: 'ignite' } }])
})
test('restricted storage permits the interaction and in-place completion event', () => {
  setup()
  Object.defineProperty(globalThis.window, 'sessionStorage', { get() { throw new Error('blocked') } })
  journey.recordTodayActionOpened('A', '2026-10-13', 'check-in', 'ignite')
  journey.recordTodayActionCompletions('A', '2026-10-13', ['check-in'], [], 'ignite')
  assert.equal(globalThis.todayEvents.length, 2)
})
