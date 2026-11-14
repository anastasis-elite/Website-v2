import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { importTs } from './typescriptModule.mjs'

const require = createRequire(import.meta.url)
const catalog = await importTs('lib/symptoms/symptomCatalog.ts')
const children = node => node?.props?.children
const nodes = (tree, predicate) => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree)
  ? tree.flatMap(child => nodes(child, predicate))
  : [...(predicate(tree) ? [tree] : []), ...nodes(children(tree), predicate)]
const text = tree => typeof tree === 'string' || typeof tree === 'number' ? String(tree) : Array.isArray(tree)
  ? tree.map(text).join(' ') : tree && typeof tree === 'object' ? text(children(tree)) : ''
const plain = value => JSON.parse(JSON.stringify(value))
const AOSButton = 'AOSButton', AOSSlider = 'AOSSlider', AOSInput = 'AOSInput', AOSToggle = 'AOSToggle'
const SymptomLogger = 'SymptomLogger', CycleFlowLogger = 'CycleFlowLogger', AOSChip = 'AOSChip'
const commonMocks = {
  'react/jsx-runtime': { jsx: (type, props, key) => ({ type, props, key, ref: props?.ref }), jsxs: (type, props, key) => ({ type, props, key, ref: props?.ref }), Fragment: 'Fragment' },
  '@/components/aos-ui/AOSButton': { AOSButton }, '@/components/aos-ui/AOSSlider': { AOSSlider },
  '@/components/aos-ui/AOSInput': { AOSInput }, '@/components/aos-ui/AOSToggle': { AOSToggle },
  '@/components/aos-ui/AOSCard': { AOSCard: 'AOSCard' }, '@/components/aos-ui/AOSChip': { AOSChip },
  '@/components/aos-ui/AOSModal': { AOSModal: 'AOSModal' }, '@/components/aos-ui/AOSSectionHeader': { AOSSectionHeader: 'AOSSectionHeader' },
  '@/components/SymptomLogger': { __esModule: true, default: SymptomLogger },
  '@/components/CycleFlowLogger': { __esModule: true, default: CycleFlowLogger },
  'next/link': { __esModule: true, default: 'a' }, 'next/image': { __esModule: true, default: 'img' },
  '@/lib/symptoms/symptomCatalog': catalog,
  '@/lib/entitlements': { normalizeProgramTier: program => program },
  '@/lib/timezone': { localDateKey: () => '2026-11-10' },
  '@/lib/recovery/sorenessRegions': { SORENESS_REGIONS: [{ key: 'upper_back', label: 'Upper back' }], isSorenessRegionKey: key => key === 'upper_back' },
  './guided-check-in.css': {}, './symptom-logger.css': {},
}

// Model React state/effect scheduling without mounting any authenticated route or
// using a browser. Assertions exercise the real event handlers and save payloads.
function harness(path, initialProps, extra = {}) {
  const states = [], refs = [], effects = []
  let stateIndex, refIndex, effectIndex, changed = false, props = initialProps, tree
  const body = { style: { overflow: 'auto' } }
  const calls = { showModal: 0, close: 0, headingFocus: 0, entryFocus: 0, formFocus: 0, formScroll: 0 }
  const nativeDialog = { open: false, scrollTop: 0,
    showModal() { this.open = true; calls.showModal++ },
    close() { this.open = false; calls.close++; nodes(tree, node => node.type === 'dialog')[0]?.props.onClose() },
  }
  const react = {
    useState(initial) { const index = stateIndex++; if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial
      return [states[index], value => { const next = typeof value === 'function' ? value(states[index]) : value; if (!Object.is(next, states[index])) { states[index] = next; changed = true } }] },
    useRef(initial) { return refs[refIndex++] ||= { current: initial } },
    useId: () => 'synthetic-symptom-dialog', useMemo: fn => fn(), useCallback: fn => fn,
    useEffect(fn, deps) { const index = effectIndex++, prior = effects[index]; if (!prior || !deps || deps.some((value, i) => !Object.is(value, prior.deps[i]))) effects[index] = { deps, fn, cleanup: prior?.cleanup, pending: true } },
  }
  const module = { exports: {} }
  const source = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  runInNewContext(source, { module, exports: module.exports, Date, crypto: extra.crypto,
    document: { body }, window: extra.window, fetch: extra.fetch,
    require: name => name === 'react' ? react : extra.mocks?.[name] || commonMocks[name] || require(name),
  })
  function render(nextProps) {
    if (nextProps) props = { ...props, ...nextProps }
    let count = 0
    do {
      changed = false; stateIndex = refIndex = effectIndex = 0
      tree = module.exports.default(props)
      for (const node of nodes(tree, node => Boolean(node.ref))) {
        if (node.type === 'dialog') node.ref.current = nativeDialog
        else if (node.type === 'h2') node.ref.current = { focus() { calls.headingFocus++ } }
        else if (node.props.className === 'guided-check-in-resume') node.ref.current = { focus() { calls.formFocus++ }, scrollIntoView() { calls.formScroll++ } }
        else node.ref.current = { focus() { calls.entryFocus++ } }
      }
      for (const effect of effects) if (effect.pending) { effect.pending = false; effect.cleanup?.(); effect.cleanup = effect.fn() }
      assert.ok(count++ < 20, 'The component settles without an effect loop.')
    } while (changed)
    return tree
  }
  const find = predicate => nodes(render(), predicate)
  const button = label => find(node => (node.type === AOSButton || node.type === 'button' || node.type === AOSChip) && text(node) === label)[0]
  const click = label => { const target = button(label); assert.ok(target, `Control is available: ${label}`); const result = target.props.onClick(); render(); return result }
  const slider = label => find(node => node.type === AOSSlider && node.props.label.startsWith(label))[0]
  async function settle() { for (let i = 0; i < 4; i++) { await Promise.resolve(); render() } }
  render()
  return { render, find, button, click, slider, settle, calls, body, nativeDialog, get tree() { return tree } }
}

