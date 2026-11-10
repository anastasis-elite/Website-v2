import CardArtworkModule from './cardArtworkFixture.mjs'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import vm from 'node:vm'
import { dirname, resolve } from 'node:path'
import ts from 'typescript'

const nativeRequire = createRequire(import.meta.url)
function load(path, mocks, environment = {}) {
  const module = { exports: {} }
  const compiled = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  vm.runInNewContext(compiled, { module, exports: module.exports, console, Date, Error, Promise, AbortController, process: { env: { NODE_ENV: 'test' } }, ...environment, require: name => mocks[name] || (name.startsWith('.') ? load(resolve(dirname(path), name) + '.ts', mocks, environment) : name === '@/components/phone-app/PhoneAppFrame' ? { __esModule: true, default: 'phone-app-frame' } : nativeRequire(name)) })
  return module.exports
}
function hooks() {
  const slots = [], effects = []; let cursor = 0
  const changed = (before, next) => !before || next.some((value, index) => value !== before[index])
  const react = {
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial; return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value }] },
    useRef(initial) { const index = cursor++; return slots[index] ||= { current: initial } },
    useId() { const index = cursor++; return slots[index] ||= `qa-${index}` },
    useMemo(callback, deps) { const index = cursor++; if (changed(slots[index]?.deps, deps)) slots[index] = { deps, value: callback() }; return slots[index].value },
    useCallback(callback, deps) { return react.useMemo(() => callback, deps) },
    useEffect(callback, deps) { const index = cursor++; if (changed(slots[index]?.deps, deps)) { const previous = slots[index]; slots[index] = { deps }; effects.push(() => { previous?.cleanup?.(); slots[index].cleanup = callback() }) } },
  }
  return { react, render(Component, props) { cursor = 0; const tree = Component(props); for (const effect of effects.splice(0)) effect(); return tree }, unmount() { for (const slot of slots) slot?.cleanup?.() } }
}
function nodes(element) { return !element || typeof element !== 'object' ? [] : [element, ...[element.props?.children].flat(Infinity).flatMap(nodes)] }
function documentFixture() {
  const listeners = new Map()
  return { visibilityState: 'visible', addEventListener(event, callback) { if (!listeners.has(event)) listeners.set(event, new Set()); listeners.get(event).add(callback) }, removeEventListener(event, callback) { listeners.get(event)?.delete(callback) }, dispatch(event) { for (const callback of [...listeners.get(event) || []]) callback() }, listenerCount(event) { return listeners.get(event)?.size || 0 } }
}
async function flush(render) { await new Promise(setImmediate); render(); await new Promise(setImmediate); return render() }
const entitlements = load('lib/entitlements.ts', {})
const periods = load('lib/nutrition/mealPeriod.ts', {})
const router = { refresh() {}, push() {} }

test('same-day direct entry adopts refreshed water while retaining the same food logger identity', () => {
  const state = hooks(), db = {}
  const Direct = load('components/nutrition/DirectNutritionEntry.tsx', {
    react: state.react, 'next/navigation': { useRouter: () => router },
    '@/components/hydration/HydrationQuickAdd': { __esModule: true, default: 'water-entry' },
    '@/components/NutritionFoodLogger': { __esModule: true, default: 'food-entry' },
    '@/lib/entitlements': entitlements, '@/lib/supabase/client': { createClient: () => db }, '@/lib/nutrition/directEntry': {},
  }).default
  let props = { clientId: 'own-client', program: 'ignite', timezone: 'America/Chicago', logDate: '2026-10-14', loggingIntent: { action: 'water' }, initialLog: { id: 'own-log', client_id: 'own-client', log_date: '2026-10-14', water_consumed_oz: 8, water_oz: 90 } }
  const render = () => state.render(Direct, props)
  const water = () => nodes(render()).find(node => node.type === 'water-entry')
  assert.equal(water().props.consumed, 8)
  water().props.onSaved(18)
  assert.equal(water().props.consumed, 18)
  props = { ...props, initialLog: { ...props.initialLog, water_consumed_oz: 36 } }
  render()
  assert.equal(water().props.consumed, 36)
  props = { ...props, loggingIntent: { action: 'food', meal: 'Lunch' } }
  const before = nodes(render()).find(node => node.type === 'food-entry')
  props = { ...props, initialLog: { ...props.initialLog, water_consumed_oz: 44 } }
  render()
  const after = nodes(render()).find(node => node.type === 'food-entry')
  assert.equal(after.key, before.key, 'Refreshing saved state must not remount and discard the food draft')
  props = { ...props, initialLog: null, initialError: 'Saved intake could not be loaded' }
  render()
  assert.equal(nodes(render()).find(node => node.type === 'food-entry').key, before.key, 'A transient read failure preserves the active food draft')
})

