import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test, { after, mock } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'
import { renderToStaticMarkup } from 'react-dom/server'
import { importTs } from './typescriptModule.mjs'

mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-13T17:00:00.000Z') })
after(() => mock.timers.reset())

const mocks = {
  'next/server': 'export const NextResponse = { json: (body, init) => Response.json(body, init) }',
  '@/lib/supabase/server': 'export const createClient = async () => globalThis.nutritionPersistenceDb',
  '@/lib/dashboard/invalidateDailyPlan': 'export const invalidateDailyPlan = () => {}',
}
const macrosRoute = await importTs('app/api/nutrition/add-macros/route.ts', mocks)
const progress = await importTs('lib/nutrition/progress.ts')
const entitlements = await importTs('lib/entitlements.ts')
const tiers = await importTs('lib/nutrition/canLogFood.ts')
const timezone = await importTs('lib/timezone.ts')
const nextFood = await importTs('lib/nutrition/nextFoodGuidance.ts')
const { getDailyExecutionPlan } = await importTs('lib/day/getDailyExecutionPlan.ts')
const { calculateClientNutritionTargets } = await importTs('lib/nutrition/targetService.ts')
const { buildWhatsNextState } = await importTs('lib/dashboard/whatsNext.ts')
const client = { client_id: 'QA-MACROS', auth_user_id: 'qa-owner', program: 'ember', timezone: 'America/Chicago', birthdate: '1990-01-01' }
const log = { id: 'qa-log', client_id: client.client_id, auth_user_id: client.auth_user_id, log_date: '2026-10-13', calories: 2000, protein: 100, carbs: 250, fats: 60, water_oz: 100 }

function database({ program = 'ember', store, failTable } = {}) {
  const tables = structuredClone(store || {
    clients: [{ ...client, program }],
    nutrition_logs: [log],
    cycle_logs: [{ client_id: client.client_id, log_date: log.log_date, cycle_phase: 'luteal' }],
    macro_entries: [],
    meal_entries: [],
    nutrition_log_totals_by_block: [],
    // Production's remaining view sees meals only. It is intentionally stale for macros.
    nutrition_log_remaining: [{ nutrition_log_id: log.id, calories_remaining: 2000, protein_remaining_g: 100, carbs_remaining_g: 250, fat_remaining_g: 60, fiber_remaining_g: 25 }],
  })
  const reads = [], writes = []
  return {
    tables, reads, writes,
    auth: { getUser: async () => ({ data: { user: { id: client.auth_user_id } } }) },
    from(table) {
      const filters = []
      let insert, update, countOnly = false, selection = '*'
      const query = {
        select(columns = '*', options) { selection = columns; countOnly = Boolean(options?.head); return query },
        eq(key, value) { filters.push(row => row[key] === value); return query },
        in(key, values) { filters.push(row => values.includes(row[key])); return query },
        gte(key, value) { filters.push(row => row[key] >= value); return query },
        lte(key, value) { filters.push(row => row[key] <= value); return query },
        lt(key, value) { filters.push(row => row[key] < value); return query },
        order() { return query }, limit() { return query },
        insert(value) { insert = value; return query }, update(value) { update = value; return query },
        single() { return resolve(true) }, maybeSingle() { return resolve(true) },
        then(done, reject) { return resolve(false).then(done, reject) },
      }
      async function resolve(single) {
        reads.push({ table, selection })
        if (table === failTable) return { data: null, error: { message: 'QA read failed' } }
        if (table === 'cycle_logs' && selection === 'phase') return { data: null, error: { message: 'column cycle_logs.phase does not exist' } }
        tables[table] ||= []
        if (insert) {
          const value = { id: 'qa-macro-' + tables[table].length, ...structuredClone(insert) }
          tables[table].push(value); writes.push({ table, value })
          return { data: value, error: null }
        }
        const rows = tables[table].filter(row => filters.every(filter => filter(row)))
        if (update) for (const row of rows) Object.assign(row, update)
        return { data: countOnly ? null : structuredClone(single ? rows[0] || null : rows), count: rows.length, error: null }
      }
      return query
    },
  }
}