const symptoms = [
  { id: 'catalog-fatigue', name: 'Fatigue', category: 'general' },
  { id: 'catalog-cramps', name: 'Menstrual Cramps', category: 'cycle' },
  { id: 'catalog-headache', name: 'Headache', category: 'head' },
]
const regions = [{ id: 'region-pelvis', name: 'Pelvis / Cycle' }, { id: 'region-head', name: 'Head' }]
function popup() {
  const requests = [], pending = [], saved = []
  let ids = 0, closeRequests = 0, afterClose = 0, view
  view = harness('components/SymptomLogger.tsx', {
    clientId: 'synthetic-client', open: false, periodContext: false,
    onClose() { closeRequests++; view.render({ open: false }) },
    onAfterClose() { afterClose++ },
    onSaved(name) { saved.push(name); view.render({ open: false }) },
  }, { crypto: { randomUUID: () => `synthetic-request-${++ids}` }, fetch(url, options) {
    requests.push({ url, ...(options ? { body: JSON.parse(options.body) } : {}) })
    if (url === '/api/symptoms/options') return Promise.resolve({ ok: true, json: async () => ({ symptomTypes: symptoms, bodyRegions: regions }) })
    return new Promise(resolve => pending.push(resolve))
  } })
  return { view, requests, pending, saved, get closeRequests() { return closeRequests }, get afterClose() { return afterClose } }
}
const respond = (resolve, ok, data) => resolve({ ok, json: async () => data })

