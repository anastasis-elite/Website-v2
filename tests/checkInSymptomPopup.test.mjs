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
const SymptomLogger = 'SymptomLogger', AOSChip = 'AOSChip'
const commonMocks = {
  'react/jsx-runtime': { jsx: (type, props, key) => ({ type, props, key, ref: props?.ref }), jsxs: (type, props, key) => ({ type, props, key, ref: props?.ref }), Fragment: 'Fragment' },
  '@/components/aos-ui/AOSButton': { AOSButton }, '@/components/aos-ui/AOSSlider': { AOSSlider },
  '@/components/aos-ui/AOSInput': { AOSInput }, '@/components/aos-ui/AOSToggle': { AOSToggle },
  '@/components/aos-ui/AOSCard': { AOSCard: 'AOSCard' }, '@/components/aos-ui/AOSChip': { AOSChip },
  '@/components/aos-ui/AOSModal': { AOSModal: 'AOSModal' }, '@/components/aos-ui/AOSSectionHeader': { AOSSectionHeader: 'AOSSectionHeader' },
  '@/components/SymptomLogger': { __esModule: true, default: SymptomLogger },
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

function checkIn(initial = {}, props = {}, storage = new Map()) {
  const requests = [], events = [], routes = []
  const window = { sessionStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) } }
  const view = harness('components/DailyCheckInForm.tsx', { clientId: 'synthetic-client', program: 'ignite', localDate: '2026-11-10', timeZone: 'Etc/UTC', initial, cycleTrackingEnabled: true, ...props }, {
    window, fetch: async (url, options) => { requests.push({ url, body: JSON.parse(options.body) }); return { ok: true, json: async () => ({ success: true }) } },
    mocks: { 'next/navigation': { useRouter: () => ({ push: route => routes.push(route), refresh: () => routes.push('refresh') }) }, '@/lib/analytics': { trackEvent: (name, data) => events.push({ name, data }) } },
  })
  return { view, requests, events, routes, storage, logger: () => view.find(node => node.type === SymptomLogger)[0], notes: () => view.find(node => node.type === AOSInput)[0], period: () => view.find(node => node.type === AOSToggle)[0], form: () => view.find(node => node.type === 'AOSCard' && node.props.as === 'form')[0] }
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
