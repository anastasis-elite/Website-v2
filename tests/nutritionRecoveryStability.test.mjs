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
const remaining = { calories_remaining: 1800, protein_remaining_g: 120, carbs_remaining_g: 200, fat_remaining_g: 60, fiber_remaining_g: 25 }
const foods = [
  { id: 'beans', name: 'Black beans', food_nutrients: { calories: 132, protein_g: 9, carbs_g: 24, fat_g: 1, fiber_g: 8 }, food_serving_options: [{ label: '100 g', is_default: true }] },
  { id: 'yogurt', name: 'Greek yogurt', food_nutrients: { calories: 90, protein_g: 18, carbs_g: 5, fat_g: 0, calcium_mg: 110 }, allergens: ['milk'] },
]

function database({ tier = 'ignite', owner = 'qa-user', snapshot = remaining, mealIds = [], catalog = foods, signedIn = true } = {}) {
  const rows = {
    nutrition_logs: [{ id: 'qa-log', client_id: 'qa-client', auth_user_id: owner }],
    clients: [{ client_id: 'qa-client', auth_user_id: 'qa-user', program: tier, allergies: ['milk'] }],
    nutrition_log_remaining: snapshot ? [snapshot] : [],
    meal_entries: mealIds.map(food_id => ({ food_id })), foods: catalog,
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

test('food ranking excludes logged foods, avoided foods, and supplement products', () => {
  const candidates = [
    { id: 'beans', name: 'Black beans', calories: 132, protein_g: 9, fiber_g: 8 },
    { id: 'yogurt', name: 'Greek yogurt', calories: 90, protein_g: 18, allergens: ['milk'] },
    { id: 'pill', name: 'Protein supplement capsule', calories: 90, protein_g: 20 },
  ]
  assert.deepEqual(buildSuggestedFoods({ remaining, candidates, loggedFoodIds: ['beans'], avoidTerms: ['milk'] }), [])
  assert.equal(buildSuggestedFoods({ remaining: null, candidates, avoidTerms: ['milk'] })[0].foodId, 'beans')
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
  let button = nodes(tree).find(node => node.props.children === 'Complete Recovery Action')
  assert.equal(button.props.disabled, true)
  assert.equal(button.props['aria-describedby'], 'qa-completion-hint')
  assert.ok(nodes(tree).some(node => node.props?.children === 'Choose a recovery action above to enable completion.'))
  nodes(tree).find(node => node.props.children === 'Mobility').props.onClick()
  tree = render()
  button = nodes(tree).find(node => node.props.children === 'Complete Recovery Action')
  assert.equal(button.props.disabled, false)
  await button.props.onClick()
  tree = render()
  assert.equal(nodes(tree).find(node => node.props.children === 'Complete Recovery Action').props.disabled, false)
  assert.ok(nodes(tree).some(node => node.props?.children === 'Offline'))
  saveSucceeds = true
  await nodes(tree).find(node => node.props.children === 'Complete Recovery Action').props.onClick()
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
    '@/components/hydration/HydrationQuickAdd': { default: () => null },
    '@/components/NutritionFoodLogger': { default: () => null },
    'next/navigation': { useRouter: () => ({ refresh() {} }) },
    '@/components/nutrition/hooks': { useNutritionEngine: logic => logic.nutrition, useFuelReadinessEngine: logic => logic.fuelReadiness, usePhoenixRecipes: recipes => recipes },
    '@/lib/nutrition/canLogFood': tierHelpers,
    '@/lib/timezone': {},
    '@/lib/entitlements': { getTierCapabilities },
    '@/lib/nutrition/mealPeriod': {},
    '@/lib/analytics': { trackEvent() {} },
    '@/components/dashboard/useViewPreference': { useViewPreference: (_clientId, _scope, _allowed, fallback) => [fallback, () => {}] },
    '@/lib/nutrition/nextFoodGuidance': nextFoodGuidance,
    '@/lib/nutrition/progress': nutritionProgress,
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