test('native symptom popup opens once, saves independently, locks repeated clicks, and safely retries after error/cancel/reopen', async () => {
  const h = popup(), v = h.view
  assert.equal(v.nativeDialog.open, false); assert.equal(h.requests.length, 0)
  v.render({ open: true }); await v.settle()
  assert.equal(v.nativeDialog.open, true); assert.equal(v.calls.showModal, 1)
  assert.equal(v.body.style.overflow, 'hidden'); assert.ok(v.calls.headingFocus > 0)
  assert.equal(v.find(node => node.type === 'dialog').length, 1)
  assert.equal(v.find(node => node.type === 'AOSModal').length, 0)
  assert.equal(v.find(node => node.type === 'dialog')[0].props['aria-labelledby'], 'synthetic-symptom-dialog')
  v.click('Period-related symptoms'); v.click('Fatigue')
  v.slider('Severity').props.onChange(7); v.slider('Duration').props.onChange(45); v.slider('Started after eating').props.onChange(20); v.render()
  const save = v.button('Save symptom').props.onClick
  const first = save(), duplicate = save(); v.render()
  assert.equal(h.pending.length, 1, 'Repeated handler calls create only one request.')
  assert.equal(v.find(node => node.type === 'fieldset')[0].props.disabled, true)
  assert.equal(v.find(node => node.props['aria-label'] === 'Close symptom popup')[0].props.disabled, true)
  let prevented = 0
  v.find(node => node.type === 'dialog')[0].props.onCancel({ preventDefault() { prevented++ } })
  assert.equal(prevented, 1); assert.equal(h.closeRequests, 0, 'Escape cannot abandon an in-flight request.')
  assert.deepEqual(plain(h.requests.at(-1).body), { clientId: 'synthetic-client', requestId: 'synthetic-request-1', symptomTypeId: 'catalog-fatigue', bodyRegionId: null, severity: 7, durationMinutes: 45, startedMinutesAfterMeal: 20 })
  respond(h.pending[0], false, { error: 'Synthetic save failure' }); await first; await duplicate; v.render()
  assert.match(text(v.tree), /Synthetic save failure/); assert.deepEqual(h.saved, [])
  v.click('Cancel')
  assert.equal(v.nativeDialog.open, false); assert.equal(v.body.style.overflow, 'auto'); assert.equal(h.afterClose, 1)
  v.render({ open: true }); await v.settle()
  assert.equal(v.slider('Severity').props.value, 7); assert.equal(v.slider('Duration').props.value, 45); assert.equal(v.slider('Started after eating').props.value, 20)
  assert.match(text(v.tree), /Synthetic save failure/, 'Entered details and the error survive reopening.')
  const retry = v.click('Save symptom')
  assert.equal(h.requests.at(-1).body.requestId, 'synthetic-request-1', 'The retry reuses the request ID for an uncertain prior attempt.')
  respond(h.pending[1], true, { success: true, replayed: true }); await retry; v.render()
  assert.deepEqual(h.saved, ['Fatigue']); assert.equal(v.nativeDialog.open, false); assert.equal(h.afterClose, 2)
  assert.ok(h.requests.every(request => ['/api/symptoms/options', '/api/symptoms/log'].includes(request.url)))
  v.render({ open: true }); v.click('Period-related symptoms'); v.click('Fatigue')
  assert.equal(v.slider('Severity').props.value, 5, 'A confirmed save starts a fresh symptom entry.')
  const next = v.click('Save symptom'); assert.equal(h.requests.at(-1).body.requestId, 'synthetic-request-2')
  respond(h.pending[2], true, { success: true }); await next
})

test('unconfirmed success keeps the popup and details; changed details receive a new request ID', async () => {
  const h = popup(), v = h.view
  v.render({ open: true }); await v.settle(); v.click('Period-related symptoms'); v.click('Menstrual Cramps')
  const first = v.click('Save symptom')
  assert.equal(h.requests.at(-1).body.bodyRegionId, 'region-pelvis')
  respond(h.pending[0], true, {}); await first; v.render()
  assert.deepEqual(h.saved, []); assert.equal(v.nativeDialog.open, true)
  assert.match(text(v.tree), /Unable to save your symptom/)
  v.slider('Severity').props.onChange(8); v.render()
  const second = v.click('Save symptom')
  assert.equal(h.requests.at(-1).body.requestId, 'synthetic-request-2')
  assert.equal(h.requests.at(-1).body.severity, 8)
  respond(h.pending[1], true, { success: true }); await second
})

function checkIn(initial = {}, props = {}, storage = new Map(), extra = {}) {
  const requests = [], events = [], routes = []
  const window = { sessionStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) } }
  const view = harness('components/DailyCheckInForm.tsx', { clientId: 'synthetic-client', program: 'ignite', localDate: '2026-11-10', timeZone: 'Etc/UTC', initial, cycleTrackingEnabled: true, ...props }, {
    window, fetch: async (url, options) => { const body = JSON.parse(options.body); requests.push({ url, body }); return extra.fetch ? extra.fetch(url, body) : { ok: true, json: async () => ({ success: true }) } },
    mocks: { 'next/navigation': { useRouter: () => ({ push: route => routes.push(route), refresh: () => routes.push('refresh') }) }, '@/lib/analytics': { trackEvent: (name, data) => events.push({ name, data }) }, ...(extra.mocks || {}) },
  })
  return { view, requests, events, routes, storage, logger: () => view.find(node => node.type === SymptomLogger)[0], notes: () => view.find(node => node.type === AOSInput)[0], period: (label) => view.find(node => node.type === AOSToggle && (!label || node.props.label === label))[0], flow: () => view.find(node => node.type === CycleFlowLogger)[0], flowModal: () => view.find(node => node.type === 'AOSModal' && node.props.title === 'Track today’s flow')[0], form: () => view.find(node => node.type === 'AOSCard' && node.props.as === 'form')[0] }
}