test('direct water exposes the actual inline entry without a second trigger', () => {
  const state = hooks(), navigations = []
  const Direct = load('components/nutrition/DirectNutritionEntry.tsx', {
    react: state.react, 'next/navigation': { useRouter: () => ({ refresh() {}, replace: href => navigations.push(href) }) },
    '@/components/hydration/HydrationQuickAdd': { __esModule: true, default: 'water-entry' },
    '@/components/NutritionFoodLogger': { __esModule: true, default: 'food-entry' },
    '@/lib/entitlements': entitlements, '@/lib/supabase/client': { createClient: () => ({}) }, '@/lib/nutrition/directEntry': {},
  }).default
  const tree = state.render(Direct, { clientId: 'own-client', program: 'ember', timezone: 'America/Chicago', logDate: '2026-10-14',
    loggingIntent: { action: 'water' }, initialLog: { id: 'own-log', client_id: 'own-client', log_date: '2026-10-14', water_consumed_oz: 8, water_oz: 90 } })
  const entries = nodes(tree).filter(node => node.type === 'water-entry')
  assert.equal(entries.length, 1)
  assert.equal(entries[0].props.inline, true)
  assert.equal(entries[0].props.initiallyOpen, undefined)
  assert.equal(nodes(tree).filter(node => node.type === 'h1' || node.type === 'button' || node.type === 'a').length, 0, 'No redundant wrapper controls precede the actual entry')
  assert.equal(entries[0].props.renderTrigger({}), null)
  assert.equal(entries[0].props.consumed, 8)
  assert.equal(entries[0].props.onClosed, undefined, 'Unsaved dismissal has no return callback')
  assert.deepEqual(navigations, [])
})

test('direct water retains unavailable-total feedback and its read retry inside the actual entry', async () => {
  const state = hooks(); let reads = 0
  const Direct = load('components/nutrition/DirectNutritionEntry.tsx', {
    react: state.react, 'next/navigation': { useRouter: () => router },
    '@/components/hydration/HydrationQuickAdd': { __esModule: true, default: 'water-entry' },
    '@/components/NutritionFoodLogger': { __esModule: true, default: 'food-entry' },
    '@/lib/entitlements': entitlements, '@/lib/supabase/client': { createClient: () => ({}) },
    '@/lib/nutrition/directEntry': { readDirectWaterEntry: async () => { reads++; return { clientId: 'own-client', logDate: '2026-10-14', consumed: 24, target: 90 } } },
  }).default
  const props = { clientId: 'own-client', program: 'ember', timezone: 'America/Chicago', logDate: '2026-10-14', loggingIntent: { action: 'water' }, initialLog: null, initialError: 'Synthetic saved-total read failed' }
  const render = () => state.render(Direct, props)
  let entry = nodes(render()).find(node => node.type === 'water-entry')
  assert.equal(entry.props.consumedKnown, false)
  assert.ok(nodes(entry).some(node => node.props?.role === 'alert'))
  nodes(entry).find(node => node.type === 'button').props.onClick()
  await flush(render)
  entry = nodes(render()).find(node => node.type === 'water-entry')
  assert.equal(reads, 1)
  assert.equal(entry.props.consumed, 24)
  assert.equal(entry.props.consumedKnown, true)
})

