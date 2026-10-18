import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const nativeRequire = createRequire(import.meta.url)
function load(path, mocks = {}, environment = {}) {
  const module = { exports: {} }
  const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  vm.runInNewContext(code, { module, exports: module.exports, console, Date, Error, Promise, process: { env: { NODE_ENV: 'test' } }, ...environment, require: key => mocks[key] || nativeRequire(key) })
  return module.exports
}
const entitlements = load('lib/entitlements.ts')
const memberNutrition = load('lib/nutrition/memberNutrition.ts', { '@/lib/entitlements': entitlements })
const tiers = load('lib/nutrition/canLogFood.ts', { '@/lib/entitlements': entitlements })
const periods = load('lib/nutrition/mealPeriod.ts')
const progress = load('lib/nutrition/micronutrientProgress.ts')
const nodes = value => !value || typeof value !== 'object' ? [] : [value, ...[value.props?.children].flat(Infinity).flatMap(nodes)]
const text = value => value == null || typeof value === 'boolean' ? '' : typeof value !== 'object' ? String(value) : [value.props?.children].flat(Infinity).map(text).join(' ')
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }

function hooks() {
  const slots = [], effects = []; let cursor = 0
  const changed = (before, next) => !before || next.some((value, index) => value !== before[index])
  const react = {
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial; return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value }] },
    useRef(initial) { const index = cursor++; return slots[index] ||= { current: initial } },
    useMemo(callback, deps) { const index = cursor++; if (changed(slots[index]?.deps, deps)) slots[index] = { deps, value: callback() }; return slots[index].value },
    useCallback(callback, deps) { return react.useMemo(() => callback, deps) },
    useEffect(callback, deps) { const index = cursor++; if (changed(slots[index]?.deps, deps)) { const old = slots[index]; const current = slots[index] = { deps }; effects.push(() => { old?.cleanup?.(); current.cleanup = callback() }) } },
  }
  return { react, slots, render(Component, props, flush = true) { cursor = 0; const tree = Component(props); if (flush) for (const effect of effects.splice(0)) effect(); return tree } }
}