test('symptom cancellation and confirmed save preserve unfinished answers, soreness, notes, explicit onset, and tab-local draft', async () => {
  const h = checkIn(), v = h.view
  v.slider('Energy').props.onChange(7); v.slider('Stress').props.onChange(3); v.slider('Soreness').props.onChange(7); v.render()
  v.click('Upper back'); h.notes().props.onChange({ target: { value: 'Synthetic check-in note' } }); h.period().props.onChange(true); v.render()
  assert.equal(h.logger().props.periodContext, true, 'Unsaved explicit onset immediately provides symptom presentation context.')
  const before = [...h.storage.values()][0]
  assert.ok(before); assert.equal(JSON.parse(before).periodStarted, true)
  v.click('Log symptoms (optional)'); assert.equal(h.logger().props.open, true)
  assert.equal(h.form().props.as, 'form', 'The unfinished form remains mounted while the popup is open.')
  h.logger().props.onClose(); v.render(); h.logger().props.onAfterClose()
  assert.equal(v.calls.entryFocus, 1, 'Cancel returns keyboard focus to the popup trigger.')
  v.click('Log symptoms (optional)'); h.logger().props.onSaved('Synthetic signal'); v.render(); h.logger().props.onAfterClose()
  assert.equal(h.logger().props.open, false); assert.equal(v.calls.formFocus, 1); assert.equal(v.calls.formScroll, 1)
  assert.equal(v.slider('Energy').props.value, 7); assert.equal(v.slider('Stress').props.value, 3); assert.equal(v.slider('Soreness').props.value, 7)
  assert.equal(h.notes().props.value, 'Synthetic check-in note'); assert.equal(h.period().props.checked, true)
  assert.ok(v.button('Upper back')); assert.equal([...h.storage.values()][0], before)
  assert.match(text(v.tree), /Symptom saved\. Continue your Daily Check-In/)
  assert.equal(h.requests.length, 0); assert.deepEqual(h.routes, [])
  assert.equal(h.events.filter(event => event.name === 'daily_check_in_completed').length, 0)
  assert.equal(v.button('Save Daily Check-In').props.disabled, false, 'Saving symptoms does not mark the daily check-in complete.')

  const restored = checkIn({}, {}, h.storage)
  assert.equal(restored.view.slider('Energy').props.value, 7); assert.equal(restored.notes().props.value, 'Synthetic check-in note'); assert.equal(restored.period().props.checked, true)
  assert.ok(restored.view.button('Upper back')); assert.match(text(restored.view.tree), /unfinished answers are ready/)
  await h.form().props.onSubmit({ preventDefault() {} }); v.render()
  assert.equal(h.requests.length, 1); assert.equal(h.requests[0].url, '/api/daily-check-in')
  assert.deepEqual(plain(h.requests[0].body), { clientId: 'synthetic-client', date: '2026-11-10', energy: 7, stress: 3, soreness: 7, notes: 'Synthetic check-in note', sorenessRegions: ['upper_back'], periodStarted: true })
  assert.equal(h.storage.size, 0); assert.equal(h.events.filter(event => event.name === 'daily_check_in_completed').length, 1)
  assert.deepEqual(h.routes, ['/dashboard/program/ignite', 'refresh'])
})

test('recent onset only changes presentation and symptom saves never select onset or bypass final check-in energy', async () => {
  const h = checkIn({}, { recentPeriodStart: true }), v = h.view
  assert.equal(h.logger().props.periodContext, true); assert.equal(h.period().props.checked, false)
  v.click('Log symptoms (optional)'); h.logger().props.onSaved('Synthetic signal'); v.render(); h.logger().props.onAfterClose()
  assert.equal(h.period().props.checked, false); assert.equal(h.storage.size, 0)
  await h.form().props.onSubmit({ preventDefault() {} }); v.render()
  assert.equal(h.requests.length, 0); assert.match(text(v.tree), /Choose your energy level first/)
  v.click('Use this energy level'); await h.form().props.onSubmit({ preventDefault() {} }); v.render()
  assert.equal(h.requests[0].body.periodStarted, false)
  const ineligible = checkIn({}, { cycleTrackingEnabled: false, recentPeriodStart: true })
  assert.equal(ineligible.period(), undefined); assert.equal(ineligible.logger().props.periodContext, false)
  assert.ok(ineligible.view.button('Log symptoms (optional)'), 'Manual symptom access remains available without onset context.')
})

