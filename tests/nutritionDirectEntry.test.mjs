import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import ts from 'typescript'
import vm from 'node:vm'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const nativeRequire = createRequire(import.meta.url)
function load(path, mocks = {}) {
  const output = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  const module = { exports: {} }
  vm.runInNewContext(output, { module, exports: module.exports, console, Intl, require: specifier => mocks[specifier] || nativeRequire(specifier) })
  return module.exports
}
const { parseNutritionLoggingIntent } = load('lib/nutrition/loggingIntent.ts')
const periods = load('lib/nutrition/mealPeriod.ts')
const entitlements = load('lib/entitlements.ts')
const Logger = load('components/NutritionFoodLogger.tsx', {
  'next/navigation': { useRouter: () => ({ refresh() {} }) },
  '@/app/styles/globalstyles': {},
  '@/lib/nutrition/mealPeriod': periods,
}).default

test('direct entry query accepts supported actions and editable meal contexts without trusting arbitrary input', () => {
  for (const action of ['water', 'food', 'meal']) assert.equal(parseNutritionLoggingIntent({ log: action }).action, action)
  for (const meal of ['breakfast', 'lunch', 'dinner', 'snack']) assert.equal(parseNutritionLoggingIntent({ log: 'meal', meal }).meal, meal[0].toUpperCase() + meal.slice(1))
  assert.equal(parseNutritionLoggingIntent({ log: ['meal'], meal: 'invalid' }).action, null)
  assert.equal(parseNutritionLoggingIntent({ log: 'meal', meal: 'invalid', recipe: '<script>' }).meal, undefined)
  assert.equal(parseNutritionLoggingIntent({ log: 'meal', recipe: '<script>' }).recipeId, undefined)
  assert.equal(parseNutritionLoggingIntent({ log: 'meal', meal: '__proto__' }).meal, undefined)
  assert.equal(parseNutritionLoggingIntent({ log: 'meal', meal: 'constructor' }).meal, undefined)
})

test('food entry immediately exposes a changeable meal selector and tier-supported distinct methods', () => {
  for (const tier of ['ignite', 'phoenix']) {
    const html = renderToStaticMarkup(React.createElement(Logger, { nutritionLogId: 'own-log', initialMealPeriod: 'Lunch', capabilities: entitlements.getTierCapabilities(tier) }))
    assert.match(html, /<select[^>]*>.*<option value="Lunch" selected="">Lunch<\/option>/)
    assert.match(html, /<option value="Dinner">Dinner<\/option>/)
    assert.match(html, /Search \/ manual/)
    assert.match(html, /Barcode/)
    assert.equal(/>Photo<\/button>/.test(html), tier === 'phoenix')
    assert.match(html, /type="search"/)
    assert.match(html, /enterKeyHint="search"/)
  }
})

test('inactive food methods do not mount duplicate data loaders', () => {
  const html = renderToStaticMarkup(React.createElement(Logger, { nutritionLogId: 'own-log', initialMealPeriod: 'Breakfast', capabilities: entitlements.getTierCapabilities('phoenix') }))
  assert.equal((html.match(/Search food<\/label>/g) || []).length, 1)
  assert.doesNotMatch(html, /Or enter a barcode|Checking photo availability/)
})

test('meal selection stays editable and shared while switching distinct input methods', () => {
  const states = []
  let cursor = 0
  const hooks = {
    useId: () => 'qa-entry', useEffect() {},
    useState(initial) { const index = cursor++; if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial; return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value }] },
  }
  const ControlledLogger = load('components/NutritionFoodLogger.tsx', { react: hooks, 'next/navigation': {}, '@/app/styles/globalstyles': {}, '@/lib/nutrition/mealPeriod': periods }).default
  function nodes(element) {
    if (!element || typeof element !== 'object') return []
    return [element, ...[element.props?.children].flat(Infinity).flatMap(nodes)]
  }
  const render = () => { cursor = 0; return ControlledLogger({ nutritionLogId: 'own-log', initialMealPeriod: 'Lunch', capabilities: entitlements.getTierCapabilities('phoenix') }) }
  let tree = render()
  nodes(tree).find(element => element.type === 'select').props.onChange({ target: { value: 'Dinner' } })
  nodes(tree).find(element => element.props?.role === 'tab' && element.props.children === 'Barcode').props.onClick()
  tree = render()
  const mountedMethods = nodes(tree).filter(element => typeof element.type === 'function')
  assert.equal(mountedMethods.length, 2)
  assert.equal(mountedMethods.every(element => element.props.mealName === 'Dinner'), true)
  assert.equal(mountedMethods.find(element => element.props.method === 'manual').props.active, false)
  assert.equal(mountedMethods.find(element => element.props.method === 'barcode').props.active, true)
})