function fixture({ program = 'ember', request = async () => Response.json({}), forcedMicros = false, heldIntake } = {}) {
  const state = hooks(), reads = [], requests = [], analytics = [], guidance = []
  let intakeLoads = 0, calculations = 0
  let heldAuth = null
  const log = { id: 'own-log', client_id: 'own-client', log_date: '2026-10-14', calories: 2000, protein: 100, carbs: 200, fats: 70, iron_target_mg: 20, fiber_target_g: 30, calculation_status: 'manual_override', nutrition_calculation: { statusLabel: 'Saved macro context', normalizedGoal: 'Saved recomp goal', bmi: 23, finalMacroPercentages: { protein: 25, carbs: 45, fats: 30 }, micronutrientTargets: { iron: 18 } } }
  const db = { auth: { getUser: async () => heldAuth ? heldAuth.promise : ({ data: { user: { id: 'owner' } } }) }, from(table) { let selection; const query = { select(value) { selection = value; return query }, eq() { return query }, maybeSingle: async () => { reads.push({ table, selection }); return { data: table === 'nutrition_logs' ? { ...log } : { calories_remaining: 1800, protein_remaining_g: 90, carbs_remaining_g: 180, fat_remaining_g: 65, iron_remaining_mg: 15, fiber_remaining_g: 25 }, error: null } } }; return query } }
  const doc = { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} }
  const storage = new Map()
  const Dashboard = load('components/AdaptiveNutritionDashboard.tsx', {
    react: state.react, 'next/navigation': { useRouter: () => ({ refresh() {}, push() {} }) }, '@/lib/supabase/client': { createClient: () => db },
    '@/components/hydration/HydrationQuickAdd': { __esModule: true, default: 'water-entry' }, '@/components/NutritionFoodLogger': { __esModule: true, default: 'food-entry' },
    '@/components/nutrition/MicronutrientProgressRing': { __esModule: true, default: 'micro-ring' },
    '@/components/nutrition/hooks': { useNutritionEngine: value => value.nutrition, useFuelReadinessEngine: value => value.fuelReadiness, usePhoenixRecipes: value => value },
    '@/lib/nutrition/canLogFood': tiers, '@/lib/entitlements': entitlements, '@/lib/nutrition/memberNutrition': memberNutrition,
    '@/lib/timezone': { getClientLocalDateOffset: () => '2026-10-14', getClientTimeZone: () => 'UTC' }, '@/lib/nutrition/mealPeriod': periods,
    '@/lib/analytics': { trackEvent: (...args) => analytics.push(args) },
    '@/components/dashboard/useViewPreference': { useViewPreference: (_id, scope, _allowed, fallback) => [forcedMicros && scope.startsWith('nutrition-management') ? 'micros' : fallback, () => {}] },
    '@/lib/nutrition/nextFoodGuidance': { getNextFoodGuidance: value => { guidance.push(value); return { copy: value.suggestedFoods?.[0]?.reason || 'Keep regular meals.' } } },
    '@/lib/nutrition/progress': { loadRecordedNutrition: async () => ({ total: { calories: 0, protein: 0, carbs: 0, fats: 0 } }), nutritionRemainingWithRecordedIntake: (_log, remaining) => remaining },
    '@/lib/nutrition/micronutrientProgress': { ...progress, calculateMicronutrientProgress: value => { calculations++; return progress.calculateMicronutrientProgress(value) }, loadMicronutrientProgress: async () => { intakeLoads++; return heldIntake ? heldIntake.promise : { meals: [{ entry_state: 'confirmed', grams: 100, foods: { food_nutrients: { iron_mg: 5 } } }], upperLimits: [], upperLimitsAvailable: true, macroEntryCount: 0 } } },
  }, { document: doc, window: { sessionStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) }, location: { hash: '' }, addEventListener() {}, removeEventListener() {} }, fetch: async (url, options) => { requests.push(url); if (url.startsWith('/api/nutrition-log?')) return Response.json({ nutritionLog: memberNutrition.memberNutritionLog(log, props.program) }); return request(url, options) } }).default
  const metric = { target: 100, remaining: 100 }
  let props = { program, recipes: [], logic: { program, client: { id: 'own-client', program }, trends: [], nutrition: { calories: metric, protein: metric, carbs: metric, fats: metric, mealSuggestions: [] }, fuelReadiness: {}, hydration: { consumed: 8, target: 90 } } }
  const render = flush => state.render(Dashboard, props, flush)
  const settle = async () => { for (let index = 0; index < 4; index++) { await new Promise(setImmediate); render() } return render() }
  return { state, reads, requests, analytics, guidance, render, settle, holdAuth() { heldAuth = deferred() }, releaseAuth() { const pending = heldAuth; heldAuth = null; pending.resolve({ data: { user: { id: 'owner' } } }) }, setMember(id) { props = { ...props, logic: { ...props.logic, client: { ...props.logic.client, id } } } }, setProgram(value) { props = { ...props, program: value, logic: { ...props.logic, program: value, client: { ...props.logic.client, program: value } } } }, get intakeLoads() { return intakeLoads }, get calculations() { return calculations } }
}
const microInsight = { nutrientKey: 'iron', nutrientName: 'IRON_LEAK', message: 'MICRO_GUIDANCE_LEAK', why: ['mineral explanation'] }
const recommendation = name => ({ productId: name, productName: name, productUrl: null, category: 'general_nutrition', recommendationCopy: name, disclaimerCopy: '', why: { nutrition: name, trend: '', reason: '', disclaimer: '' } })

for (const tier of ['ember', 'unknown', null]) test(`${tier} excludes micronutrient loads and stale preference display while retaining macros and water`, async () => {
  const f = fixture({ program: tier, forcedMicros: true })
  f.render(); const tree = await f.settle()
  assert.equal(f.requests.some(url => url.includes('nutrient-insights')), false)
  assert.equal(f.intakeLoads, 0)
  assert.equal(f.calculations, 0)
  assert.equal(nodes(tree).some(node => node.type === 'micro-ring' || node.props?.['data-testid'] === 'nutrition-micronutrients-tab'), false)
  assert.match(text(tree), /Water/)
  assert.match(text(tree), /Add Macros/)
  for (const read of f.reads) assert.equal(read.selection.includes('*') || /iron|fiber|vitamin|micronutrient/.test(read.selection), false)
  assert.equal(f.state.slots[2].iron_target_mg, undefined)
  assert.equal(f.state.slots[3].iron_remaining_mg, undefined)
})

