import assert from 'node:assert/strict'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'

assert.equal(process.env.PACKAGE_A_TEST_ISOLATED, '1', 'Run through the synthetic isolation guard.')
const mocks = {
  'next/server': 'export const NextResponse={json:(body,init)=>Response.json(body,init)}',
  '@/lib/supabase/server': 'export const createClient=async()=>globalThis.intelligenceFixture',
}
const insightsRoute = await importTs('app/api/nutrition/nutrient-insights/route.ts', mocks)
const supplementRoute = await importTs('app/api/nutrition/supplement-recommendation/route.ts', mocks)
const insightService = await importTs('lib/nutrition/getNutrientInsights.ts')
const supplementService = await importTs('lib/nutrition/getSupplementRecommendation.ts')
const owner = 'synthetic-owner', clientId = 'LOCAL-INTELLIGENCE-QA'
const user = { id: owner, email: 'qa@example.invalid', app_metadata: { role: 'admin' } }
const clone = value => structuredClone(value)
const field = (row, key) => key.split('.').reduce((value, part) => value?.[part], row)

function fixture(program = 'ember', { proteinGap = true, clinicalConcern = false, proteinAvailable = true } = {}) {
  const today = new Date().toISOString().slice(0, 10)
  const dates = Array.from({ length: 14 }, (_, index) => new Date(Date.parse(today + 'T12:00Z') - (13 - index) * 86400000).toISOString().slice(0, 10))
  const client = { client_id: clientId, auth_user_id: owner, program }
  const tables = {
    clients: [client],
    nutrition_logs: dates.map((date, index) => ({ id: `log-${index}`, client_id: clientId, auth_user_id: owner, log_date: date, protein: 100, magnesium_target_mg: 320, completed: true })),
    nutrition_log_remaining: dates.map((date, index) => ({ nutrition_log_id: `log-${index}`, client_id: clientId, log_date: date, protein_remaining_g: proteinGap ? 80 : 0, magnesium_remaining_mg: 240 })),
    recovery_logs: dates.map(date => ({ client_id: clientId, log_date: date, soreness_level: 8, sleep_quality: 4, energy_level: 8, stress_level: 2 })),
    cycle_daily_symptoms: [],
    supplements: [
      { id: 'micro-product', product_name: 'Magnesium Product', status: 'active', recommendation_copy: 'Magnesium-specific guidance' },
      { id: 'protein-product', product_name: 'Protein Product', status: 'active', recommendation_copy: 'Magnesium and vitamin-specific catalog copy', contraindication_metadata: { upperIntakeConcernNutrients: ['magnesium'] } },
    ],
    supplement_ingredients: [
      { id: 'micro-ingredient', supplement_id: 'micro-product', ingredient_key: 'magnesium' },
      ...(proteinAvailable ? [{ id: 'protein-ingredient', supplement_id: 'protein-product', ingredient_key: 'whey' }] : []),
    ],
    ingredient_nutrients: [
      { supplement_ingredient_id: 'micro-ingredient', nutrients: { nutrient_key: 'magnesium' } },
      ...(proteinAvailable ? [{ supplement_ingredient_id: 'protein-ingredient', nutrients: { nutrient_key: 'protein' } }] : []),
    ],
    supplement_supported_functions: [
      { supplement_id: 'micro-product', function_key: 'sleep' },
      { supplement_id: 'protein-product', function_key: 'recovery' },
    ],
    client_anastasis_supplement_recommendations: [
      { id: 'stored-micro-recommendation', user_id: owner, client_id: clientId, supplement_id: 'micro-product', status: 'active', resolved_at: null },
      { id: 'stored-protein-recommendation', user_id: owner, client_id: clientId, supplement_id: 'protein-product', status: 'active', resolved_at: null, algorithm_version: 'supplement_recommendation_v1.0.0:protein' },
    ],
    client_nutrient_recommendations: clinicalConcern ? [{ user_id: owner, client_id: clientId, status: 'active', safety_escalation_reason: 'estimated_intake_above_established_ul', nutrients: { nutrient_key: 'magnesium' } }] : [],
    supplement_recommendation_engine_config: [], meal_entries: [], macro_entries: [],
    nutrients: [{ id: 'magnesium-id', nutrient_key: 'magnesium', canonical_name: 'Magnesium', default_unit: 'mg' }],
    client_symptom_logs: [], cycle_burden_scores: [], nutrient_reference_values: [], nutrient_symptom_relationships: [], nutrient_interactions: [], client_nutrient_clinical_records: [], client_supplement_intake_logs: [],
  }
  const reads = [], writes = []
  const db = { tables, reads, writes, user, clientError: false,
    auth: { getUser: async () => ({ data: { user: db.user }, error: null }) },
    from(table) {
      assert.ok(table in tables, `Unexpected synthetic table: ${table}`)
      let selection = '*', filters = [], ordering, maximum, mutation, payload
      const query = {
        select(value) { selection = value; return query },
        eq(key, value) { filters.push([key, 'eq', value]); return query },
        in(key, values) { filters.push([key, 'in', values]); return query },
        gte(key, value) { filters.push([key, 'gte', value]); return query },
        lte(key, value) { filters.push([key, 'lte', value]); return query },
        order(key, options) { ordering = [key, options?.ascending !== false]; return query },
        limit(value) { maximum = value; return query },
        upsert(value) { mutation = 'upsert'; payload = value; return query },
        update(value) { mutation = 'update'; payload = value; return query },
        maybeSingle() { return execute(true) },
        then(resolve, reject) { return execute(false).then(resolve, reject) },
      }
      async function execute(single) {
        const matches = row => filters.every(([key, op, value]) => op === 'eq' ? field(row, key) === value : op === 'in' ? value.includes(field(row, key)) : op === 'gte' ? field(row, key) >= value : field(row, key) <= value)
        if (table === 'clients' && db.clientError) return { data: null, error: { message: 'Synthetic owner read failed' } }
        if (mutation) {
          writes.push({ table, mutation, payload: clone(payload), filters: clone(filters) })
          if (mutation === 'update') for (const row of tables[table].filter(matches)) Object.assign(row, clone(payload))
          return { data: null, error: null }
        }
        reads.push({ table, selection, filters: clone(filters) })
        let rows = tables[table].filter(matches)
        if (ordering) rows = [...rows].sort((a, b) => String(a[ordering[0]]).localeCompare(String(b[ordering[0]])) * (ordering[1] ? 1 : -1))
        if (maximum) rows = rows.slice(0, maximum)
        return { data: clone(single ? rows[0] || null : rows), error: null }
      }
      return query
    },
  }
  globalThis.intelligenceFixture = db
  return db
}
const request = (route, extra = '') => new Request(`http://qa.invalid/api/nutrition/${route}?clientId=${clientId}${extra}`)
const supplement = (db, overrides = {}) => supplementService.getSupplementRecommendation({ supabase: db, user: db.user, client: { client_id: clientId, program: 'phoenix' }, includeAdminDebug: true, ...overrides })