test('direct food and meal entry shows the actual entitled logger while EMBER retains guidance and macro entry', () => {
  let cursor = 0
  const hooks = { useEffect() {}, useMemo: callback => callback(), useCallback: callback => callback,
    useState(initial) { const index = cursor++; return [index === 0 ? false : index === 1 ? { id: 'own-log', calories: 2000, protein: 100, carbs: 250, fats: 70 } : typeof initial === 'function' ? initial() : initial, () => {}] },
  }
  const Dashboard = load('components/AdaptiveNutritionDashboard.tsx', {
    react: hooks, 'next/navigation': { useRouter: () => ({ refresh() {}, push() {} }) },
    '@/lib/supabase/client': { createClient: () => ({}) },
    '@/components/hydration/HydrationQuickAdd': { __esModule: true, default: () => null },
    '@/components/NutritionFoodLogger': { __esModule: true, default: props => React.createElement('div', { 'data-testid': 'actual-food-entry' }, props.initialMealPeriod) },
    '@/components/nutrition/MicronutrientProgressRing': { __esModule: true, default: () => null },
    '@/components/nutrition/hooks': { useNutritionEngine: logic => logic.nutrition, useFuelReadinessEngine: logic => logic.fuelReadiness, usePhoenixRecipes: recipes => recipes },
    '@/lib/nutrition/canLogFood': load('lib/nutrition/canLogFood.ts', { '@/lib/entitlements': entitlements }),
    '@/lib/timezone': load('lib/timezone.ts'), '@/lib/entitlements': entitlements,
    '@/lib/nutrition/mealPeriod': periods, '@/lib/analytics': {},
    '@/components/dashboard/useViewPreference': { useViewPreference: (_client, _scope, _values, fallback) => [fallback, () => {}] },
    '@/lib/nutrition/nextFoodGuidance': load('lib/nutrition/nextFoodGuidance.ts'),
    '@/lib/nutrition/progress': {}, '@/lib/nutrition/micronutrientProgress': load('lib/nutrition/micronutrientProgress.ts'),
  }).default
  for (const tier of ['ember', 'ignite', 'phoenix']) {
    cursor = 0
    const metric = { target: 100, remaining: 100 }
    const logic = { program: tier, client: { id: 'own-client', program: tier }, trends: [], nutrition: { calories: metric, protein: metric, carbs: metric, fats: metric, mealSuggestions: [] }, fuelReadiness: {}, hydration: { consumed: 0, target: 100 } }
    const html = renderToStaticMarkup(Dashboard({ program: tier, logic, recipes: [], loggingIntent: parseNutritionLoggingIntent({ log: 'meal', meal: 'lunch' }) }))
    assert.doesNotMatch(html, /nutrition-objective|nutrition-progress-panel/)
    if (tier === 'ember') { assert.doesNotMatch(html, /actual-food-entry/); assert.match(html, /Nutrition Guidance/); assert.match(html, /nutrition-macro-form/) }
    else { assert.match(html, /actual-food-entry/); assert.match(html, />Lunch<\/div>/); assert.match(html, /Log Meal/) }
  }
})