test('active food method revalidates once on visible resume and retains its search draft', async () => {
  const parentState = hooks(), inputState = hooks(), doc = documentFixture(), calls = []
  let activeHooks = parentState.react
  const react = Object.fromEntries(Object.keys(activeHooks).map(name => [name, (...args) => activeHooks[name](...args)]))
  let holdMealRead = false, releaseEarlierRead
  const mealResponse = name => Response.json({ meals: [{ id: 'persisted', serving_amount: 1, foods: { name } }] })
  const request = async url => {
    calls.push(url)
    if (holdMealRead && url.startsWith('/api/today-meals')) return new Promise(resolve => { releaseEarlierRead = () => resolve(mealResponse('Earlier snapshot')) })
    return mealResponse('Saved food')
  }
  const Logger = load('components/NutritionFoodLogger.tsx', {
    react, 'next/navigation': { useRouter: () => router }, '@/app/styles/globalstyles': {}, '@/lib/nutrition/mealPeriod': periods,
  }, { document: doc, fetch: request }).default
  const input = nodes(parentState.render(Logger, { nutritionLogId: 'own-log', capabilities: entitlements.getTierCapabilities('ignite'), initialMealPeriod: 'Lunch' })).find(node => typeof node.type === 'function')
  activeHooks = inputState.react
  let props = input.props
  const render = () => inputState.render(input.type, props)
  render(); await flush(render)
  calls.length = 0
  nodes(render()).find(node => node.type === 'input' && node.props.type === 'search').props.onChange({ target: { value: 'unsaved yogurt search' } })
  doc.visibilityState = 'hidden'; doc.dispatch('visibilitychange')
  assert.equal(calls.length, 0)
  doc.visibilityState = 'visible'; doc.dispatch('visibilitychange')
  await flush(render)
  assert.equal(calls.filter(url => url.startsWith('/api/today-meals')).length, 1)
  assert.equal(nodes(render()).find(node => node.type === 'input' && node.props.type === 'search').props.value, 'unsaved yogurt search')
  holdMealRead = true; doc.dispatch('visibilitychange')
  holdMealRead = false; doc.dispatch('visibilitychange'); await flush(render)
  releaseEarlierRead(); await flush(render)
  assert.equal(nodes(render()).some(node => node.type === 'h4' && node.props.children === 'Earlier snapshot'), false, 'An older read cannot replace the latest persisted-food refresh')
  props = { ...props, active: false }; render(); calls.length = 0
  doc.dispatch('visibilitychange'); await flush(render)
  assert.equal(calls.length, 0, 'Inactive methods must not duplicate resume data reads')
  inputState.unmount()
  assert.equal(doc.listenerCount('visibilitychange'), 0)
})