test('direct nutrient insight API rejects EMBER and unknown stored tiers despite spoofed query or user metadata', async () => {
  for (const tier of ['ember', null, 'unknown']) {
    const db = fixture(tier); db.user = { ...user, user_metadata: { program: 'phoenix' } }
    const response = await insightsRoute.GET(request('nutrient-insights', '&program=phoenix&tier=ignite'))
    assert.equal(response.status, 403)
    assert.deepEqual(db.reads.map(read => read.table), ['clients'])
    assert.deepEqual(db.writes, [])
  }
})

test('insight service independently derives ownership and stored tier before catalog or clinical reads', async () => {
  for (const scenario of ['ember', 'unknown', 'foreign', 'unavailable']) {
    const db = fixture(scenario === 'unknown' ? null : 'ember')
    if (scenario === 'foreign') db.tables.clients[0].auth_user_id = 'other-owner'
    if (scenario === 'unavailable') db.clientError = true
    assert.deepEqual(await insightService.getNutrientInsights({ supabase: db, userId: owner, clientId }), [])
    assert.ok(db.reads.every(read => read.table === 'clients'))
    assert.deepEqual(db.writes, [])
  }
})

test('IGNITE and PHOENIX keep nutrient insight APIs and catalogs', async () => {
  for (const tier of ['ignite', 'phoenix']) {
    const db = fixture(tier)
    const response = await insightsRoute.GET(request('nutrient-insights'))
    assert.equal(response.status, 200)
    assert.equal((await response.json()).insights[0].nutrientKey, 'magnesium')
    assert.ok(db.reads.some(read => read.table === 'nutrient_reference_values'))
  }
})