test('nutrition page starts direct logging before schedule cards and retains client-scoped state', () => {
  const page = readFileSync('app/dashboard/nutrition/page.tsx', 'utf8')
  const client = readFileSync('app/dashboard/nutrition/NutritionDashboardClient.tsx', 'utf8')
  assert.ok(page.indexOf('if (loggingIntent.action)') < page.indexOf('const schedule ='))
  assert.match(client, /key=\{logic.client.id\}/)
})

const directHelpers = load('lib/nutrition/directEntry.ts')
function directDb(log) {
  const reads = []
  return { reads, from(table) { const filters = [], query = { select() { return query }, eq(key, value) { filters.push([key, value]); return query }, maybeSingle: async () => { reads.push({table,filters}); return {data:log,error:null} } }; return query } }
}

test('direct first-use preparation keeps a daily log created while targets were loading', async () => {
  const existing = {id:'own-log',client_id:'own-client',log_date:'2026-10-14',water_consumed_oz:36}
  const db = directDb(existing), calls = []
  const log = await directHelpers.prepareDirectFoodEntry({supabase:db,clientId:'own-client',logDate:'2026-10-14',program:'ignite',request:async (url) => {calls.push(url);return Response.json({protein:100,carbs:200,fats:60,calories:1740,water:90})}})
  assert.equal(log.water_consumed_oz,36)
  assert.equal(calls.length,1,'An existing saved day never invokes log upsert')
  assert.deepEqual(JSON.parse(JSON.stringify(db.reads[0].filters)),[['client_id','own-client'],['log_date','2026-10-14']])
})

test('direct entry rejects foreign daily logs and EMBER food initialization', async () => {
  await assert.rejects(directHelpers.readDirectEntryLog(directDb({id:'foreign',client_id:'other',log_date:'2026-10-14'}),'own-client','2026-10-14'),/logging day changed/)
  await assert.rejects(directHelpers.prepareDirectFoodEntry({supabase:directDb(null),clientId:'own-client',logDate:'2026-10-14',program:'ember',request:()=>{throw new Error('must not fetch')}}),/require IGNITE or PHOENIX/)
})

test('direct page returns water and meal entry without initializing personalized dashboard or schedule modules', async () => {
  for (const action of ['water','food','meal']) {
    let reads=0
    const Page = load('app/dashboard/nutrition/page.tsx', {
      '@/components/DailyPlanCard':{__esModule:true,default:()=>null},
      '@/lib/schedule/service':{getDailyScheduleState:()=>{throw new Error('secondary schedule must not initialize')}},
      './NutritionDashboardClient':{__esModule:true,default:()=>null},
      '@/lib/dashboard/getDashboardContext':{getDashboardContext:async()=>({supabase:{},user:{id:'owner'},client:{client_id:'own-client',program:'ignite',timezone:'America/Chicago'}})},
      '@/lib/safety/getRecentSafetyFlags':{getRecentSafetyFlags:async()=>[]},
      '@/components/legal/SafetyEscalationNotice':{__esModule:true,default:()=>null},
      '@/lib/nutrition/recipes/getPhoenixRecipeRecommendations':{},
      '@/lib/dashboard/logic/getProgramLogicForClient':{getProgramLogicForClient:()=>{throw new Error('personalization must not initialize')}},
      '@/lib/entitlements':entitlements,'@/lib/nutrition/loggingIntent':{parseNutritionLoggingIntent},
      '@/components/nutrition/DirectNutritionEntry':{__esModule:true,default:'direct-entry'},
      '@/lib/nutrition/directEntry':{readDirectEntryLog:async()=>{reads++;return {id:'own-log',client_id:'own-client',log_date:'2026-10-14'}}},
      '@/lib/timezone':{getClientLocalDate:()=> '2026-10-14',getClientTimeZone:()=> 'America/Chicago'},
      '@/lib/nutrition/mealPeriod':periods,'@/lib/nutrition/recipes/catalog':{seedRecipes:[]},
    }).default
    const entry=await Page({searchParams:Promise.resolve({log:action,meal:'lunch'})})
    assert.equal(entry.type,'direct-entry')
    assert.equal(entry.props.loggingIntent.meal,'Lunch')
    assert.equal(reads,1)
  }
})