for (const tier of ['ignite', 'phoenix']) test(`${tier} retains insight guidance, full persisted targets and confirmed circles`, async () => {
  const f = fixture({ program: tier, forcedMicros: true, request: async url => Response.json(url.includes('nutrient-insights') ? { insights: [microInsight] } : {}) })
  f.render(); const tree = await f.settle()
  assert.ok(f.intakeLoads > 0)
  assert.ok(f.calculations > 0)
  assert.equal(nodes(tree).find(node => node.type === 'micro-ring' && node.props.progress.key === 'iron').props.progress.percent, 25)
  assert.match(text(tree), /MICRO_GUIDANCE_LEAK/)
  assert.equal(f.state.slots[2].iron_target_mg, 20)
  assert.ok(f.reads.some(read => read.table === 'nutrition_logs' && read.selection === '*'))
})

test('downgrade hides old guidance before effect cleanup and rejects late insights, circles, supplements and suggested-food reasons', async () => {
  const oldInsight = deferred(), oldSupplement = deferred(), oldFoods = deferred(), heldIntake = deferred()
  let downgraded = false
  const f = fixture({ program: 'ignite', forcedMicros: true, heldIntake, request: async url => {
    if (url.includes('nutrient-insights')) return oldInsight.promise
    if (url.includes('supplement-recommendation')) return downgraded ? Response.json({ nutritionScope: 'protein', recommendation: recommendation('PROTEIN_SUPPORT') }) : oldSupplement.promise
    if (url.includes('suggested-foods')) return downgraded ? Response.json({ state: 'ready', suggestions: [{ name: 'Macro food', foodId: 'macro', reason: 'MACRO_GUIDANCE', contribution: 'protein' }] }) : oldFoods.promise
    return Response.json({})
  } })
  f.render(); await f.settle()
  downgraded = true; f.setProgram('ember')
  assert.doesNotMatch(text(f.render(false)), /MICRO_GUIDANCE_LEAK|MINERAL_SUPPORT/)
  oldInsight.resolve(Response.json({ insights: [microInsight] }))
  oldSupplement.resolve(Response.json({ nutritionScope: 'micronutrients', recommendation: recommendation('MINERAL_SUPPORT'), resolvedRecommendations: [{ productId: 'MINERAL_SUPPORT' }] }))
  oldFoods.resolve(Response.json({ state: 'ready', suggestions: [{ name: 'Mineral food', foodId: 'mineral', reason: 'MICRO_FOOD_REASON', contribution: 'iron' }] }))
  heldIntake.resolve({ meals: [], upperLimits: [], upperLimitsAvailable: true, macroEntryCount: 0 })
  const tree = await f.settle()
  assert.doesNotMatch(text(tree), /MICRO_GUIDANCE_LEAK|MINERAL_SUPPORT|MICRO_FOOD_REASON/)
  assert.match(text(tree), /PROTEIN_SUPPORT/)
  assert.equal(nodes(tree).some(node => node.type === 'micro-ring'), false)
  assert.ok(f.guidance.at(-1).suggestedFoods.every(food => food.reason === 'MACRO_GUIDANCE'))
  assert.equal(f.analytics.some(args => JSON.stringify(args).includes('MINERAL_SUPPORT')), false)
})

