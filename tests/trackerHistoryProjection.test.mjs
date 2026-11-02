import assert from 'node:assert/strict'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'

const route = await importTs('app/api/tracker/nutrition/route.ts', {
  'next/server': 'export const NextResponse={json:(body,init)=>Response.json(body,init)}',
  '@/lib/supabase/server': 'export const createClient=async()=>globalThis.trackerHistoryDb',
  '@/lib/analytics/server': 'export const recordConversion=async()=>false',
})
function fixture(program, expired = false) {
  const owner = 'synthetic-owner', calls = []
  const client = { client_id: 'owned', auth_user_id: owner, program, access: true, active: true, timezone: 'Etc/UTC', subscription_ends_at: expired ? '2020-01-01' : null }
  const log = { id: 'owned-log', client_id: 'owned', auth_user_id: owner, water_consumed_oz: 24, log_date: new Date().toISOString().slice(0, 10), calories: 1800,
    sodium_target_mg: 2000, iron: 10, meals: [{ name: 'stored premium meal', food_nutrients: { sodium: 123 } }], nutrition_calculation: { bmi: 23, safeguardsApplied: ['private coaching'] }, coaching: 'not an actual entry' }
  const entry = { id: 'entry', nutrition_log_id: log.id, auth_user_id: owner, calories: 200, protein_g: 10, carbs_g: 25, fat_g: 6, sodium: 555, meals: ['nested premium data'], nutrition_calculation: { bmi: 23 } }
  globalThis.trackerHistoryDb = { auth: { getUser: async () => ({ data: { user: { id: owner, email_confirmed_at: '2026-01-01' } } }) }, from(table) {
    const filters = [], call = { table, columns: null }; calls.push(call)
    const q = { select(columns) { call.columns = columns; return q }, eq(key, value) { filters.push(row => row[key] === value); return q }, order() { return q }, maybeSingle: async () => result(true), then(done) { return Promise.resolve(result()).then(done) } }
    function result(single = false) { const rows = (table === 'clients' ? [client] : table === 'nutrition_logs' ? [log] : [entry]).filter(row => filters.every(fn => fn(row))); return { data: single ? rows[0] || null : rows, error: null } }
    return q
  } }
  return { calls, client }
}
for (const [tier, expired] of [['ember', false], ['tracker', false], ['free', false], ['ignite', true]]) {
  test(`${expired ? 'expired owner' : tier} receives manual actuals without coaching, nested meals, or micronutrients`, async () => {
    const { calls } = fixture(tier, expired)
    const response = await route.GET(new Request('https://synthetic.test/api/tracker/nutrition?clientId=owned'))
    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.nutritionLog.water_consumed_oz, 24)
    assert.equal(body.entries[0].calories, 200)
    assert.equal(body.entries[0].protein_g, 10)
    assert.deepEqual(Object.keys(body.nutritionLog).sort(), ['id', 'client_id', 'log_date', 'water_consumed_oz'].sort())
    for (const row of [body.nutritionLog, ...body.entries]) for (const key of ['meals', 'sodium', 'sodium_target_mg', 'iron', 'nutrition_calculation', 'coaching']) assert.equal(Object.hasOwn(row, key), false)
    for (const call of calls.filter(call => ['nutrition_logs', 'macro_entries'].includes(call.table))) assert.notEqual(call.columns, '*')
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store')
  })
}
test('history stays owner-bound and NULL or unknown membership cannot use this endpoint', async () => {
  let f = fixture('tracker')
  assert.equal((await route.GET(new Request('https://synthetic.test/api/tracker/nutrition?clientId=foreign'))).status, 404)
  assert.equal(f.calls.some(call => call.table === 'nutrition_logs'), false)
  for (const tier of [null, 'unknown']) {
    f = fixture(tier)
    assert.equal((await route.GET(new Request('https://synthetic.test/api/tracker/nutrition?clientId=owned'))).status, 403)
    assert.equal(f.calls.some(call => call.table === 'nutrition_logs'), false)
  }
})