test('symptom dialog layout contract preserves the silhouette, alternate area controls, and safe-area scrolling', () => {
  const css = readFileSync('components/symptom-logger.css', 'utf8')
  const source = readFileSync('components/SymptomLogger.tsx', 'utf8')
  const v = popup().view
  const dialog = v.find(node => node.type === 'dialog')
  assert.equal(dialog.length, 1)
  assert.equal(v.find(node => node.type === 'AOSModal').length, 0)
  assert.match(source, /element\.showModal\(\)/, 'Native modal behavior traps focus and prevents background interaction.')
  assert.doesNotMatch(source, /AOSModal|useRouter|router\.(?:push|refresh)|\/api\/daily-check-in/)
  const hotspots = v.find(node => node.type === 'button' && node.props.className === 'aos-body-hotspot')
  assert.equal(hotspots.length, 8)
  assert.ok(hotspots.every(node => node.props.type === 'button' && node.props['aria-label'] && text(node).trim()))
  const areaList = v.find(node => node.props['aria-label'] === 'Choose a body area')[0]
  assert.equal(areaList.props.role, 'group')
  assert.deepEqual(nodes(areaList, node => node.type === AOSButton).map(text), ['Head', 'Chest', 'Abdomen', 'Pelvis', 'Arms', 'Legs', 'Back'])
  const hotspotRule = css.match(/\.symptom-dialog \.aos-body-hotspot\s*\{([^}]+)\}/)?.[1]
  assert.ok(hotspotRule)
  assert.match(hotspotRule, /background: transparent/)
  assert.match(hotspotRule, /border: 0/)
  assert.match(hotspotRule, /min-width: 44px/)
  assert.match(hotspotRule, /min-height: 44px/)
  assert.match(css, /\.symptom-dialog \.aos-body-map__image\s*\{[^}]*opacity: 1; filter: none/)
  assert.match(css, /\.symptom-dialog__area-list > button\s*\{[^}]*min-height: 44px/)
  assert.match(css, /:focus-visible\s*\{[^}]*outline: 2px/)
  const dialogRule = css.match(/\.symptom-dialog\s*\{([^}]+)\}/)?.[1]
  assert.match(dialogRule, /max-height: calc\(100dvh - env\(safe-area-inset-top, 0px\) - env\(safe-area-inset-bottom, 0px\) - 32px\)/)
  assert.match(dialogRule, /inset: calc\(env\(safe-area-inset-top, 0px\) \+ 16px\) 12px calc\(env\(safe-area-inset-bottom, 0px\) \+ 16px\)/)
  assert.match(dialogRule, /overflow-y: auto/)
  assert.match(dialogRule, /overscroll-behavior: contain/)
  assert.match(css, /@media \(max-width: 480px\)[\s\S]*\.symptom-dialog__map-layout\s*\{ grid-template-columns: minmax\(0, 1fr\); \}/)
  assert.match(css, /@media \(max-width: 480px\)[\s\S]*\.symptom-dialog__area-list\s*\{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/)
})


test('unknown, active and ended period states offer the appropriate actions and preserve correction access', () => {
  const unknown = checkIn({}, { recentPeriodStart: true })
  assert.ok(unknown.period('My period started today'))
  assert.equal(unknown.view.button('Track today’s flow'), undefined, 'A recent historical onset does not confirm an active period.')
  assert.match(text(unknown.view.tree), /current period status is unconfirmed/)
  assert.ok(unknown.period('My period is already active'))
  assert.ok(unknown.period('My period ended'))
  assert.equal(unknown.requests.length, 0)

  const active = checkIn({}, { periodState: { status: 'active', recordedDate: '2026-09-01' } })
  assert.ok(active.view.button('Track today’s flow'), 'An explicit active period has no fixed-day expiry.')
  assert.equal(active.period('My period started today'), undefined)
  assert.ok(active.period('My period ended'))
  assert.ok(active.view.find(node => node.type === 'a' && node.props.href === '/dashboard/cycle').length)
  assert.equal(active.logger().props.periodContext, true)

  const ended = checkIn({}, { periodState: { status: 'ended', recordedDate: '2026-11-09' } })
  assert.equal(ended.view.button('Track today’s flow'), undefined)
  assert.ok(ended.period('My period started today'))
  assert.ok(ended.period('My period is still active'))
  assert.equal(ended.period('My period ended'), undefined)
  ended.period('My period is still active').props.onChange(true); ended.view.render()
  assert.equal(ended.period('My period is still active').props.checked, true)
  ended.period('My period started today').props.onChange(true); ended.view.render()
  assert.equal(ended.period('My period is still active').props.checked, false, 'Start and correction are mutually exclusive.')
})