test('already displayed higher-tier guidance is hidden at the downgrade render before effects run', async () => {
  let downgraded = false
  const f = fixture({ program: 'ignite', forcedMicros: true, request: async url => {
    if (url.includes('nutrient-insights')) return Response.json({ insights: [microInsight] })
    if (url.includes('supplement-recommendation')) return Response.json({ nutritionScope: downgraded ? 'protein' : 'micronutrients', recommendation: recommendation(downgraded ? 'PROTEIN_SUPPORT' : 'MINERAL_SUPPORT') })
    if (url.includes('suggested-foods')) return Response.json({ state: 'ready', suggestions: [{ name: 'Food', foodId: 'food', reason: downgraded ? 'MACRO_GUIDANCE' : 'MICRO_FOOD_REASON', contribution: '' }] })
    return Response.json({})
  } })
  f.render(); const before = await f.settle()
  assert.match(text(before), /MICRO_GUIDANCE_LEAK/)
  assert.match(text(before), /MINERAL_SUPPORT/)
  assert.equal(f.guidance.at(-1).suggestedFoods[0].reason, 'MICRO_FOOD_REASON')
  downgraded = true; f.setProgram('ember')
  const during = f.render(false)
  assert.doesNotMatch(text(during), /MICRO_GUIDANCE_LEAK|MINERAL_SUPPORT|MICRO_FOOD_REASON/)
  assert.equal(f.guidance.at(-1).suggestedFoods.length, 0)
  assert.equal(nodes(during).some(node => node.type === 'micro-ring'), false)
  assert.match(text(await f.settle()), /PROTEIN_SUPPORT/)
})

test('member switch cannot request or claim the retained prior-member log while the new log is loading', async () => {
  const earlierFood = deferred()
  const f = fixture({ program: 'ignite', request: async url => url.includes('suggested-foods') ? earlierFood.promise : Response.json({}) })
  f.render(); await f.settle()
  const before = f.requests.filter(url => url.includes('suggested-foods')).length
  assert.ok(before > 0)
  f.holdAuth(); f.setMember('other-member'); f.setProgram('ember')
  assert.equal(f.guidance.at(-1).suggestedFoods.length, 0)
  assert.doesNotMatch(text(f.render(false)), /MICRO_PRIOR_MEMBER_REASON/)
  await f.settle()
  assert.equal(f.requests.filter(url => url.includes('suggested-foods')).length, before, 'No new-scope request may query the prior member log')
  earlierFood.resolve(Response.json({ state: 'ready', suggestions: [{ name: 'Prior food', foodId: 'prior', reason: 'MICRO_PRIOR_MEMBER_REASON', contribution: 'iron' }] }))
  const tree = await f.settle()
  assert.equal(f.guidance.at(-1).suggestedFoods.length, 0)
  assert.doesNotMatch(text(tree), /MICRO_PRIOR_MEMBER_REASON/)
})

test('older same-tier guidance errors cannot clear the latest successful response', async () => {
  const insights = [], supplements = [], foods = []
  const f = fixture({ program: 'ignite', request: async url => {
    const list = url.includes('nutrient-insights') ? insights : url.includes('supplement-recommendation') ? supplements : foods
    const pending = deferred(); list.push(pending); return pending.promise
  } })
  f.render(); await f.settle()
  await nodes(f.render()).find(node => node.type === 'food-entry').props.onUpdated()
  await f.settle()
  assert.ok(insights.length > 1 && supplements.length > 1 && foods.length > 1, 'Initial and saved-progress loads overlap')
  insights.at(-1).resolve(Response.json({ insights: [microInsight] }))
  supplements.at(-1).resolve(Response.json({ nutritionScope: 'micronutrients', recommendation: recommendation('LATEST_SUPPORT') }))
  foods.at(-1).resolve(Response.json({ state: 'ready', suggestions: [{ name: 'Food', foodId: 'food', reason: 'LATEST_FOOD', contribution: '' }] }))
  await f.settle()
  for (const group of [insights, supplements, foods]) for (const pending of group.slice(0, -1)) pending.reject(new Error('Older request failed'))
  const tree = await f.settle()
  assert.match(text(tree), /MICRO_GUIDANCE_LEAK/)
  assert.match(text(tree), /LATEST_SUPPORT/)
  assert.equal(f.guidance.at(-1).suggestedFoods[0].reason, 'LATEST_FOOD')
})

for (const scope of [undefined, 'micronutrients', 'unavailable']) test(`EMBER rejects ${scope} supplement payload but keeps its protein support request`, async () => {
  const f = fixture({ request: async url => Response.json(url.includes('supplement-recommendation') ? { nutritionScope: scope, recommendation: recommendation('MINERAL_SUPPORT') } : {}) })
  f.render(); const tree = await f.settle()
  assert.ok(f.requests.some(url => url.includes('supplement-recommendation')))
  assert.equal(nodes(tree).some(node => node.props?.['data-testid'] === 'supplement-recommendation-card'), false)
})

