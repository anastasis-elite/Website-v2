import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { randomUUID } from 'node:crypto'
import ts from 'typescript'
import { importTs } from './typescriptModule.mjs'

const require = createRequire(import.meta.url)
const validation = await importTs('lib/recovery/activityDetails.ts')
const display = await importTs('lib/recovery/activityDisplay.ts')
const text = value => typeof value === 'string' || typeof value === 'number' ? String(value) : Array.isArray(value) ? value.map(text).join('') : value && typeof value === 'object' ? text(value.props?.children) : ''
function nodes(tree, predicate) {
  if (!tree || typeof tree !== 'object') return []
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, predicate))
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)]
}
function harness() {
  const states = [], refs = [], calls = []
  let stateIndex = 0, refIndex = 0, refreshes = 0, focused = 0
  let send = async () => ({ ok: true, json: async () => ({ success: true }) })
  const module = { exports: {} }
  const mocks = {
    react: {
      useId: () => 'recovery-sheet',
      useState(initial) { const index = stateIndex++; if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial
        return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value }] },
      useRef(initial) { return refs[refIndex++] ||= { current: initial } },
    },
    'next/navigation': { useRouter: () => ({ refresh() { refreshes++ } }) },
    '@/components/ActionArrow': { __esModule: true, default: 'arrow' },
    '@/lib/recovery/activityDetails': validation,
    '@/lib/recovery/activityDisplay': display,
  }
  const compiled = ts.transpileModule(readFileSync('components/recovery/RecoveryActivitySheets.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText
  runInNewContext(compiled, { module, exports: module.exports, Error, crypto: { randomUUID },
    fetch(url, options) { calls.push({ url, body: JSON.parse(options.body) }); return send() },
    require: name => mocks[name] || require(name),
  })
  const nativeDialog = { open: false, showModal() { this.open = true }, close() { this.open = false; dialogNode.props.onClose() } }
  let dialogNode
  function render() {
    stateIndex = refIndex = 0
    const tree = module.exports.default({ clientId: 'owner-client' })
    dialogNode = nodes(tree, node => node.type === 'dialog')[0]
    dialogNode.ref.current = nativeDialog
    for (const input of nodes(tree, node => node.type === 'input' && node.ref)) input.ref.current = { focus() {} }
    return tree
  }
  const button = label => nodes(render(), node => node.type === 'button' && text(node) === label)[0]
  const field = label => nodes(nodes(render(), node => node.type === 'label' && text(node).startsWith(label))[0], node => ['input', 'select'].includes(node.type))[0]
  return {
    render, calls, nativeDialog, button, field,
    open(label = 'slow walk') { button(`Log ${label}`).props.onClick({ currentTarget: { focus() { focused++ } } }); render() },
    change(label, value) { field(label).props.onChange({ target: { value } }); render() },
    submit() { return nodes(render(), node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} }) },
    escape() { let prevented = false; dialogNode.props.onCancel({ preventDefault() { prevented = true } }); if (!prevented) nativeDialog.close(); return prevented },
    setSend(fn) { send = fn },
    get refreshes() { return refreshes }, get focused() { return focused },
  }
}

test('dedicated sheets start blank; Cancel and Escape discard drafts and restore focus without posting', () => {
  const view = harness()
  for (const kind of ['slow walk', 'warm soak']) {
    const trigger = view.button(`Log ${kind}`)
    assert.equal(trigger.props['aria-haspopup'], 'dialog')
    assert.equal(trigger.props['aria-controls'], 'recovery-sheet')
    view.open(kind)
    assert.equal(view.nativeDialog.open, true)
    assert.equal(view.field('Actual duration').props.value, '')
    view.change('Actual duration', '12')
    view.button('Cancel').props.onClick()
    assert.equal(view.nativeDialog.open, false)
    view.open(kind)
    assert.equal(view.field('Actual duration').props.value, '')
    assert.equal(view.escape(), false)
  }
  assert.equal(view.focused, 4)
  assert.deepEqual(view.calls, [])
})