test('visible micronutrient rings reload other-device persisted intake after resume', async () => {
  const state = hooks(), doc = documentFixture(); let intakeLoads = 0, iron = 5
  const log = { id: 'own-log', client_id: 'own-client', log_date: '2026-10-14', calories: 2000, protein: 100, carbs: 200, fats: 70, iron_target_mg: 20 }
  const db = { auth: { getUser: async () => ({ data: { user: { id: 'owner' } } }) }, from(table) { const query = { select() { return query }, eq() { return query }, maybeSingle: async () => ({ data: table === 'nutrition_logs' ? log : {}, error: null }) }; return query } }
  const progress = load('lib/nutrition/micronutrientProgress.ts', {})
  const Dashboard = load('components/AdaptiveNutritionDashboard.tsx', {
    '@/components/CardArtwork': CardArtworkModule,
    react: state.react, 'next/navigation': { useRouter: () => router }, '@/lib/supabase/client': { createClient: () => db },
    '@/components/hydration/HydrationQuickAdd': { __esModule: true, default: 'water-entry' }, '@/components/NutritionFoodLogger': { __esModule: true, default: 'food-entry' },
    '@/components/nutrition/MacroQuickAdd': { __esModule: true, default: 'macro-entry' },
    '@/lib/nutrition/dailyMacroMetrics': load('lib/nutrition/dailyMacroMetrics.ts', {}),
    '@/lib/dashboard/viewPreferences': load('lib/dashboard/viewPreferences.ts', {}),
    '@/components/nutrition/MicronutrientProgressRing': { __esModule: true, default: 'micro-ring' },
    '@/components/nutrition/hooks': { useNutritionEngine: value => value.nutrition, useFuelReadinessEngine: value => value.fuelReadiness, usePhoenixRecipes: value => value },
    '@/lib/nutrition/canLogFood': { canLogFood: () => true, normalizeProgramTier: () => 'ignite' }, '@/lib/timezone': { getClientLocalDateOffset: () => '2026-10-14', getClientTimeZone: () => 'UTC' },
    '@/lib/entitlements': entitlements, '@/lib/nutrition/memberNutrition': load('lib/nutrition/memberNutrition.ts', { '@/lib/entitlements': entitlements }), '@/lib/nutrition/mealPeriod': periods, '@/lib/analytics': { trackEvent() {} },
    '@/components/dashboard/useViewPreference': { useViewPreference: (_id, scope, _allowed, fallback) => [scope.startsWith('nutrition-management') ? 'micros' : fallback, () => {}] },
    '@/lib/nutrition/nextFoodGuidance': { getNextFoodGuidance: () => ({ copy: '' }) },
    '@/lib/nutrition/progress': { loadRecordedNutrition: async () => ({ total: { calories: 0, protein: 0, carbs: 0, fats: 0 } }), nutritionRemainingWithRecordedIntake: () => ({ calories_remaining: 2000, protein_remaining_g: 100, carbs_remaining_g: 200, fat_remaining_g: 70 }) },
    '@/lib/nutrition/micronutrientProgress': { ...progress, loadMicronutrientProgress: async () => { intakeLoads++; return { meals: [{ entry_state: 'confirmed', grams: 100, foods: { food_nutrients: { iron_mg: iron } } }], upperLimits: [], upperLimitsAvailable: true, macroEntryCount: 0 } } },
  }, { document: doc, window: { location: { hash: '' }, addEventListener() {}, removeEventListener() {} }, fetch: async () => Response.json({}) }).default
  const metric = { target: 100, remaining: 100 }, props = { program: 'ignite', recipes: [], logic: { program: 'ignite', client: { id: 'own-client' }, trends: [], nutrition: { calories: metric, protein: metric, carbs: metric, fats: metric, mealSuggestions: [] }, fuelReadiness: {}, hydration: { consumed: 0, target: 90 } } }
  const render = () => state.render(Dashboard, props)
  render(); await flush(render); await flush(render)
  assert.equal(nodes(render()).find(node => node.type === 'micro-ring' && node.props.progress.key === 'iron').props.progress.percent, 25)
  const before = intakeLoads
  iron = 12
  doc.visibilityState = 'hidden'; doc.dispatch('visibilitychange'); await flush(render)
  assert.equal(intakeLoads, before)
  doc.visibilityState = 'visible'; doc.dispatch('visibilitychange'); await flush(render); await flush(render)
  assert.equal(intakeLoads, before + 1)
  assert.equal(nodes(render()).find(node => node.type === 'micro-ring' && node.props.progress.key === 'iron').props.progress.percent, 60)
  state.unmount()
  assert.equal(doc.listenerCount('visibilitychange'), 0)
})