test('flow popup opening, cancelling and returning preserve unfinished check-in and never save defaults or complete it', async () => {
  const h = checkIn({}, { periodState: { status: 'active', recordedDate: '2026-11-07' } }), v = h.view
  v.slider('Energy').props.onChange(8); v.slider('Stress').props.onChange(3); v.slider('Soreness').props.onChange(7); v.render()
  v.click('Upper back'); h.notes().props.onChange({ target: { value: 'Keep my unfinished answers' } }); v.render()
  const draft = [...h.storage.values()][0]
  assert.equal(h.flowModal().props.open, false)
  v.click('Track today’s flow')
  assert.equal(h.flowModal().props.open, true)
  assert.equal(h.flow().props.clientId, 'synthetic-client')
  assert.equal(h.flow().props.localDate, '2026-11-10')
  assert.equal(h.flow().props.timeZone, 'Etc/UTC')
  assert.equal(h.form().props.as, 'form')
  assert.equal(nodes(h.form(), node => node.type === CycleFlowLogger).length, 0, 'Flow save is outside the daily check-in form.')
  assert.equal(h.requests.length, 0)
  h.flowModal().props.onClose(); v.render()
  assert.equal(h.flowModal().props.open, false)
  assert.equal(v.calls.entryFocus, 1)
  assert.equal([...h.storage.values()][0], draft)

  v.click('Track today’s flow'); h.flow().props.onSaved(); v.render()
  assert.equal(h.requests.length, 0)
  assert.match(text(v.tree), /Flow saved separately/)
  v.click('Return to check-in')
  assert.equal(h.flowModal().props.open, false)
  assert.equal(v.slider('Energy').props.value, 8)
  assert.equal(v.slider('Stress').props.value, 3)
  assert.equal(v.slider('Soreness').props.value, 7)
  assert.ok(v.button('Upper back'))
  assert.equal(h.notes().props.value, 'Keep my unfinished answers')
  assert.equal([...h.storage.values()][0], draft)
  assert.equal(h.events.filter(event => event.name === 'daily_check_in_completed').length, 0)
  assert.deepEqual(h.routes, [])
})

test('in-flight flow save blocks close and daily submission until the shared logger returns', async () => {
  const h = checkIn({ energy: 7 }, { periodState: { status: 'active', recordedDate: '2026-11-07' } }), v = h.view
  v.click('Track today’s flow')
  h.flow().props.onSavingChange(true); v.render()
  assert.equal(v.find(node => node.type === 'fieldset')[0].props.disabled, true)
  assert.equal(v.button('Return to check-in').props.disabled, true)
  h.flowModal().props.onClose(); await h.form().props.onSubmit({ preventDefault() {} }); v.render()
  assert.equal(h.flowModal().props.open, true)
  assert.equal(h.requests.length, 0)
  h.flow().props.onSavingChange(false); v.render()
  v.click('Return to check-in')
  assert.equal(h.flowModal().props.open, false)
})

test('explicit start, end and resume save with final check-in and persist into subsequent reopening', async () => {
  const actionCases = [
    { state: { status: 'unknown', recordedDate: null }, label: 'My period started today', action: 'start', result: 'active' },
    { state: { status: 'active', recordedDate: '2026-11-07' }, label: 'My period ended', action: 'end', result: 'ended' },
    { state: { status: 'ended', recordedDate: '2026-11-09' }, label: 'My period is still active', action: 'resume', result: 'active' },
  ]
  for (const item of actionCases) {
    const periodState = { status: item.result, recordedDate: '2026-11-10' }
    const h = checkIn({ energy: 7 }, { periodState: item.state, stayOnSave: true }, new Map(), {
      fetch: async () => ({ ok: true, json: async () => ({ success: true, periodState }) }),
    }), v = h.view
    h.period(item.label).props.onChange(true); v.render()
    assert.equal(h.requests.length, 0, 'Selecting an action is a draft until final save.')
    const restored = checkIn({ energy: 7 }, { periodState: item.state }, h.storage)
    assert.equal(restored.period(item.label).props.checked, true)
    await h.form().props.onSubmit({ preventDefault() {} }); v.render()
    assert.equal(h.requests.length, 1)
    assert.equal(h.requests[0].url, '/api/daily-check-in')
    assert.equal(h.requests[0].body.periodStarted, item.action === 'start')
    assert.equal(h.requests[0].body.periodAction, item.action === 'start' ? undefined : item.action)
    assert.equal(h.requests[0].body.date, '2026-11-10')
    assert.equal(h.storage.size, 0)
    assert.equal(Boolean(v.button('Track today’s flow')), item.result === 'active')
    assert.equal(h.period(item.result === 'active' ? 'My period ended' : 'My period started today').props.checked, false)
    const reopened = checkIn({ energy: 7 }, { completed: true, periodState })
    assert.equal(Boolean(reopened.view.button('Track today’s flow')), item.result === 'active')
    assert.equal(reopened.requests.length, 0, 'Persisted reopening does not replay the lifecycle action.')
  }
})

