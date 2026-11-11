import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { importTs } from './typescriptModule.mjs'

const timezone = await importTs('lib/timezone.ts')
const scheduleTime = await importTs('lib/schedule/time.ts')
const nativeRequire = createRequire(import.meta.url)
const source = readFileSync('components/recovery/RecoverySuggestionCard.tsx', 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
const nodes = (tree, predicate) => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(child => nodes(child, predicate)) : [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)]
const text = tree => typeof tree === 'string' ? tree : Array.isArray(tree) ? tree.map(text).join(' ') : tree && typeof tree === 'object' ? text(tree.props?.children) : ''
function harness(now = '2026-11-11T20:00:00Z') {
  const state = [], effects = [], timers = new Map(), listeners = new Map()
  let cursor = 0, instant = Date.parse(now), timerId = 0
  const Clock = class extends Date { constructor(...args) { super(...(args.length ? args : [instant])) } static now() { return instant } }
  const react = { useId: () => 'suggestion-title', useState(initial) { const slot = cursor++; if (!(slot in state)) state[slot] = initial;return [state[slot], value => { state[slot] = value }] }, useEffect(effect) { effects.push(effect) } }
  const events = { addEventListener(name, listener) { listeners.set(name, listener) }, removeEventListener(name) { listeners.delete(name) } }
  const module = { exports: {} }
  runInNewContext(compiled, { module, exports: module.exports, Date: Clock, window: { ...events, setTimeout(callback, delay) { const id = ++timerId;timers.set(id, { callback, delay });return id }, clearTimeout(id) { timers.delete(id) } }, document: events,
    fetch() { assert.fail('Reading or dismissing must not save or complete anything.') }, localStorage: { setItem() { assert.fail('No persisted dismissal.') } },
    require: name => ({ react, '@/lib/timezone': timezone, '@/lib/schedule/time': scheduleTime, './RecoverySuggestionCard.module.css': {} }[name] || nativeRequire(name)),
  })
  return { render(props) { cursor = 0;return module.exports.default(props) }, runEffects() { return effects.splice(0).map(effect => effect()) }, timers, listeners, advance(next) { instant = Date.parse(next) } }
}
const props = () => ({ clientId: 'C', date: '2026-11-11', timezone: 'America/Chicago', suggestion: { version: 1, clientId: 'C', date: '2026-11-11', timezone: 'America/Chicago', kind: 'reward', id: 'high-stress', title: 'Let the day soften.', description: 'Settle into a comfortable spot with a podcast you enjoy.' } })

test('reward reading and local dismiss preserve completion and reset for a new owner, day or suggestion', () => {
  const h = harness(), input = props(), before = structuredClone(input), tree = h.render(input)
  assert.match(text(tree), /Optional/)
  assert.equal(nodes(tree, node => node.type === 'a').length, 0)
  const dismiss = nodes(tree, node => node.type === 'button')
  assert.equal(dismiss.length, 1)
  dismiss[0].props.onClick()
  assert.equal(h.render(input), null)
  assert.deepEqual(input, before)
  const next = { ...input, suggestion: { ...input.suggestion, id: 'after-workout' } }
  assert.ok(h.render(next))
  const other = { ...input, clientId: 'OTHER', suggestion: { ...input.suggestion, clientId: 'OTHER' } }
  assert.ok(h.render(other))
  h.advance('2026-11-12T20:00:00Z')
  const tomorrow = { ...input, date: '2026-11-12', suggestion: { ...input.suggestion, date: '2026-11-12' } }
  assert.ok(h.render(tomorrow))
})

test('safety copy has no dismissal or reward language and always replaces a dismissed reward', () => {
  const h = harness(), input = props()
  nodes(h.render(input), node => node.type === 'button')[0].props.onClick()
  input.suggestion = { ...input.suggestion, kind: 'safety', title: 'Your safety comes first.', description: 'Follow your existing care guidance.' }
  const tree = h.render(input)
  assert.match(text(tree), /Your safety comes first/)
  assert.doesNotMatch(text(tree), /Optional|Maybe another time/)
  assert.equal(nodes(tree, node => node.type === 'button').length, 0)
})

test('foreign, stale, wrong-timezone and invalid suggestions remain hidden', () => {
  for (const change of [{ clientId: 'OTHER' }, { date: '2026-11-10' }, { timezone: 'UTC' }, { version: 2 }]) {
    const h = harness(), input = props()
    input.suggestion = { ...input.suggestion, ...change }
    assert.equal(h.render(input), null)
  }
  const input = props()
  assert.equal(harness('2026-11-12T06:00:00Z').render(input), null, 'Member-local day, not UTC date, controls expiry.')
  assert.ok(harness('2026-11-12T05:59:59Z').render(input))
})

test('midnight and resumed-tab checks expire the suggestion without data writes', () => {
  const h = harness('2026-11-12T05:59:59Z'), input = props()
  assert.ok(h.render(input));const cleanup = h.runEffects()[0]
  assert.equal(h.timers.size, 1)
  const timer = [...h.timers.values()][0]
  assert.equal(timer.delay, 1001)
  h.advance('2026-11-12T06:00:00.001Z');timer.callback()
  assert.equal(h.render(input), null)
  h.listeners.get('visibilitychange')()
  assert.equal(h.render(input), null)
  cleanup()
  assert.equal(h.timers.size, 0)
  assert.equal(h.listeners.size, 0)
})
