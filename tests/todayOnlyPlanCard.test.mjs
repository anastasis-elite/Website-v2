import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
function page(path, mocks) {
  const module = { exports: {} }
  const { outputText } = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  })
  runInNewContext(outputText, { module, exports: module.exports, process: { env: { NODE_ENV: 'test' } }, require(name) {
    if (Object.hasOwn(mocks, name)) return mocks[name]
    // Detail pages must not load the general next-step card or its schedule service.
    if (name.startsWith('@/')) throw new Error(`Unexpected detail-page dependency: ${name}`)
    return require(name)
  } })
  return module.exports.default
}

const component = name => ({ __esModule: true, default: name })

test('Nutrition opens its own dashboard for every tier without the general plan card or a schedule fetch', async () => {
  for (const tier of ['ember', 'ignite', 'phoenix']) {
    const logic = { program: tier }, recipes = [{ id: 'saved-recipe' }]
    const Page = page('app/dashboard/nutrition/page.tsx', {
      './NutritionDashboardClient': component('nutrition-dashboard'),
      '@/lib/dashboard/getDashboardContext': { getDashboardContext: async () => ({ supabase: {}, client: { client_id: 'fixture-owner', program: tier }, user: { id: 'fixture-user' } }) },
      '@/lib/safety/getRecentSafetyFlags': { getRecentSafetyFlags: async () => [] },
      '@/components/legal/SafetyEscalationNotice': component('safety-notice'),
      '@/lib/nutrition/recipes/getPhoenixRecipeRecommendations': { getPhoenixRecipeRecommendations: () => recipes },
      '@/lib/dashboard/logic/getProgramLogicForClient': { getProgramLogicForClient: async () => logic },
      '@/lib/entitlements': { getTierCapabilities: () => ({ tier, nutritionRecommendedMeal: tier === 'phoenix' }) },
      '@/lib/nutrition/loggingIntent': { parseNutritionLoggingIntent: () => ({ action: null }) },
      '@/components/nutrition/DirectNutritionEntry': component('direct-entry'),
      '@/lib/nutrition/directEntry': {}, '@/lib/timezone': {}, '@/lib/nutrition/mealPeriod': {}, '@/lib/nutrition/recipes/catalog': {},
      '@/components/phone-app/PhoneAppFrame': component('phone-frame'),
    })
    const tree = await Page({ searchParams: Promise.resolve({}) })
    assert.equal(tree.type, 'phone-frame')
    assert.equal(tree.props.children.type, 'nutrition-dashboard')
    assert.equal(tree.props.children.props.logic, logic)
    assert.deepEqual([...tree.props.children.props.recipes], tier === 'phoenix' ? recipes : [])
  }
})

test('Recovery opens its own dashboard and retains saved recovery data for every tier without a general plan card or schedule fetch', async () => {
  for (const tier of ['ember', 'ignite', 'phoenix']) {
    const reads = [], logic = { program: tier }
    const todayLog = { sleep_hours: 8, energy_level: 4 }, activity = { id: 'saved-practice', activity_type: 'breathing' }
    const supabase = { from(table) {
      reads.push(table)
      const result = { data: table === 'recovery_activity_logs' ? [activity] : [todayLog] }
      const query = { select: () => query, eq: () => query, gte: () => query, lte: () => query,
        order: () => query, limit: () => query, maybeSingle: async () => ({ data: todayLog }),
        then: resolve => Promise.resolve(result).then(resolve) }
      return query
    } }
    const Page = page('app/dashboard/recovery/page.tsx', {
      '@/lib/dashboard/getDashboardContext': { getDashboardContext: async () => ({ supabase, client: { client_id: 'fixture-owner', program: tier }, user: { id: 'fixture-user' } }) },
      '@/lib/dashboard/logic/getProgramLogicForClient': { getProgramLogicForClient: async () => logic },
      '@/components/recovery/RecoveryDashboardClient': component('recovery-dashboard'),
      '@/lib/timezone': { getClientLocalDateOffset: () => '2026-10-29' },
      '@/lib/recovery/sorenessRegions': { isSorenessRegionKey: () => false },
      '@/components/phone-app/PhoneAppFrame': component('phone-frame'),
    })
    const tree = await Page()
    assert.equal(tree.type, 'phone-frame')
    const dashboard = tree.props.children
    assert.equal(dashboard.type, 'recovery-dashboard')
    assert.equal(dashboard.props.logic, logic)
    assert.equal(dashboard.props.program, tier)
    assert.equal(dashboard.props.checkInInitial.sleepHours, 8)
    assert.equal(dashboard.props.recentActivities[0], activity)
    assert.deepEqual(reads, ['recovery_logs', 'recovery_logs', 'recovery_activity_logs'])
  }
})