test('a changed persisted period state drops stale drafted actions but preserves unfinished answers', () => {
  const state = { status: 'active', recordedDate: '2026-11-07' }
  const h = checkIn({}, { periodState: state }), v = h.view
  v.slider('Energy').props.onChange(8); h.notes().props.onChange({ target: { value: 'Still unfinished' } })
  h.period('My period ended').props.onChange(true); v.render()
  const otherState = { status: 'ended', recordedDate: '2026-11-10' }
  const reopened = checkIn({}, { periodState: otherState }, h.storage)
  assert.equal(reopened.view.slider('Energy').props.value, 8)
  assert.equal(reopened.notes().props.value, 'Still unfinished')
  assert.equal(reopened.period('My period started today').props.checked, false)
  assert.equal(reopened.period('My period is still active').props.checked, false)
  assert.equal(JSON.parse([...reopened.storage.values()][0]).periodAction, null)
  v.render({ periodState: otherState })
  assert.equal(v.slider('Energy').props.value, 8)
  assert.equal(h.notes().props.value, 'Still unfinished')
  assert.equal(JSON.parse([...h.storage.values()][0]).periodAction, null, 'An incoming persisted state invalidates a pending period action even on the mounted form.')
})

test('daily save blocks duplicate submissions, preserves drafts on failure, and accepts edited corrections', async () => {
  const pending = []
  const h = checkIn({ energy: 7 }, { stayOnSave: true }, new Map(), {
    fetch: () => new Promise(resolve => pending.push(resolve)),
  }), v = h.view
  h.period('My period started today').props.onChange(true); v.render()
  const save = h.form().props.onSubmit
  const first = save({ preventDefault() {} }), duplicate = save({ preventDefault() {} }); v.render()
  assert.equal(h.requests.length, 1)
  assert.equal(v.find(node => node.type === 'fieldset')[0].props.disabled, true)
  respond(pending[0], false, { error: 'Synthetic save failure' }); await first; await duplicate; v.render()
  assert.equal(h.period('My period started today').props.checked, true)
  assert.ok(h.storage.size)
  const retry = h.form().props.onSubmit({ preventDefault() {} })
  respond(pending[1], true, { success: true, periodState: { status: 'active', recordedDate: '2026-11-10' } }); await retry; v.render()
  await h.form().props.onSubmit({ preventDefault() {} }); v.render()
  assert.equal(h.requests.length, 2, 'A successful unchanged check-in cannot be submitted again.')
  assert.equal(v.button('Save changes').props.disabled, true)
  h.period('My period ended').props.onChange(true); v.render()
  const corrected = h.form().props.onSubmit({ preventDefault() {} })
  assert.equal(h.requests.length, 3)
  assert.equal(h.requests.at(-1).body.periodAction, 'end')
  assert.equal(h.requests.at(-1).body.periodStarted, false)
  respond(pending[2], true, { success: true, periodState: { status: 'ended', recordedDate: '2026-11-10' } }); await corrected; v.render()
  assert.equal(v.button('Track today’s flow'), undefined)
})

test('tracking disabled hides cycle actions and day rollover prevents stale final check-in writes', async () => {
  const disabled = checkIn({ energy: 7 }, { cycleTrackingEnabled: false, periodState: { status: 'active', recordedDate: '2026-11-07' } })
  assert.equal(disabled.period(), undefined)
  assert.equal(disabled.view.button('Track today’s flow'), undefined)
  assert.equal(disabled.flowModal().props.open, false)
  assert.equal(disabled.logger().props.periodContext, false)
  await disabled.form().props.onSubmit({ preventDefault() {} })
  assert.equal(disabled.requests[0].body.periodStarted, false)
  assert.equal(disabled.requests[0].body.periodAction, undefined)
  const rolled = checkIn({ energy: 7 }, {}, new Map(), { mocks: { '@/lib/timezone': { localDateKey: () => '2026-11-11' } } })
  await rolled.form().props.onSubmit({ preventDefault() {} }); rolled.view.render()
  assert.equal(rolled.requests.length, 0)
  assert.match(text(rolled.view.tree), /A new day has started/)
  const failed = checkIn({ energy: 7 }, { periodState: { status: 'unknown', recordedDate: null, loadError: true } })
  assert.equal(failed.period(), undefined)
  assert.equal(failed.view.button('Track today’s flow'), undefined)
  assert.match(text(failed.view.tree), /period status could not be loaded/)
})