// Render both real water components so navigation assertions exercise receipt
// persistence and response validation, rather than invoking onSaved by hand.
function mountedWaterReturn({ request, shared = false, earlierReceipt } = {}) {
  const parent = hooks(), child = hooks(), values = new Map(), calls = [], navigation = []
  let active = parent.react, props, tree, mounted = true, childMounted = false, failClear = false, refreshes = 0, receiptChecks = 0
  const react = Object.fromEntries(Object.keys(active).map(name => [name, (...args) => active[name](...args)]))
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem(key) { if (failClear) throw new Error('Synthetic receipt-clear failure'); values.delete(key) },
    get length() { return values.size }, key: index => [...values.keys()][index] ?? null,
  }
  if (earlierReceipt) values.set('anastasis:water-submission:v1:own-client', JSON.stringify(earlierReceipt))
  const location = { pathname: '/dashboard/nutrition', search: '?log=water' }
  const environment = {
    Date: class extends Date { constructor(...args) { super(...(args.length ? args : ['2026-10-14T12:00:00Z'])) } },
    URLSearchParams, crypto: { randomUUID }, document: documentFixture(),
    window: { localStorage: storage, location, setInterval() { return 1 }, clearInterval() {}, addEventListener() {}, removeEventListener() {} },
    fetch: async (url, options) => {
      assert.equal(url, '/api/nutrition/add-water')
      const body = JSON.parse(options.body)
      assert.equal(JSON.parse(values.get(`anastasis:water-submission:v1:${body.clientId}`)).submissionId, body.submissionId, 'The durable identity exists before POST')
      calls.push(body)
      return request ? request(body, calls.length) : Response.json({ nutritionLog: { water_consumed_oz: 44, water_oz: 90 } })
    },
  }
  const navigationRouter = { refresh() { refreshes++ }, replace(href) { navigation.push(href) }, push() { assert.fail('Returning must replace history') }, back() { assert.fail('Returning must resolve Today directly') } }
  const imports = {
    react, 'next/navigation': { useRouter: () => navigationRouter },
    '@/lib/supabase/client': { createClient: () => ({}) },
    '@/lib/hydration/waterSubmission': load('lib/hydration/waterSubmission.ts', {}, environment),
    '@/lib/hydration/reconcileWaterSubmission': { readWaterReceiptStatus: async () => { receiptChecks++; return 'confirmed' } },
  }
  const QuickAdd = load('components/hydration/HydrationQuickAdd.tsx', imports, environment).default
  const Direct = load('components/nutrition/DirectNutritionEntry.tsx', {
    ...imports, '@/lib/entitlements': entitlements,
    '@/components/hydration/HydrationQuickAdd': { __esModule: true, default: QuickAdd },
    '@/components/NutritionFoodLogger': { __esModule: true, default: 'food-entry' },
    '@/lib/nutrition/directEntry': { readDirectWaterEntry: async (clientId, logDate) => ({ clientId, logDate, target: 90, consumed: 36 }) },
  }, environment).default
  props = { clientId: 'own-client', program: 'ignite', timezone: 'UTC', logDate: '2026-10-14', loggingIntent: { action: 'water' }, initialLog: { id: 'own-log', client_id: 'own-client', log_date: '2026-10-14', water_consumed_oz: 36, water_oz: 90 } }
  function render() {
    if (!mounted) return tree
    active = parent.react
    tree = parent.render(Direct, props)
    const water = nodes(tree).find(node => node.type === QuickAdd)
    if (water) {
      active = child.react
      tree = child.render(QuickAdd, shared ? { ...water.props, inline: false, refreshOnSave: undefined, onSaved: undefined } : water.props)
      childMounted = true
    } else if (childMounted) { child.unmount(); childMounted = false }
    return tree
  }
  render(); render()
  return {
    render, calls, navigation, values, location,
    get refreshes() { return refreshes }, get receiptChecks() { return receiptChecks },
    setProps(next) { props = { ...props, ...next } },
    setClearFailure(value) { failClear = value },
    unmount() { mounted = false; parent.unmount(); child.unmount() },
    button(label) { return nodes(tree).find(node => node.type === 'button' && elementText(node) === label) },
    input(type) { return nodes(tree).find(node => node.type === 'input' && node.props.type === type) },
    async flush() { return flush(render) },
  }
}
const elementText = element => Array.isArray(element) ? element.map(elementText).join('') : element && typeof element === 'object' ? elementText(element.props?.children) : element == null ? '' : String(element)

test('confirmed direct water save replaces Today once despite repeated taps and does not refresh the departing entry', async () => {
  let release
  const app = mountedWaterReturn({ request: () => new Promise(resolve => { release = resolve }) })
  const save = app.button('Add 8 oz')
  save.props.onClick(); save.props.onClick()
  assert.equal(app.calls.length, 1)
  assert.deepEqual(app.navigation, [])
  release(Response.json({ nutritionLog: { water_consumed_oz: 44, water_oz: 90 } }))
  await app.flush()
  assert.deepEqual(app.navigation, ['/dashboard'])
  assert.equal(app.refreshes, 0)
  assert.equal(app.values.size, 0)
  assert.equal(app.button('Add 8 oz').props.disabled, true, 'A pending route replacement cannot submit another drink')
  app.button('Add 8 oz').props.onClick(); await app.flush()
  assert.equal(app.calls.length, 1)
  assert.deepEqual(app.navigation, ['/dashboard'])
})

test('opening direct water and editing an unsaved amount never saves or returns', async () => {
  const app = mountedWaterReturn()
  app.input('range').props.onChange({ target: { value: '20' } }); app.render()
  app.input('number').props.onChange({ target: { value: '7.5' } }); app.render()
  assert.equal(app.input('range').props.value, 7.5)
  app.unmount(); await app.flush()
  assert.equal(app.calls.length, 0)
  assert.deepEqual(app.navigation, [])
  assert.equal(app.refreshes, 0)
  assert.equal(app.values.size, 0)
})

