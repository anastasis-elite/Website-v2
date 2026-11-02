import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { importTs } from './typescriptModule.mjs'

const require = createRequire(import.meta.url)
const timing = await importTs('lib/meditation/practiceTiming.ts')
const nodes = tree => tree == null || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)]
const text = tree => tree == null || typeof tree === 'boolean' ? '' : typeof tree !== 'object' ? String(tree) : Array.isArray(tree) ? tree.map(text).join(' ') : text(tree.props?.children)

function fixture(initialPractice = 'breath-reset') {
  let cursor = 0, now = 0, timerId = 0, refreshes = 0
  let send = async () => Response.json({ success: true })
  const slots = [], effects = [], timers = new Map(), calls = []
  const changed = (before, after) => !before || !after || after.some((value, i) => value !== before[i])
  const react = {
    useState(initial) {
      const i = cursor++
      if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial
      return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next }]
    },
    useRef(initial) { const i = cursor++; return slots[i] ||= { current: initial } },
    useMemo(fn, deps) { const i = cursor++; if (changed(slots[i]?.deps, deps)) slots[i] = { deps, value: fn() }; return slots[i].value },
    useCallback(fn, deps) { return react.useMemo(() => fn, deps) },
    useEffect(fn, deps) {
      const i = cursor++
      if (changed(slots[i]?.deps, deps)) {
        const old = slots[i], current = slots[i] = { deps }
        effects.push(() => { old?.cleanup?.(); current.cleanup = fn() })
      }
    },
  }
  const module = { exports: {} }
  const mocks = {
    react,
    'next/navigation': { useRouter: () => ({ refresh() { refreshes++ } }) },
    '@/lib/meditation/practiceTiming': timing,
  }
  const code = ts.transpileModule(readFileSync('components/meditation/MeditationPractice.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  const window = { setInterval(fn) { timers.set(++timerId, fn); return timerId }, clearInterval(id) { timers.delete(id) } }
  runInNewContext(code, {
    module, exports: module.exports, require: name => mocks[name] || require(name), window,
    performance: { now: () => now },
    fetch: async (url, options) => { calls.push({ url, body: JSON.parse(options.body) }); return send(url, options) },
  })
  const Component = module.exports.default
  const f = {
    calls,
    get refreshes() { return refreshes },
    render() { cursor = 0; const tree = Component({ clientId: 'owner', initialPractice }); effects.splice(0).forEach(effect => effect()); return tree },
    advance(milliseconds) { now += milliseconds; [...timers.values()].forEach(fn => fn()); f.render(); return f.render() },
    button(label) { const result = nodes(f.render()).find(node => node.type === 'button' && text(node).trim() === label); assert.ok(result, `Missing button: ${label}`); return result },
    setSend(fn) { send = fn },
    start() { f.button('Start practice').props.onClick(); return f.render() },
    timer() { return text(nodes(f.render()).find(node => node.props?.['aria-label'] === 'Session time remaining')) },
    orb() { return nodes(f.render()).find(node => node.props?.className?.split(' ').includes('meditation-orbit')) },
  }
  return f
}

test('query choice, fallback, and changing native buttons retain exactly one selected indicator', () => {
  for (const initial of ['breath-reset', 'sleep-wind-down', 'invalid-practice']) {
    const f = fixture(initial)
    const selected = () => nodes(f.render()).filter(node => node.type === 'button' && node.props['aria-pressed'] === true)
    assert.equal(selected().length, 1)
    assert.match(text(selected()[0]), initial === 'sleep-wind-down' ? /Sleep Wind Down/ : /Breath Reset/)
    assert.match(text(selected()[0]), /Selected/)
    const next = nodes(f.render()).find(node => node.type === 'button' && text(node).includes('Calm Reset'))
    next.props.onClick()
    assert.equal(selected().length, 1)
    assert.match(text(selected()[0]), /Calm Reset/)
    assert.match(text(selected()[0]), /Selected/)
    assert.equal(selected()[0].props.type, 'button')
    assert.equal(selected()[0].props.tabIndex, undefined)
  }
})

test('pause freezes phase, countdown, and orb; resume includes only active time; reset restarts round one', () => {
  const f = fixture()
  f.start()
  f.advance(4500)
  const before = f.orb().props.style
  f.button('Pause').props.onClick()
  const pausedTimer = f.timer()
  f.advance(60000)
  assert.equal(f.timer(), pausedTimer)
  assert.deepEqual(f.orb().props.style, before)
  f.button('Continue').props.onClick()
  f.render()
  f.advance(1000)
  assert.notEqual(f.timer(), pausedTimer)
  assert.notDeepEqual(f.orb().props.style, before)
  f.button('Reset').props.onClick()
  assert.match(text(f.render()), /Round 1/)
  assert.equal(f.timer(), '1:54.5')
  const resetStyle = f.orb().props.style
  f.advance(10000)
  assert.equal(f.timer(), '1:54.5')
  assert.deepEqual(f.orb().props.style, resetStyle)
  f.button('Continue').props.onClick()
  f.render()
  f.advance(4000)
  assert.match(text(f.orb()), /Exhale/)
  f.button('Stop practice').props.onClick()
  assert.equal(nodes(f.render()).filter(node => node.type === 'button' && node.props['aria-pressed'] === true).length, 1)
  assert.equal(f.calls.length, 0)
  f.start()
  assert.equal(f.timer(), '1:54.5')
})

test('skipping holds recomputes exact duration and a completed session sends one earned-time log', async () => {
  for (const [practiceId, durationMs, minutes] of [['breath-reset', 101500, 1], ['sleep-wind-down', 549000, 9]]) {
    const f = fixture(practiceId)
    const skip = nodes(f.render()).find(node => node.type === 'input' && node.props.type === 'checkbox')
    assert.ok(skip)
    skip.props.onChange({ target: { checked: true } })
    f.start()
    const early = f.button('Complete')
    await early.props.onClick()
    assert.equal(f.calls.length, 0)
    f.advance(durationMs - 1)
    assert.equal(f.button('Complete').props.disabled, true)
    f.advance(1)
    assert.equal(f.timer(), '0:00.0')
    assert.equal(f.button('Complete').props.disabled, false)
    const complete = f.button('Complete').props.onClick
    let confirm
    f.setSend(() => new Promise(resolve => { confirm = resolve }))
    const pending = complete()
    await complete()
    assert.equal(f.calls.length, 1)
    assert.equal(f.refreshes, 0)
    confirm(Response.json({ success: true }))
    await pending
    assert.equal(f.refreshes, 1)
    assert.deepEqual(f.calls[0].body, { clientId: 'owner', activityType: practiceId === 'breath-reset' ? 'Breathwork' : 'Meditation', minutes, practiceId, elapsedMs: durationMs, skipHolds: true })
    assert.equal(f.button('Logged').props.disabled, true)
    await complete()
    assert.equal(f.calls.length, 1, 'An old click handler cannot create another confirmed log')
    f.advance(10000)
    assert.equal(f.timer(), '0:00.0')
    assert.equal(f.calls.length, 1)
  }
})

test('Calm Reset and Recovery Meditation retain their durations, four-second rhythm, and two-minute logging gate', async () => {
  for (const [practiceId, durationMs, initial] of [['calm-reset', 300000, '5:00.0'], ['recovery-meditation', 480000, '8:00.0']]) {
    const f = fixture(practiceId)
    f.start()
    assert.equal(f.timer(), initial)
    f.advance(4000)
    assert.match(text(f.orb()), /Exhale/)
    f.advance(4000)
    assert.match(text(f.orb()), /Inhale/)
    f.advance(111999)
    assert.equal(f.button('Complete').props.disabled, true)
    f.advance(1)
    assert.equal(f.button('Complete').props.disabled, false)
    f.advance(durationMs - 120000)
    assert.equal(f.timer(), '0:00.0')
  }
})