test('walk derives pace from positive entries and saves only supplied manual measurements', async () => {
  const view = harness(); view.open()
  assert.match(text(view.render()), /Watch connection is unavailable in this PWA/)
  assert.equal(view.field('Distance (optional)').props.value, '')
  assert.equal(view.field('Heart rate (manual').props.value, '')
  view.change('Distance (optional)', '2')
  assert.doesNotMatch(text(view.render()), /Calculated pace:/)
  view.change('Actual duration', '0')
  await view.submit()
  assert.equal(view.calls.length, 0)
  view.change('Actual duration', '25.5')
  view.change('Distance unit', 'km')
  view.change('Heart rate (manual', '104')
  assert.match(text(view.render()), /Calculated pace: 12.75 min\/km/)
  await view.submit()
  assert.equal(view.calls.length, 1)
  assert.equal(view.calls[0].body.activityType, 'Gentle walk')
  assert.deepEqual(view.calls[0].body.details, { kind: 'slow_walk', source: 'manual', distance: 2, distanceUnit: 'km', heartRateBpm: 104 })
  assert.match(text(view.render()), /Slow walk saved/)
  assert.match(text(view.render()), /25.5 minutes · Manual entry/)
  assert.equal(view.refreshes, 1)
})

test('save is single-flight, blocks dismissal while pending, and failed saves retry the exact entry without completion', async () => {
  const view = harness(); view.open(); view.change('Actual duration', '9')
  let finish
  view.setSend(() => new Promise(resolve => { finish = resolve }))
  const pending = view.submit()
  await view.submit()
  view.render()
  assert.equal(view.escape(), true)
  assert.equal(view.button('Cancel').props.disabled, true)
  assert.equal(view.calls.length, 1)
  assert.doesNotMatch(text(view.render()), /Slow walk saved/)
  finish({ ok: false, json: async () => ({ error: 'Temporary save failure.' }) })
  await pending
  assert.equal(view.refreshes, 0)
  assert.match(text(view.render()), /Temporary save failure/)
  assert.equal(view.button('Retry save').props.disabled, false)
  view.setSend(async () => ({ ok: true, json: async () => ({ success: true }) }))
  await view.submit()
  assert.deepEqual(view.calls[1].body, view.calls[0].body)
  assert.equal(view.calls[0].body.details.distance, undefined)
  assert.equal(view.calls[0].body.details.heartRateBpm, undefined)
  assert.match(text(view.render()), /Slow walk saved/)
  assert.equal(view.refreshes, 1)
})

test('soak retains zero temperature, supports named multiple additions, and None is exclusive', async () => {
  const view = harness(); view.open('warm soak')
  assert.equal(view.field('Approximate temperature').props.value, '')
  view.change('Actual duration', '15')
  view.change('Temperature unit', 'C')
  view.change('Approximate temperature', '0')
  for (const label of ['Epsom salts', 'Herbs', 'Teas', 'Oats', 'Other']) view.field(label).props.onChange()
  view.change('Specific herbs', 'lavender')
  view.change('Specific teas', 'chamomile')
  view.change('Other addition', 'unscented bath oil')
  await view.submit()
  const details = view.calls[0].body.details
  assert.equal(details.temperature, 0)
  assert.equal(details.temperatureUnit, 'C')
  assert.deepEqual(details.additions, ['epsom_salts', 'herbs', 'tea', 'oats', 'other'])
  assert.match(text(view.render()), /Approximate temperature: 0 °C/)
  assert.match(text(view.render()), /Herbs \(lavender\)/)
  view.button('Close').props.onClick(); view.open('warm soak')
  view.field('Herbs').props.onChange(); view.field('None').props.onChange()
  assert.equal(view.field('Herbs').props.checked, false)
  assert.equal(view.field('None').props.checked, true)
  view.field('Oats').props.onChange()
  assert.equal(view.field('None').props.checked, false)
  view.change('Actual duration', '6')
  await view.submit()
  assert.deepEqual(view.calls[1].body.details, { kind: 'warm_soak', source: 'manual', additions: ['oats'] })
})

test('history preserves entered units, specific additions, and missing optional values', () => {
  const walk = validation.validateDetailedRecovery({ activityType: 'Gentle walk', minutes: 0.5, requestId: randomUUID(), details: { kind: 'slow_walk', source: 'manual' } }).details
  assert.deepEqual(display.formatRecoveryDetails(walk), ['0.5 minutes · Manual entry'])
  const soak = validation.validateDetailedRecovery({ activityType: 'Warm soak', minutes: 11, requestId: randomUUID(), details: { kind: 'warm_soak', source: 'manual', temperature: 80, temperatureUnit: 'F', additions: ['none'] } }).details
  assert.deepEqual(display.formatRecoveryDetails(soak), ['11 minutes · Manual entry', 'Approximate temperature: 80 °F', 'Additions: None'])
})