test('failed and ambiguous direct water responses retain the same receipt and return only after a confirmed retry', async () => {
  const failures = [
    () => Response.json({ error: 'Synthetic save failure' }, { status: 503 }),
    () => { throw new TypeError('Response lost after commit') },
    () => new Response('{malformed'),
    ...[null, '', -1, 'invalid'].map(total => () => Response.json({ nutritionLog: { water_consumed_oz: total } })),
  ]
  for (const failure of failures) {
    const app = mountedWaterReturn({ request: (_body, attempt) => attempt === 1 ? failure() : Response.json({ nutritionLog: { water_consumed_oz: 44 } }) })
    app.button('Add 8 oz').props.onClick(); await app.flush()
    assert.deepEqual(app.navigation, [])
    assert.equal(app.refreshes, 0)
    assert.equal(app.values.size, 1)
    app.button('Retry 8 oz save').props.onClick(); await app.flush()
    assert.equal(app.calls[1].submissionId, app.calls[0].submissionId)
    assert.equal(app.calls[1].logDate, app.calls[0].logDate)
    assert.deepEqual(app.navigation, ['/dashboard'])
    assert.equal(app.values.size, 0)
    assert.equal(app.refreshes, 0)
    app.unmount()
  }
})

test('receipt-clear failure keeps direct water open and retries its original identity before returning', async () => {
  const app = mountedWaterReturn()
  app.setClearFailure(true)
  app.button('Add 8 oz').props.onClick(); await app.flush()
  assert.deepEqual(app.navigation, [])
  assert.equal(app.values.size, 1)
  assert.equal(app.refreshes, 0)
  app.setClearFailure(false)
  app.button('Retry 8 oz save').props.onClick(); await app.flush()
  assert.equal(app.calls[1].submissionId, app.calls[0].submissionId)
  assert.deepEqual(app.navigation, ['/dashboard'])
})

test('late direct water confirmation cannot return after unmount, navigation away, or a client/day scope change', async () => {
  const changes = [
    app => app.unmount(),
    app => { app.location.pathname = '/dashboard/training' },
    app => { app.location.search = '?log=food' },
    app => { app.setProps({ clientId: 'other-client' }); app.render() },
    app => { app.setProps({ logDate: '2026-10-15' }); app.render() },
    app => { app.setProps({ clientId: 'other-client' }); app.render(); app.setProps({ clientId: 'own-client' }); app.render() },
    app => { app.setProps({ loggingIntent: { action: 'food' } }); app.render() },
  ]
  for (const change of changes) {
    let release
    const app = mountedWaterReturn({ request: () => new Promise(resolve => { release = resolve }) })
    app.button('Add 8 oz').props.onClick()
    change(app)
    const refreshesBeforeResponse = app.refreshes
    release(Response.json({ nutritionLog: { water_consumed_oz: 44 } }))
    await app.flush()
    assert.deepEqual(app.navigation, [])
    assert.equal(app.refreshes, refreshesBeforeResponse, 'The stale response cannot add a refresh')
    assert.equal(app.calls.length, 1)
    app.unmount()
  }
})

test('confirming an earlier receipt alone never returns direct water or submits another drink', async () => {
  const app = mountedWaterReturn({ earlierReceipt: { submissionId: randomUUID(), ounces: 8, logDate: '2026-10-13' } })
  await app.flush()
  assert.equal(app.receiptChecks, 1)
  assert.equal(app.values.size, 0)
  assert.equal(app.calls.length, 0)
  assert.deepEqual(app.navigation, [])
  assert.equal(app.refreshes, 0)
})

test('shared hydration still refreshes after confirmation and food/meal saves retain their logger without returning', async () => {
  const shared = mountedWaterReturn({ shared: true })
  shared.button('Log 8 oz').props.onClick(); await shared.flush()
  assert.deepEqual(shared.navigation, [])
  assert.equal(shared.refreshes, 1)
  for (const action of ['food', 'meal']) {
    const app = mountedWaterReturn()
    app.setProps({ loggingIntent: { action, meal: 'Lunch' } })
    const entry = nodes(app.render()).find(node => node.type === 'food-entry')
    assert.equal(entry.props.initialMealPeriod, 'Lunch')
    entry.props.onUpdated({}, 'saved')
    const saved = nodes(app.render()).find(node => node.type === 'food-entry')
    assert.equal(saved.key, entry.key)
    assert.equal(app.refreshes, 1)
    assert.equal(app.calls.length, 0)
    assert.deepEqual(app.navigation, [])
    app.unmount()
  }
})