test('confirmed partial lifecycle save retains unfinished answers and retry saves recovery without replaying period action', async () => {
  let attempts = 0
  const h = checkIn({ energy: 7 }, { stayOnSave: true, periodState: { status: 'active', recordedDate: '2026-11-07' } }, new Map(), {
    fetch: async () => ++attempts === 1
      ? { ok: false, json: async () => ({ partialSave: true, periodState: { status: 'ended', recordedDate: '2026-11-10' }, error: 'Period saved; daily answers could not be saved.' }) }
      : { ok: true, json: async () => ({ success: true, periodState: { status: 'ended', recordedDate: '2026-11-10' } }) },
  }), v = h.view
  v.slider('Stress').props.onChange(3); h.notes().props.onChange({ target: { value: 'Retain through partial save' } })
  h.period('My period ended').props.onChange(true); v.render()
  await h.form().props.onSubmit({ preventDefault() {} }); v.render()
  assert.equal(h.requests[0].body.periodAction, 'end')
  assert.equal(v.button('Track today’s flow'), undefined)
  assert.match(text(v.tree), /Period saved; daily answers could not be saved/)
  assert.equal(v.slider('Energy').props.value, 7)
  assert.equal(v.slider('Stress').props.value, 3)
  assert.equal(h.notes().props.value, 'Retain through partial save')
  assert.ok(h.storage.size)
  assert.equal(h.events.filter(event => event.name === 'daily_check_in_completed').length, 0)
  await h.form().props.onSubmit({ preventDefault() {} }); v.render()
  assert.equal(h.requests.length, 2)
  assert.equal(h.requests[1].body.periodAction, undefined)
  assert.equal(h.requests[1].body.periodStarted, false)
  assert.equal(h.requests[1].body.stress, 3)
  assert.equal(h.requests[1].body.notes, 'Retain through partial save')
  assert.equal(h.storage.size, 0)
})

test('legacy unfinished drafts retain an explicitly selected start only while persisted status remains unknown', () => {
  const key = 'anastasis:check-in-draft:v1:synthetic-client:ignite:2026-11-10'
  const legacy = JSON.stringify({ version: 1, initialKey: '{}', answers: { energy: 8, notes: 'Existing draft' }, periodStarted: true, sorenessRegions: [] })
  const unknown = checkIn({}, {}, new Map([[key, legacy]]))
  assert.equal(unknown.period('My period started today').props.checked, true)
  assert.equal(unknown.view.slider('Energy').props.value, 8)
  const active = checkIn({}, { periodState: { status: 'active', recordedDate: '2026-11-07' } }, new Map([[key, legacy]]))
  assert.equal(active.period('My period ended').props.checked, false)
  assert.equal(active.view.slider('Energy').props.value, 8)
  assert.equal(active.notes().props.value, 'Existing draft')
  assert.equal(JSON.parse([...active.storage.values()][0]).periodStarted, false)
})


test('partial start requiring summary repair retains its action for an explicit retry without losing answers', async () => {
  let attempts = 0
  const h = checkIn({ energy: 7 }, { stayOnSave: true }, new Map(), {
    fetch: async () => ++attempts === 1
      ? { ok: false, json: async () => ({ partialSave: true, retryPeriodAction: true, periodState: { status: 'active', recordedDate: '2026-11-10' }, error: 'Period start saved; cycle summary could not be updated. Try saving again.' }) }
      : { ok: true, json: async () => ({ success: true, periodState: { status: 'active', recordedDate: '2026-11-10' } }) },
  }), v = h.view
  h.notes().props.onChange({ target: { value: 'Retain while repairing summary' } })
  h.period('My period started today').props.onChange(true); v.render()
  await h.form().props.onSubmit({ preventDefault() {} }); v.render()
  assert.equal(h.requests[0].body.periodStarted, true)
  assert.match(text(v.tree), /cycle summary could not be updated/)
  assert.equal(v.slider('Energy').props.value, 7)
  assert.equal(h.notes().props.value, 'Retain while repairing summary')
  assert.equal(JSON.parse([...h.storage.values()][0]).periodStarted, true, 'The already-written start is retained only because its summary needs repair.')
  assert.equal(h.events.filter(event => event.name === 'daily_check_in_completed').length, 0)
  await h.form().props.onSubmit({ preventDefault() {} }); v.render()
  assert.equal(h.requests.length, 2)
  assert.equal(h.requests[1].body.periodStarted, true, 'Explicit retry repeats the idempotent start to repair the summary.')
  assert.equal(h.requests[1].body.notes, 'Retain while repairing summary')
  assert.equal(h.storage.size, 0)
  assert.equal(h.period('My period ended').props.checked, false)
})