function dashboard(db) {
  const states = [], callbacks = []
  let cursor = 0
  const nativeRequire = createRequire(import.meta.url)
  const module = { exports: {} }
  const fakeReact = {
    useMemo: callback => callback(), useEffect() {},
    useCallback(callback) { callbacks.push(callback); return callback },
    useState(initial) {
      const index = cursor++
      if (!(index in states)) states[index] = initial
      return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value }]
    },
  }
  const dependencies = {
    react: fakeReact,
    '@/lib/supabase/client': { createClient: () => db },
    '@/components/hydration/HydrationQuickAdd': { default: () => null },
    '@/components/NutritionFoodLogger': { default: () => null },
    'next/navigation': { useRouter: () => ({ refresh() {} }) },
    '@/components/nutrition/hooks': { useNutritionEngine: value => value.nutrition, useFuelReadinessEngine: value => value.fuelReadiness, usePhoenixRecipes: values => values },
    '@/lib/nutrition/canLogFood': tiers,
    '@/lib/timezone': timezone,
    '@/lib/entitlements': entitlements,
    '@/lib/nutrition/mealPeriod': {},
    '@/lib/analytics': { trackEvent() {} },
    '@/components/dashboard/useViewPreference': { useViewPreference: (_id, _scope, _allowed, fallback) => [fallback, () => {}] },
    '@/lib/nutrition/nextFoodGuidance': nextFood,
    '@/lib/nutrition/progress': progress,
  }
  const compiled = ts.transpileModule(readFileSync('components/AdaptiveNutritionDashboard.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  vm.runInNewContext(compiled, { module, exports: module.exports, Date, Error, Promise, console, process: { env: { NODE_ENV: 'test' } }, require: name => dependencies[name] || nativeRequire(name) })
  const metric = { target: 100, remaining: 100 }
  const logic = { program: 'ember', client: { id: client.client_id, ...client }, trends: [],
    nutrition: { dataStatus: 'needs_input', mealSuggestions: ['Review your next meal.'], calories: { target: 2000, remaining: 2000 }, protein: metric, carbs: metric, fats: metric },
    fuelReadiness: { displayStatus: 'Needs input', reasoning: 'No food is logged yet.' },
    hydration: { consumed: 0, target: 100 },
  }
  function render() { cursor = 0; return renderToStaticMarkup(module.exports.default({ program: 'ember', logic, recipes: [] })) }
  render()
  return { render, load: () => callbacks.find(callback => callback.toString().includes(".from('nutrition_logs')"))() }
}

test('saved EMBER macros survive a fresh transport and update Nutrition, daily blocks, and What’s Next once', async () => {
  const db = database()
  globalThis.nutritionPersistenceDb = db
  const response = await macrosRoute.POST(new Request('http://qa.test/api/nutrition/add-macros', {
    method: 'POST', body: JSON.stringify({ nutritionLogId: log.id, calories: 500, protein: 30, carbs: 50, fats: 15, mealPeriod: 'lunch' }),
  }))
  assert.equal(response.status, 200)
  const saved = await response.json()
  assert.equal(saved.remaining.calories_remaining, 1500)
  assert.equal(saved.remaining.protein_remaining_g, 70)
  assert.equal(saved.remaining.fiber_remaining_g, 25)
  assert.equal(db.tables.macro_entries.length, 1)
  const reloaded = database({ store: db.tables })
  const plan = await getDailyExecutionPlan({ supabase: reloaded, client })
  assert.equal(plan.nutritionLogged, true)
  assert.deepEqual(plan.dailyRemaining, { calories: 1500, protein: 70, carbs: 200, fats: 45, water: 100 })
  const midday = plan.cards.find(card => card.id === 'midday')
  assert.equal(midday.macroTarget.calories, 300)
  assert.equal(midday.macroTarget.protein, 10)
  assert.equal(plan.cards.find(card => card.id === 'morning').macroTarget.calories, 600)
  const next = buildWhatsNextState({ tier: 'ember', capabilities: entitlements.getTierCapabilities('ember'),
    logic: { nutrition: { protein: { remaining: plan.dailyRemaining.protein }, carbs: { remaining: plan.dailyRemaining.carbs }, fats: { remaining: plan.dailyRemaining.fats } } },
    schedule: { nextAction: { category: 'meal' }, events: [] },
  })
  assert.match(next.subtitle, /70g protein · 200g carbs · 45g fat/)
  const page = dashboard(reloaded)
  await page.load()
  assert.match(page.render(), /500 \/ 2000 cal/)
  assert.match(page.render(), /1500 cal remaining/)
  const freshPage = dashboard(database({ store: db.tables }))
  await freshPage.load()
  assert.match(freshPage.render(), /500 \/ 2000 cal/)
})

test('confirmed meal totals and macro entries combine without counting tentative meals or re-subtracting a combined response', async () => {
  const db = database()
  db.tables.meal_entries.push({ id: 'confirmed', nutrition_log_id: log.id, entry_state: 'confirmed' }, { id: 'tentative', nutrition_log_id: log.id, entry_state: 'tentative' })
  db.tables.nutrition_log_totals_by_block.push({ nutrition_log_id: log.id, day_block: 'morning', calories_eaten: 300, protein_eaten_g: 20, carbs_eaten_g: 35, fat_eaten_g: 8 })
  db.tables.macro_entries.push({ nutrition_log_id: log.id, day_block: 'morning', calories: 200, protein_g: 10, carbs_g: 25, fat_g: 7 })
  const recorded = await progress.loadRecordedNutrition(db, log.id)
  const first = progress.nutritionRemainingWithRecordedIntake(log, { calories_remaining: 1700, fiber_remaining_g: 20 }, recorded)
  const again = progress.nutritionRemainingWithRecordedIntake(log, first, recorded)
  assert.deepEqual(again, first)
  assert.equal(first.calories_remaining, 1500)
  assert.equal(first.fiber_remaining_g, 20)
  const plan = await getDailyExecutionPlan({ supabase: db, client })
  assert.equal(plan.dailyRemaining.calories, 1500)
  assert.equal(plan.cards.find(card => card.id === 'morning').macroTarget.calories, 100)
  db.tables.meal_entries = [{ id: 'tentative', nutrition_log_id: log.id, entry_state: 'tentative' }]
  db.tables.macro_entries = []
  db.tables.nutrition_log_totals_by_block = []
  assert.equal((await getDailyExecutionPlan({ supabase: db, client })).nutritionLogged, false)
})

test('cycle-aware nutrition reads the actual cycle_phase column', async () => {
  const db = database()
  const result = await calculateClientNutritionTargets({ supabase: db, clientId: client.client_id, program: 'ember' })
  assert.equal(result.phase, 'luteal')
  assert.deepEqual(db.reads.filter(read => read.table === 'cycle_logs').map(read => read.selection), ['cycle_phase'])
})

test('non-EMBER macro submissions are denied before writes, matching production RLS', async () => {
  for (const program of ['ignite', 'phoenix']) {
    const db = database({ program })
    globalThis.nutritionPersistenceDb = db
    const response = await macrosRoute.POST(new Request('http://qa.test/api/nutrition/add-macros', {
      method: 'POST', body: JSON.stringify({ nutritionLogId: log.id, calories: 100 }),
    }))
    assert.equal(response.status, 403)
    assert.equal(db.writes.length, 0)
  }
})

test('a failed progress reload after a saved macro returns success with degraded status instead of inviting duplicate save', async t => {
  t.mock.method(console, 'error', () => {})
  const db = database({ failTable: 'nutrition_log_totals_by_block' })
  globalThis.nutritionPersistenceDb = db
  const response = await macrosRoute.POST(new Request('http://qa.test/api/nutrition/add-macros', {
    method: 'POST', body: JSON.stringify({ nutritionLogId: log.id, calories: 100 }),
  }))
  const result = await response.json()
  assert.equal(response.status, 200)
  assert.equal(result.success, true)
  assert.equal(result.refreshStatus, 'degraded')
  assert.equal(result.remaining, null)
  assert.equal(db.tables.macro_entries.length, 1)
  await assert.rejects(progress.loadRecordedNutrition(db, log.id), /could not be loaded/)
  const plan = await getDailyExecutionPlan({ supabase: db, client })
  assert.equal(plan.nutritionProgressAvailable, false)
  assert.equal(plan.macroTargetsMet, false)
  assert.equal(plan.nutritionLogged, false)
})