test('both APIs reject unauthenticated and foreign-owned clients before intelligence reads or writes', async () => {
  for (const route of [insightsRoute, supplementRoute]) {
    const anonymous = fixture('phoenix'); anonymous.user = null
    assert.equal((await route.GET(request('intelligence'))).status, 401)
    assert.equal(anonymous.reads.length, 0)
    const foreign = fixture('phoenix'); foreign.tables.clients[0].auth_user_id = 'other-owner'
    assert.equal((await route.GET(request('intelligence'))).status, 404)
    assert.deepEqual(foreign.reads.map(read => read.table), ['clients'])
    assert.deepEqual(foreign.writes, [])
  }
})

test('EMBER supplement service ignores a supplied higher tier, preserves mapped protein matches and avoids micronutrient guidance', async () => {
  const db = fixture('ember')
  const history = clone(db.tables.client_anastasis_supplement_recommendations[0])
  const result = await supplement(db)
  assert.equal(result.recommendation.productId, 'protein-product')
  assert.match(result.recommendation.why.nutrition, /protein/)
  assert.doesNotMatch(JSON.stringify(result), /magnesium|vitamin|micro-product/i)
  assert.deepEqual(result.debug.recurringNutrientPatterns.map(row => row.nutrientKey), ['protein'])
  assert.ok(db.reads.filter(read => read.table === 'nutrition_logs').every(read => read.selection === 'id,log_date,protein,completed'))
  assert.ok(db.reads.filter(read => read.table === 'nutrition_log_remaining').every(read => read.selection === 'nutrition_log_id,protein_remaining_g'))
  assert.ok(db.reads.filter(read => read.table === 'ingredient_nutrients').every(read => read.filters.some(([key, op, value]) => key === 'nutrients.nutrient_key' && op === 'eq' && value === 'protein')))
  assert.deepEqual(db.tables.client_anastasis_supplement_recommendations[0], history)
  assert.equal(db.writes.length, 1)
  assert.equal(db.writes[0].payload.supplement_id, 'protein-product')
  assert.equal(db.writes[0].payload.algorithm_version, 'supplement_recommendation_v1.0.0:protein')
})

test('EMBER micro-only gaps do not qualify advice or mutate retained micro recommendation history', async () => {
  const db = fixture('ember', { proteinGap: false })
  const history = clone(db.tables.client_anastasis_supplement_recommendations[0])
  const result = await supplement(db)
  assert.equal(result.recommendation, null)
  assert.deepEqual(result.debug.recurringNutrientPatterns, [])
  assert.deepEqual(db.tables.client_anastasis_supplement_recommendations[0], history)
  assert.ok(db.writes.every(write => write.table === 'client_anastasis_supplement_recommendations' && write.filters.some(([key, op, values]) => key === 'id' && op === 'in' && values.every(value => value === 'stored-protein-recommendation'))))
  const none = fixture('ember', { proteinAvailable: false })
  assert.deepEqual(await supplement(none), { recommendation: null, resolvedRecommendations: [], debug: null, nutritionScope: 'protein' })
  assert.deepEqual(none.writes, [])
})

test('existing clinical safety suppression still applies to EMBER protein products without exposing micro flags', async () => {
  const db = fixture('ember', { clinicalConcern: true })
  const result = await supplement(db)
  assert.equal(result.recommendation, null)
  assert.ok(result.debug.reasonCodes.includes('safety_suppressed'))
  assert.doesNotMatch(JSON.stringify(result), /magnesium|estimated_intake_above_established_ul/i)
  assert.ok(db.reads.some(read => read.table === 'client_nutrient_recommendations'))
})