test('direct nutrient detail denies excluded tiers before any nutrient reads or insight calculation', async () => {
  for (const program of ['ember', 'unknown', null]) {
    let queries = 0, insights = 0
    const Page = load('app/dashboard/nutrition/nutrients/[nutrient]/page.tsx', {
      'next/link': { __esModule: true, default: 'link' }, 'next/navigation': { notFound() { throw new Error('NOT_FOUND') } },
      '@/lib/dashboard/getDashboardContext': { getDashboardContext: async () => ({ user: { id: 'owner' }, client: { client_id: 'own-client', program }, supabase: { from() { queries++; throw new Error('Unexpected nutrient read') } } }) },
      '@/lib/nutrition/getNutrientInsights': { getNutrientInsights: async () => { insights++; return [] } }, '@/lib/nutrition/memberNutrition': memberNutrition,
    }).default
    await assert.rejects(Page({ params: Promise.resolve({ nutrient: 'iron' }) }), /NOT_FOUND/)
    assert.equal(queries, 0); assert.equal(insights, 0)
  }
})

test('direct nutrient detail remains available to IGNITE and PHOENIX', async () => {
  for (const program of ['ignite', 'phoenix']) {
    const queries = []
    const db = { from(table) { queries.push(table); const query = { select() { return query }, eq() { return query }, maybeSingle: async () => ({ data: { id: 'iron', canonical_name: 'Iron', review_status: 'reviewed' } }), limit: async () => ({ data: [] }) }; return query } }
    const Page = load('app/dashboard/nutrition/nutrients/[nutrient]/page.tsx', {
      'next/link': { __esModule: true, default: 'link' }, 'next/navigation': { notFound() { throw new Error('NOT_FOUND') } },
      '@/lib/dashboard/getDashboardContext': { getDashboardContext: async () => ({ user: { id: 'owner' }, client: { client_id: 'own-client', program }, supabase: db }) },
      '@/lib/nutrition/getNutrientInsights': { getNutrientInsights: async () => [] }, '@/lib/nutrition/memberNutrition': memberNutrition,
    }).default
    assert.match(text(await Page({ params: Promise.resolve({ nutrient: 'iron' }) })), /Iron/)
    assert.deepEqual(queries, ['nutrients', 'nutrient_interactions'])
  }
})


test('EMBER reload retains stored macro calculation metadata through the projected read without nutrient transport', async () => {
  const f = fixture()
  f.render(); const tree = await f.settle()
  assert.match(text(tree), /Saved macro context/)
  assert.match(text(tree), /Saved recomp goal/)
  assert.match(text(tree), /BMI Context/)
  assert.match(text(tree), /25\s*%\s*\/\s*45\s*%\s*\/\s*30\s*%/)
  assert.ok(f.requests.some(url => url.startsWith('/api/nutrition-log?')))
  assert.equal(f.reads.some(read => read.table === 'nutrition_logs'), false, 'EMBER never requests raw log columns from the browser SDK')
  assert.equal(f.state.slots[2].nutrition_calculation.micronutrientTargets, undefined)
})


test('same paid-tier member switch hides prior circles and cannot read the retained prior log while auth is pending', async () => {
  const f = fixture({ program: 'ignite', forcedMicros: true })
  f.render(); const before = await f.settle()
  assert.ok(nodes(before).some(node => node.type === 'micro-ring'))
  const loads = f.intakeLoads
  f.holdAuth(); f.setMember('other-member')
  assert.equal(nodes(f.render(false)).some(node => node.type === 'micro-ring'), false)
  await f.settle()
  assert.equal(f.intakeLoads, loads)
  assert.equal(nodes(f.render()).some(node => node.type === 'micro-ring'), false)
})


test('food callback started before downgrade cannot publish its micronutrient success copy after the member scope changes', async () => {
  const f = fixture({ program: 'ignite' })
  f.render(); await f.settle()
  const callback = nodes(f.render()).find(node => node.type === 'food-entry').props.onUpdated
  f.holdAuth()
  const pending = callback()
  f.setProgram('ember'); f.render()
  f.releaseAuth(); await pending
  const tree = await f.settle()
  assert.doesNotMatch(text(tree), /micronutrients are updated/)
})
