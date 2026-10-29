import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import ts from 'typescript'
import vm from 'node:vm'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const moduleCache = new Map()
function moduleUrl(path) {
  if (moduleCache.has(path)) return moduleCache.get(path)
  let { outputText } = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ES2020, target: ts.ScriptTarget.ES2022 },
  })
  outputText = outputText.replace(/from ['"]([^'"]+)['"]/g, (match, specifier) => {
    let url
    if (specifier === 'next/server') url = `data:text/javascript;base64,${Buffer.from('export const NextResponse = { json: (body, init) => Response.json(body, init) }').toString('base64')}`
    else if (specifier === '@/lib/supabase/server') url = `data:text/javascript;base64,${Buffer.from('export const createClient = async () => globalThis.nutritionRecoveryTestClient').toString('base64')}`
    else if (specifier.startsWith('@/')) url = moduleUrl(`${specifier.slice(2)}.ts`)
    else return match
    return `from '${url}'`
  })
  const url = `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
  moduleCache.set(path, url)
  return url
}

const suggestedRoute = await import(moduleUrl('app/api/nutrition/suggested-foods/route.ts'))
const { buildSuggestedFoods } = await import(moduleUrl('lib/nutrition/suggestedFoods.ts'))
const { getTierCapabilities } = await import(moduleUrl('lib/entitlements.ts'))
const preference = await import(moduleUrl('lib/dashboard/viewPreferences.ts'))
const { getRecoveryScoreExplanation } = await import(moduleUrl('lib/recovery/scoreExplanation.ts'))
const tierHelpers = await import(moduleUrl('lib/nutrition/canLogFood.ts'))
const nextFoodGuidance = await import(moduleUrl('lib/nutrition/nextFoodGuidance.ts'))
const nutritionProgress = await import(moduleUrl('lib/nutrition/progress.ts'))
const micronutrientProgress = await import(moduleUrl('lib/nutrition/micronutrientProgress.ts'))
const memberNutrition = await import(moduleUrl('lib/nutrition/memberNutrition.ts'))
const timezone = await import(moduleUrl('lib/timezone.ts'))
const remaining = { calories_remaining: 1800, protein_remaining_g: 120, carbs_remaining_g: 200, fat_remaining_g: 60, fiber_remaining_g: 25 }
const foods = [
  { id: 'beans', name: 'Black beans', food_nutrients: { calories: 132, protein_g: 9, carbs_g: 24, fat_g: 1, fiber_g: 8 }, food_serving_options: [{ label: '100 g', grams: 100, is_default: true }] },
  { id: 'yogurt', name: 'Greek yogurt', grams_per_serving: 100, food_nutrients: { calories: 90, protein_g: 18, carbs_g: 5, fat_g: 0, calcium_mg: 110 }, allergens: ['milk'] },
]

function database({ tier = 'ignite', owner = 'qa-user', snapshot = remaining, mealIds = [], catalog = foods, signedIn = true, clientPresent = true, flowBurden = false } = {}) {
  const rows = {
    nutrition_logs: [{ id: 'qa-log', client_id: 'qa-client', auth_user_id: owner }],
    clients: clientPresent ? [{ client_id: 'qa-client', auth_user_id: 'qa-user', program: tier, allergies: ['milk'] }] : [],
    nutrition_log_remaining: snapshot ? [snapshot] : [],
    meal_entries: mealIds.map(food_id => ({ food_id })), foods: catalog,
    cycle_burden_scores: flowBurden ? [{ user_id: 'qa-user', client_id: 'qa-client', burden_score: 30, burden_band: 'high', normalized_factors: { factors: [] }, algorithm_version: 'synthetic' }] : [],
  }
  const writes = []
  return {
    writes,
    auth: { getUser: async () => ({ data: { user: signedIn ? { id: 'qa-user' } : null } }) },
    from(table) {
      const filters = []
      let selection = '*'
      const query = {
        select(columns = '*') { selection = columns; return query }, order() { return query }, limit() { return query },
        eq(key, value) { if (table !== 'nutrition_log_remaining' && table !== 'meal_entries') filters.push(row => row[key] === value); return query },
        is() { return query },
        insert(payload) { writes.push({ table, payload }); return query },
        single() { return execute(true) }, maybeSingle() { return execute(true) },
        then(resolve, reject) { return execute(false).then(resolve, reject) },
      }
      async function execute(single) {
        const matches = (rows[table] || []).filter(row => filters.every(filter => filter(row))).map(row => {
          if (table !== 'foods' || selection === '*' || /\ballergens\b/.test(selection)) return row
          const { allergens, ...selected } = row
          return selected
        })
        return { data: single ? matches[0] || null : matches, error: null }
      }
      return query
    },
  }
}

test('zero prior meals still return useful target-based foods across tiers without logging', async () => {
  for (const tier of ['ember', 'ignite', 'phoenix']) {
    const db = database({ tier })
    globalThis.nutritionRecoveryTestClient = db
    const response = await suggestedRoute.GET(new Request('http://test/api/nutrition/suggested-foods?nutritionLogId=qa-log'))
    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.state, 'ready')
    assert.equal(body.basis, 'targets')
    assert.equal(body.suggestions[0].foodId, 'beans')
    assert.equal(body.suggestions.some(food => food.foodId === 'yogurt'), false)
    assert.equal(db.writes.length, 0)
    assert.equal(getTierCapabilities(tier).nutritionMealLogging, tier !== 'ember')
  }
})

test('food suggestions distinguish missing targets, satisfied targets, and an empty matching catalog', async () => {
  globalThis.nutritionRecoveryTestClient = database({ snapshot: null })
  let response = await suggestedRoute.GET(new Request('http://test/api/nutrition/suggested-foods?nutritionLogId=qa-log'))
  let body = await response.json()
  assert.equal(body.state, 'ready')
  assert.equal(body.basis, 'general')
  assert.match(body.suggestions[0].reason, /starting option/i)
  assert.doesNotMatch(body.suggestions[0].reason, /gap|remaining.*needs/)
  globalThis.nutritionRecoveryTestClient = database({ snapshot: { calories_remaining: 0, protein_remaining_g: 0 } })
  response = await suggestedRoute.GET(new Request('http://test/api/nutrition/suggested-foods?nutritionLogId=qa-log'))
  assert.equal((await response.json()).state, 'complete')
  globalThis.nutritionRecoveryTestClient = database({ catalog: [] })
  response = await suggestedRoute.GET(new Request('http://test/api/nutrition/suggested-foods?nutritionLogId=qa-log'))
  assert.equal((await response.json()).state, 'unavailable')
})

test('suggested-food API returns verified portion nutrients across tiers and no unsuitable fallback', async () => {
  const dry = { id: 'dry-egg', name: 'Egg, white, dried', food_nutrients: { calories: 382, protein_g: 80 },
    food_serving_options: [{ label: '1 large egg / equivalent', grams: 50 }] }
  const prepared = { id: 'prepared', name: 'Cooked protein option', food_nutrients: { calories: 200, protein_g: 30, carbs_g: 10, fat_g: 4 },
    food_serving_options: [{ label: 'Half portion', grams: 50, is_default: true }] }
  const unknownServing = { id: 'unknown', name: 'Cooked beans', food_nutrients: { calories: 130, protein_g: 9 },
    food_serving_options: [{ label: '100 grams' }] }
  for (const tier of ['ember', 'ignite', 'phoenix']) {
    const db = database({ tier, catalog: [dry, unknownServing, prepared] })
    globalThis.nutritionRecoveryTestClient = db
    const body = await (await suggestedRoute.GET(new Request('http://test/api/nutrition/suggested-foods?nutritionLogId=qa-log'))).json()
    assert.equal(body.state, 'ready')
    assert.deepEqual(body.suggestions.map(item => item.foodId), ['prepared'])
    assert.equal(body.suggestions[0].servingGrams, 50)
    assert.equal(body.suggestions[0].calories, 100)
    assert.equal(body.suggestions[0].protein, 15)
    assert.equal(body.suggestions[0].carbs, 5)
    assert.equal(body.suggestions[0].fats, 2)
    assert.equal(body.suggestions[0].contribution, '+15g protein')
    assert.equal(db.writes.length, 0)

    globalThis.nutritionRecoveryTestClient = database({ tier, catalog: [dry, unknownServing] })
    const empty = await (await suggestedRoute.GET(new Request('http://test/api/nutrition/suggested-foods?nutritionLogId=qa-log'))).json()
    assert.equal(empty.state, 'unavailable')
    assert.deepEqual(empty.suggestions, [])
  }
})

test('food ranking excludes logged foods, avoided foods, and supplement products', () => {
  const candidates = [
    { id: 'beans', name: 'Black beans', grams_per_serving: 100, calories: 132, protein_g: 9, fiber_g: 8 },
    { id: 'yogurt', name: 'Greek yogurt', grams_per_serving: 100, calories: 90, protein_g: 18, allergens: ['milk'] },
    { id: 'pill', name: 'Protein supplement capsule', grams_per_serving: 100, calories: 90, protein_g: 20 },
  ]
  assert.deepEqual(buildSuggestedFoods({ remaining, candidates, loggedFoodIds: ['beans'], avoidTerms: ['milk'] }), [])
  assert.equal(buildSuggestedFoods({ remaining: null, candidates, avoidTerms: ['milk'] })[0].foodId, 'beans')
})

test('EMBER suggestions ignore historical micro gaps and food values without changing entitled-tier ranking', async () => {
  const snapshot = { calories_remaining: 500, protein_remaining_g: 50, carbs_remaining_g: 50, fat_remaining_g: 20, magnesium_remaining_mg: 300, fiber_remaining_g: 20 }
  const catalog = [{ id: 'a', name: 'Option A', grams_per_serving: 100, food_nutrients: { calories: 100, protein_g: 10, carbs_g: 5, fat_g: 1 } },
    { id: 'b', name: 'Option B', grams_per_serving: 100, food_nutrients: { calories: 100, protein_g: 10, carbs_g: 5, fat_g: 1, magnesium_mg: 300, fiber_g: 20 } }]
  const request = () => new Request('http://test/api/nutrition/suggested-foods?nutritionLogId=qa-log&program=phoenix')
  let ember
  for (const tier of ['ember', 'unrecognized', 'ignite', 'phoenix']) {
    const db = database({ tier, snapshot, catalog }); globalThis.nutritionRecoveryTestClient = db
    const body = await (await suggestedRoute.GET(request())).json()
    assert.equal(body.state, 'ready')
    if (tier === 'ember' || tier === 'unrecognized') {
      assert.equal(body.suggestions[0].foodId, 'a')
      assert.equal(body.remaining.magnesium_remaining_mg, undefined)
      assert.equal(body.remaining.fiber_remaining_g, undefined)
      assert.equal(body.remaining.protein_remaining_g, 50)
      assert.doesNotMatch(JSON.stringify(body), /magnesium|fiber|micronutrient/i)
      if (tier === 'ember') ember = body.suggestions
    } else {
      assert.equal(body.suggestions[0].foodId, 'b')
      assert.equal(body.remaining.magnesium_remaining_mg, 300)
    }
    assert.equal(snapshot.magnesium_remaining_mg, 300, 'Projecting member output does not mutate historical rows')
  }
  const changed = structuredClone(catalog); changed[0].food_nutrients.magnesium_mg = 3000; changed[1].food_nutrients.magnesium_mg = 0
  globalThis.nutritionRecoveryTestClient = database({ tier: 'ember', snapshot, catalog: changed })
  assert.deepEqual((await (await suggestedRoute.GET(request())).json()).suggestions, ember)
})

test('micro-only gaps cannot keep EMBER guidance active; general macro food planning remains available', async () => {
  const url = new Request('http://test/api/nutrition/suggested-foods?nutritionLogId=qa-log')
  for (const tier of ['ember', 'ignite', 'phoenix']) {
    globalThis.nutritionRecoveryTestClient = database({ tier, snapshot: { calories_remaining: 0, protein_remaining_g: 0, magnesium_remaining_mg: 300 } })
    const body = await (await suggestedRoute.GET(url)).json()
    assert.equal(body.state, tier === 'ember' ? 'complete' : 'unavailable')
    globalThis.nutritionRecoveryTestClient = database({ tier, snapshot: null })
    const general = await (await suggestedRoute.GET(url)).json()
    assert.equal(general.state, 'ready')
    assert.equal(general.basis, 'general')
    if (tier === 'ember') assert.doesNotMatch(JSON.stringify(general), /fiber|magnesium|micronutrient/i)
  }
})

test('EMBER retains physiology-based protein support without micro guidance in responses or audit writes', async () => {
  const db = database({ tier: 'ember', flowBurden: true }); globalThis.nutritionRecoveryTestClient = db
  const body = await (await suggestedRoute.GET(new Request('http://test/api/nutrition/suggested-foods?nutritionLogId=qa-log'))).json()
  assert.equal(body.state, 'ready')
  assert.equal(body.physiologySupportActive, true)
  assert.equal(db.writes.length, 1)
  assert.deepEqual(db.writes[0].payload.recommendation_effects[0].nutrients, ['protein'])
  assert.doesNotMatch(JSON.stringify(body) + JSON.stringify(db.writes[0].payload.recommendation), /iron|magnesium|potassium|fiber|anemia|deficiency/i)
})

test('a log without a current owned membership cannot receive suggested food guidance', async () => {
  globalThis.nutritionRecoveryTestClient = database({ clientPresent: false })
  assert.equal((await suggestedRoute.GET(new Request('http://test/api/nutrition/suggested-foods?nutritionLogId=qa-log&program=phoenix'))).status, 404)
})

test('recorded macro refresh requests only its macro fields and preserves recorded totals', async () => {
  const reads = []
  const rows = { nutrition_log_totals_by_block: [{ day_block: 'morning', calories_eaten: 100, protein_eaten_g: 10, carbs_eaten_g: 12, fat_eaten_g: 2, iron_eaten_mg: 999 }],
    macro_entries: [{ calories: 200, protein_g: 20, carbs_g: 24, fat_g: 4, day_block: 'morning' }] }
  const db = { from(table) { let columns; const query = { select(value) { columns = value; return query }, eq(key, value) { assert.equal(key, 'nutrition_log_id'); assert.equal(value, 'qa-log'); return query },
    then(done) { reads.push({ table, columns }); return Promise.resolve({ data: rows[table].map(row => Object.fromEntries(columns.split(',').filter(key => key in row).map(key => [key, row[key]]))), error: null }).then(done) } }; return query } }
  const recorded = await nutritionProgress.loadRecordedNutrition(db, 'qa-log')
  assert.deepEqual(recorded.total, { calories: 300, protein: 30, carbs: 36, fats: 6 })
  assert.equal(recorded.macroEntryCount, 1)
  assert.ok(reads.every(read => !read.columns.includes('*') && !/iron|fiber|magnesium|vitamin/.test(read.columns)))
  assert.equal(rows.nutrition_log_totals_by_block[0].iron_eaten_mg, 999)
})

function recoveryInputs(overrides = {}) {
  return {
    assessments: { dailyCompleted: false },
    sleep: { hours: null, quality: null },
    recoveryCheck: { energy: null, stress: null, soreness: null },
    recoveryStatus: { score: 70 },
    ...overrides,
  }
}

test('no recovery inputs explain missing fields and never present the default as a confirmed score', () => {
  const explanation = getRecoveryScoreExplanation(recoveryInputs())
  assert.equal(explanation.score, null)
  assert.deepEqual(explanation.missingInputs, ['Sleep duration', 'Sleep quality', 'Energy', 'Stress', 'Soreness'])
  assert.deepEqual(explanation.availableInputs, [])
  assert.match(explanation.summary, /unknown.*not counted as good recovery/i)
})

test('partial saved recovery inputs remain provisional and identify exactly what is missing', () => {
  const explanation = getRecoveryScoreExplanation(recoveryInputs({
    assessments: { dailyCompleted: true }, sleep: { hours: 7, quality: null },
    recoveryCheck: { energy: 6, stress: 4, soreness: null },
  }))
  assert.equal(explanation.score, null)
  assert.deepEqual(explanation.missingInputs, ['Sleep quality', 'Soreness'])
  assert.deepEqual(explanation.availableInputs, ['Sleep duration', 'Energy', 'Stress'])
})

test('recovery scores require saved complete finite inputs and retain existing engine results', () => {
  const complete = recoveryInputs({ sleep: { hours: 7.5, quality: 8 }, recoveryCheck: { energy: 7, stress: 3, soreness: 4 } })
  assert.equal(getRecoveryScoreExplanation(complete).score, null)
  complete.assessments.dailyCompleted = true
  assert.equal(getRecoveryScoreExplanation(complete).score, 70)
  complete.recoveryCheck.energy = Number.NaN
  assert.equal(getRecoveryScoreExplanation(complete).score, null)
})

test('recovery completion explains selection, recovers after failed save, and refreshes after success', async () => {
  const states = []
  let cursor = 0, refreshes = 0
  const nativeRequire = createRequire(import.meta.url)
  const modules = new Map()
  const fakeReact = {
    useId: () => 'qa-completion-hint',
    useState(initial) {
      const index = cursor++
      if (!(index in states)) states[index] = initial
      return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value }]
    },
  }
  const output = ts.transpileModule(readFileSync('components/RecoveryLogger.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  const module = { exports: {} }
  let saveSucceeds = false
  vm.runInNewContext(output, {
    module, exports: module.exports, Error,
    require(specifier) {
      if (specifier === 'react') return fakeReact
      if (specifier === 'react/jsx-runtime') return nativeRequire(specifier)
      if (specifier === 'next/navigation') return { useRouter: () => ({ refresh: () => refreshes++ }) }
      if (!modules.has(specifier)) {
        const name = specifier.split('/').at(-1)
        modules.set(specifier, { [name]: function Component() {} })
      }
      return modules.get(specifier)
    },
    fetch: async () => { if (!saveSucceeds) throw new Error('Offline'); return { ok: true, json: async () => ({ success: true }) } },
  })
  const render = () => { cursor = 0; return module.exports.default({ clientId: 'qa-client' }) }
  function nodes(node) {
    if (!node || typeof node !== 'object') return []
    const children = Array.isArray(node.props?.children) ? node.props.children.flat(Infinity) : [node.props?.children]
    return [node, ...children.flatMap(nodes)]
  }
  let tree = render()
  let button = nodes(tree).find(node => node.props.children === 'Save recovery activity')
  assert.equal(button.props.disabled, true)
  assert.equal(button.props['aria-describedby'], 'qa-completion-hint')
  assert.ok(nodes(tree).some(node => node.props?.children === 'Choose a recovery activity above to save it.'))
  nodes(tree).find(node => node.props.children === 'Mobility').props.onClick()
  tree = render()
  button = nodes(tree).find(node => node.props.children === 'Save recovery activity')
  assert.equal(button.props.disabled, false)
  await button.props.onClick()
  tree = render()
  assert.equal(nodes(tree).find(node => node.props.children === 'Save recovery activity').props.disabled, false)
  assert.ok(nodes(tree).some(node => node.props?.children === 'Offline'))
  saveSucceeds = true
  await nodes(tree).find(node => node.props.children === 'Save recovery activity').props.onClick()
  tree = render()
  assert.ok(nodes(tree).some(node => node.props?.children === 'Recovery saved for today.'))
  assert.equal(refreshes, 1)
})

test('food suggestions keep log ownership and authentication protection', async () => {
  globalThis.nutritionRecoveryTestClient = database({ signedIn: false })
  assert.equal((await suggestedRoute.GET(new Request('http://test/api/nutrition/suggested-foods?nutritionLogId=qa-log'))).status, 401)
  globalThis.nutritionRecoveryTestClient = database({ owner: 'another-user' })
  assert.equal((await suggestedRoute.GET(new Request('http://test/api/nutrition/suggested-foods?nutritionLogId=qa-log'))).status, 403)
})

test('view preferences survive revisits, reject invalid values, and stay client scoped', () => {
  const rows = new Map()
  const storage = { getItem: key => rows.get(key) ?? null, setItem: (key, value) => rows.set(key, value) }
  const key = preference.viewPreferenceKey('qa-client', 'nutrition-intake')
  preference.writeViewPreference(storage, key, 'water')
  assert.equal(preference.readViewPreference(storage, key, ['water', 'meal', 'suggested'], 'meal'), 'water')
  assert.equal(preference.readViewPreference(storage, preference.viewPreferenceKey('another-client', 'nutrition-intake'), ['water', 'meal'], 'meal'), 'meal')
  preference.writeViewPreference(storage, key, 'invalid')
  assert.equal(preference.readViewPreference(storage, key, ['water', 'meal'], 'meal'), 'meal')
  const blocked = { getItem() { throw new Error('Blocked') }, setItem() { throw new Error('Blocked') } }
  assert.equal(preference.readViewPreference(blocked, key, ['water', 'meal'], 'meal'), 'meal')
  assert.doesNotThrow(() => preference.writeViewPreference(blocked, key, 'water'))
})

test('zero-log nutrition hero provides an actionable food starting point across tiers', () => {
  const nativeRequire = createRequire(import.meta.url)
  const module = { exports: {} }
  const output = ts.transpileModule(readFileSync('components/AdaptiveNutritionDashboard.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  const mocks = {
    '@/lib/supabase/client': { createClient: () => ({}) },
    '@/components/hydration/HydrationQuickAdd': { __esModule: true, default: () => null },
    '@/components/NutritionFoodLogger': { __esModule: true, default: () => null },
    '@/components/nutrition/MicronutrientProgressRing': { __esModule: true, default: () => null },
    'next/navigation': { useRouter: () => ({ refresh() {} }) },
    '@/components/nutrition/hooks': { useNutritionEngine: logic => logic.nutrition, useFuelReadinessEngine: logic => logic.fuelReadiness, usePhoenixRecipes: recipes => recipes },
    '@/lib/nutrition/canLogFood': tierHelpers,
    '@/lib/timezone': timezone,
    '@/lib/entitlements': { getTierCapabilities },
    '@/lib/nutrition/mealPeriod': {},
    '@/lib/analytics': { trackEvent() {} },
    '@/components/dashboard/useViewPreference': { useViewPreference: (_clientId, _scope, _allowed, fallback) => [fallback, () => {}] },
    '@/lib/nutrition/nextFoodGuidance': nextFoodGuidance,
    '@/lib/nutrition/progress': nutritionProgress,
    '@/lib/nutrition/micronutrientProgress': micronutrientProgress,
    '@/lib/nutrition/memberNutrition': memberNutrition,
  }
  vm.runInNewContext(output, { module, exports: module.exports, require: specifier => mocks[specifier] || nativeRequire(specifier) })
  for (const program of ['ember', 'ignite', 'phoenix']) {
    const macro = { target: 100, remaining: 100 }
    const logic = { program, client: { id: 'qa-client', program }, trends: [],
      nutrition: { dataStatus: 'needs_input', mealSuggestions: ['Log the next meal to calculate what remains.'], calories: macro, protein: macro, carbs: macro, fats: macro },
      fuelReadiness: { displayStatus: 'Needs input', reasoning: 'No food is logged yet.' },
      hydration: { consumed: 0, target: 100, recoverySupportNote: 'QA' },
    }
    const html = renderToStaticMarkup(React.createElement(module.exports.default, { program, logic, recipes: [] }))
    const hero = html.match(/<article[^>]*data-testid="nutrition-objective"[\s\S]*?<\/article>/)?.[0]
    assert.ok(hero)
    assert.doesNotMatch(hero, /Log the next meal to calculate/)
    assert.match(hero, /Explore Suggested Foods/)
    assert.match(hero, /No prior meal logs needed/)
  }
})

test('next food guidance uses current food suggestions without requiring or inventing prior intake', () => {
  const guidance = nextFoodGuidance.getNextFoodGuidance({ dataStatus: 'needs_input', mealSuggestions: ['Log the next meal to calculate what remains.'], suggestedFoods: [{ name: 'Black beans', serving: '100 g' }] })
  assert.match(guidance.copy, /Black beans \(100 g\)/)
  assert.match(guidance.copy, /No prior meal logs needed/)
  assert.doesNotMatch(guidance.copy, /deficit|deficiency|already ate|Log the next meal/)
  assert.equal(guidance.showSuggestedAction, true)
  const known = nextFoodGuidance.getNextFoodGuidance({ dataStatus: 'known', mealSuggestions: ['Choose the easiest protein-forward meal available.'], suggestedFoods: [] })
  assert.equal(known.copy, 'Choose the easiest protein-forward meal available.')
})