test('EMBER never overwrites or resolves legacy mixed-product history with an unknown nutrient basis', async () => {
  for (const proteinGap of [true, false]) {
    const db = fixture('ember', { proteinGap })
    db.tables.client_anastasis_supplement_recommendations[1].algorithm_version = 'supplement_recommendation_v1.0.0'
    const history = clone(db.tables.client_anastasis_supplement_recommendations)
    const result = await supplement(db)
    assert.equal(Boolean(result.recommendation), proteinGap)
    assert.deepEqual(db.tables.client_anastasis_supplement_recommendations, history)
    assert.deepEqual(db.writes, [])
  }
})

test('direct protein ingredients remain supported without catalog nutrient mappings', async () => {
  const db = fixture('ember')
  db.tables.supplement_ingredients[1].ingredient_key = 'protein'
  db.tables.ingredient_nutrients = db.tables.ingredient_nutrients.filter(row => row.nutrients.nutrient_key !== 'protein')
  assert.equal((await supplement(db)).recommendation.productId, 'protein-product')
})

test('unknown tiers fail closed to protein-only and existing stored contraindications still suppress', async () => {
  for (const program of [null, 'unknown']) {
    const db = fixture(program)
    const result = await supplement(db)
    assert.equal(result.nutritionScope, 'protein')
    assert.deepEqual(result.debug.recurringNutrientPatterns.map(row => row.nutrientKey), ['protein'])
  }
  const contraindicated = fixture('ember')
  contraindicated.tables.clients[0].reproductive_status = 'pregnant'
  contraindicated.tables.supplements[1].contraindication_metadata.suppressWhen = ['pregnancy_or_breastfeeding']
  assert.equal((await supplement(contraindicated, { client: { client_id: clientId, program: 'phoenix', reproductive_status: 'not_tracking' } })).recommendation, null)
  const unavailable = fixture('phoenix'); unavailable.clientError = true
  assert.deepEqual(await supplement(unavailable), { recommendation: null, resolvedRecommendations: [], debug: null, nutritionScope: 'unavailable' })
  assert.deepEqual(unavailable.writes, [])
})

test('editable user metadata and debug query never grant member debug privileges', async () => {
  const db = fixture('ember')
  db.user = { id: owner, email: 'member@example.invalid', app_metadata: {}, user_metadata: { role: 'admin', program: 'phoenix' } }
  const response = await supplementRoute.GET(request('supplement-recommendation', '&debug=1&program=phoenix'))
  const result = await response.json()
  assert.equal(result.nutritionScope, 'protein')
  assert.equal(result.debug, null)
})

test('IGNITE and PHOENIX retain existing micronutrient and protein engine inputs', async () => {
  for (const tier of ['ignite', 'phoenix']) {
    const db = fixture(tier)
    const result = await supplement(db)
    assert.ok(result.recommendation)
    assert.ok(result.debug.recurringNutrientPatterns.some(row => row.nutrientKey === 'magnesium'))
    assert.ok(result.debug.recurringNutrientPatterns.some(row => row.nutrientKey === 'protein'))
    assert.ok(db.reads.some(read => read.table === 'nutrition_logs' && read.selection === '*'))
  }
})

test('direct supplement API keeps EMBER protein support and does not trust tier spoofing', async () => {
  const db = fixture('ember')
  const response = await supplementRoute.GET(request('supplement-recommendation', '&program=phoenix&tier=phoenix&debug=1'))
  assert.equal(response.status, 200)
  const result = await response.json()
  assert.equal(result.recommendation.productId, 'protein-product')
  assert.doesNotMatch(JSON.stringify(result), /magnesium|vitamin|micro-product/i)
  const foreign = fixture('phoenix'); foreign.tables.clients[0].auth_user_id = 'another-user'
  assert.deepEqual(await supplement(foreign), { recommendation: null, resolvedRecommendations: [], debug: null, nutritionScope: 'unavailable' })
  assert.ok(foreign.reads.every(read => read.table === 'clients'))
  assert.deepEqual(foreign.writes, [])
})
