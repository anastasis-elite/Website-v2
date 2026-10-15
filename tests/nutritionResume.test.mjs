import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const nativeRequire = createRequire(import.meta.url)
function load(path, mocks, environment = {}) {
  const module = { exports: {} }
  const compiled = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  vm.runInNewContext(compiled, { module, exports: module.exports, console, Date, Error, Promise, AbortController, process: { env: { NODE_ENV: 'test' } }, ...environment, require: name => mocks[name] || nativeRequire(name) })
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
  let props = { clientId: 'own-client', program: 'ignite', timezone: 'America/Chicago', logDate: '2026-10-14', loggingIntent: { action: 'water' }, initialLog: { id: 'own-log', water_consumed_oz: 8, water_oz: 90 } }
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
  const log = { id: 'own-log', calories: 2000, protein: 100, carbs: 200, fats: 70, iron_target_mg: 20 }
  const db = { auth: { getUser: async () => ({ data: { user: { id: 'owner' } } }) }, from(table) { const query = { select() { return query }, eq() { return query }, maybeSingle: async () => ({ data: table === 'nutrition_logs' ? log : {}, error: null }) }; return query } }
  const progress = load('lib/nutrition/micronutrientProgress.ts', {})
  const Dashboard = load('components/AdaptiveNutritionDashboard.tsx', {
    react: state.react, 'next/navigation': { useRouter: () => router }, '@/lib/supabase/client': { createClient: () => db },
    '@/components/hydration/HydrationQuickAdd': { __esModule: true, default: 'water-entry' }, '@/components/NutritionFoodLogger': { __esModule: true, default: 'food-entry' },
    '@/components/nutrition/MicronutrientProgressRing': { __esModule: true, default: 'micro-ring' },
    '@/components/nutrition/hooks': { useNutritionEngine: value => value.nutrition, useFuelReadinessEngine: value => value.fuelReadiness, usePhoenixRecipes: value => value },
    '@/lib/nutrition/canLogFood': { canLogFood: () => true, normalizeProgramTier: () => 'ignite' }, '@/lib/timezone': { getClientLocalDateOffset: () => '2026-10-14' },
    '@/lib/entitlements': entitlements, '@/lib/nutrition/mealPeriod': periods, '@/lib/analytics': { trackEvent() {} },
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
