import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

const moduleCache = new Map()
function moduleUrl(path) {
  if (moduleCache.has(path)) return moduleCache.get(path)
  const source = readFileSync(path, 'utf8')
  let { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2020, target: ts.ScriptTarget.ES2022 },
  })
  outputText = outputText.replace(/from ['"]([^'"]+)['"]/g, (match, specifier) => {
    let url
    if (specifier === 'next/server') {
      url = `data:text/javascript;base64,${Buffer.from('export const NextResponse = { json: (body, init) => Response.json(body, init) }').toString('base64')}`
    } else if (specifier === '@/lib/supabase/server') {
      url = `data:text/javascript;base64,${Buffer.from('export const createClient = async () => globalThis.mealTestClient').toString('base64')}`
    } else if (specifier.includes('invalidateDailyPlan')) {
      url = `data:text/javascript;base64,${Buffer.from('export const invalidateDailyPlan = async () => {}').toString('base64')}`
    } else if (specifier.startsWith('@/')) {
      url = moduleUrl(`${specifier.slice(2)}.ts`)
    } else return match
    return `from '${url}'`
  })
  const url = `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
  moduleCache.set(path, url)
  return url
}

const { normalizeMealInput } = await import(moduleUrl('lib/nutrition/mealEntry.ts'))
const { createMealEntry } = await import(moduleUrl('lib/nutrition/createMealEntry.ts'))
const addMeal = await import(moduleUrl('app/api/nutrition/add-meal/route.ts'))
const todayMeals = await import(moduleUrl('app/api/today-meals/route.ts'))
const barcode = await import(moduleUrl('app/api/nutrition/barcode/route.ts'))
const image = await import(moduleUrl('app/api/nutrition/photo-estimate/route.ts'))
const removeMeal = await import(moduleUrl('app/api/nutrition/delete-meal/route.ts'))
const recurring = await import(moduleUrl('app/api/nutrition/recurring-foods/route.ts'))

const logId = '10000000-0000-4000-8000-000000000001'
const foodId = '20000000-0000-4000-8000-000000000001'
const servingId = '30000000-0000-4000-8000-000000000001'
const userId = '40000000-0000-4000-8000-000000000001'
const canonicalColumns = new Set(['nutrition_log_id', 'food_id', 'meal_name', 'serving_amount', 'serving_unit', 'serving_option_id', 'grams', 'day_block', 'meal_period', 'entry_source', 'entry_state', 'recurring_food_id', 'confirmed_at', 'skipped_at', 'symptoms_after', 'notes'])
const requestInput = { nutritionLogId: logId, foodId, servingOptionId: servingId, servingAmount: 1.5, mealPeriod: 'Lunch' }

function database({ tier = 'ignite', owner = userId, failBarcode = false } = {}) {
  const rows = {
    nutrition_logs: [{ id: logId, client_id: 'qa-client', auth_user_id: owner }],
    clients: [{ client_id: 'qa-client', auth_user_id: userId, program: tier }],
    foods: [{ id: foodId, name: 'QA food', barcode: '0123456789012', default_serving_unit: 'serving', grams_per_serving: 50, food_nutrients: { calories: 140, protein_g: 20, carbs_g: 5, fat_g: 4, fiber_g: 2, iron_mg: 1 } }],
    food_serving_options: [{ id: servingId, food_id: foodId, label: '1 slice', unit: 'slice', grams: 50 }],
    meal_entries: [], recurring_food_patterns: [], meal_symptoms: [],
  }
  const inserts = []
  const db = {
    rows, inserts,
    auth: { getUser: async () => ({ data: { user: { id: userId } } }) },
    from(table) {
      const filters = []
      let mutation
      let payload
      const query = {
        select() { return query }, order() { return query }, limit() { return query }, gte() { return query },
        eq(key, value) { filters.push((row) => row[key] === value); return query },
        in(key, values) { filters.push((row) => values.includes(row[key])); return query },
        insert(value) { mutation = 'insert'; payload = value; return query },
        update(value) { mutation = 'update'; payload = value; return query },
        delete() { mutation = 'delete'; return query },
        single() { return execute(true) }, maybeSingle() { return execute(true) },
        then(resolve, reject) { return execute(false).then(resolve, reject) },
      }
      async function execute(single) {
        if (table === 'foods' && failBarcode && filters.some((filter) => !filter({ barcode: 'other' }))) return { data: null, error: { code: 'LOOKUP_FAILED' } }
        if (table === 'nutrition_log_remaining') {
          const grams = rows.meal_entries.reduce((sum, row) => sum + row.grams, 0)
          return { data: { calories_remaining: 2000 - 140 * grams / 100, protein_remaining_g: 100 - 20 * grams / 100, carbs_remaining_g: 200 - 5 * grams / 100, fat_remaining_g: 70 - 4 * grams / 100, fiber_remaining_g: 25 - 2 * grams / 100, iron_remaining_mg: 18 - grams / 100 }, error: null }
        }
        if (mutation === 'insert') {
          if (table === 'meal_entries') for (const key of Object.keys(payload)) assert.ok(canonicalColumns.has(key), `Unexpected meal column: ${key}`)
          inserts.push({ table, payload })
          const created = { ...payload, id: `entry-${inserts.length}`, created_at: new Date().toISOString(), foods: { name: 'QA food' } }
          rows[table].push(created)
          return { data: single ? created : [created], error: null }
        }
        const matches = (rows[table] || []).filter((row) => filters.every((filter) => filter(row)))
        if (mutation === 'delete') rows[table] = rows[table].filter((row) => !matches.includes(row))
        if (mutation === 'update') matches.forEach((row) => Object.assign(row, payload))
        return { data: single ? matches[0] || null : matches, error: null }
      }
      return query
    },
  }
  return db
}

test('normalization allows only meal data and ignores legacy ingestion fields', () => {
  const normalized = normalizeMealInput({ ...requestInput, barcode: 'wrong', image: 'wrong', estimateMetadata: { raw: true }, confidence: 0.5, auth_user_id: 'attacker' })
  assert.equal(normalized.ok, true)
  assert.deepEqual(Object.keys(normalized.input).sort(), ['entrySource', 'entryState', 'foodId', 'mealPeriod', 'nutritionLogId', 'servingAmount', 'servingOptionId'].sort())
  for (const invalid of [null, [], { ...requestInput, servingAmount: -1 }, { ...requestInput, servingAmount: true }, { ...requestInput, entryState: 'pre_logged' }, { ...requestInput, entrySource: 'unknown' }]) assert.equal(normalizeMealInput(invalid).ok, false)
})

test('manual creates a canonical entry, updates macros and micros, survives readback, and deletes', async () => {
  const db = database()
  globalThis.mealTestClient = db
  const response = await addMeal.POST(new Request('http://test/api/nutrition/add-meal', { method: 'POST', body: JSON.stringify(requestInput) }))
  assert.equal(response.status, 200)
  const result = await response.json()
  assert.equal(result.refreshStatus, 'success')
  assert.deepEqual(result.remaining, { calories_remaining: 1895, protein_remaining_g: 85, carbs_remaining_g: 196.25, fat_remaining_g: 67, fiber_remaining_g: 23.5, iron_remaining_mg: 17.25 })
  assert.equal(db.rows.meal_entries[0].grams, 75)
  assert.equal(db.rows.meal_entries[0].entry_source, 'manual')
  for (const forbidden of ['barcode', 'image', 'estimate_metadata', 'confidence']) assert.equal(forbidden in db.rows.meal_entries[0], false)
  const url = new Request(`http://test/api/today-meals?nutritionLogId=${logId}`)
  assert.equal((await (await todayMeals.GET(url)).json()).meals.length, 1)
  assert.equal((await (await todayMeals.GET(url)).json()).meals[0].id, result.mealEntryId)
  const removed = await removeMeal.POST(new Request('http://test/delete', { method: 'POST', body: JSON.stringify({ mealEntryId: result.mealEntryId, nutritionLogId: logId }) }))
  assert.equal(removed.status, 200)
  assert.equal((await removed.json()).remaining.calories_remaining, 2000)
  assert.equal(db.rows.meal_entries.length, 0)
})

test('barcode resolves catalog food and confirms through the same service', async () => {
  const db = database()
  globalThis.mealTestClient = db
  const result = await (await barcode.GET(new Request('http://test/barcode?barcode=0123456789012'))).json()
  assert.equal(result.found, true)
  assert.equal(result.food.protein_g, 20)
  assert.equal(result.food.food_nutrients, undefined)
  const input = normalizeMealInput({ ...requestInput, foodId: result.food.id, entrySource: 'barcode' }).input
  assert.equal((await createMealEntry(db, userId, input)).status, 200)
  assert.equal(db.rows.meal_entries[0].entry_source, 'barcode')
  assert.equal('barcode' in db.rows.meal_entries[0], false)
})

test('barcode misses leave manual creation available', async () => {
  const db = database()
  globalThis.mealTestClient = db
  const miss = await (await barcode.GET(new Request('http://test/barcode?barcode=not-found'))).json()
  assert.equal(miss.found, false)
  assert.match(miss.message, /manually/)
  assert.equal((await createMealEntry(db, userId, normalizeMealInput(requestInput).input)).status, 200)
})

test('image outage is isolated, and a reviewed resolved candidate uses canonical creation', async () => {
  const db = database({ tier: 'phoenix' })
  globalThis.mealTestClient = db
  const form = new FormData()
  form.append('photo', new File(['image'], 'meal.png', { type: 'image/png' }))
  const unavailable = await image.POST(new Request('http://test/image', { method: 'POST', body: form }))
  assert.equal(unavailable.status, 501)
  assert.match((await unavailable.json()).error, /manually instead/)
  assert.equal((await createMealEntry(db, userId, normalizeMealInput(requestInput).input)).status, 200)
  assert.equal((await barcode.GET(new Request('http://test/barcode?barcode=0123456789012'))).status, 200)
  const confirmed = normalizeMealInput({ ...requestInput, entrySource: 'photo_estimate', image: 'never stored' }).input
  assert.equal((await createMealEntry(db, userId, confirmed)).status, 200)
  assert.equal(db.rows.meal_entries[1].entry_source, 'photo_estimate')
  assert.equal('image' in db.rows.meal_entries[1], false)
})

test('Ember is rejected at meal, barcode, image, read, delete, and recurring boundaries', async () => {
  const db = database({ tier: 'ember' })
  globalThis.mealTestClient = db
  assert.equal((await createMealEntry(db, userId, normalizeMealInput(requestInput).input)).status, 403)
  assert.equal((await barcode.GET(new Request('http://test/barcode?barcode=0123456789012'))).status, 403)
  assert.equal((await image.POST(new Request('http://test/image', { method: 'POST' }))).status, 403)
  assert.equal((await todayMeals.GET(new Request(`http://test/today?nutritionLogId=${logId}`))).status, 403)
  assert.equal((await recurring.GET()).status, 403)
  assert.equal((await removeMeal.POST(new Request('http://test/delete', { method: 'POST', body: JSON.stringify({ mealEntryId: 'nope', nutritionLogId: logId }) }))).status, 403)
  assert.equal(db.inserts.length, 0)
})

test('cross-user log ownership and serving mismatch fail before writing', async () => {
  const foreign = database({ owner: 'another-user' })
  assert.equal((await createMealEntry(foreign, userId, normalizeMealInput(requestInput).input)).status, 403)
  assert.equal(foreign.inserts.length, 0)
  const mismatch = database()
  mismatch.rows.food_serving_options[0].food_id = 'another-food'
  assert.equal((await createMealEntry(mismatch, userId, normalizeMealInput(requestInput).input)).status, 400)
  assert.equal(mismatch.inserts.length, 0)
})

test('Ignite keeps manual/barcode access and rejects image while Phoenix allows confirmed image', async () => {
  const db = database()
  assert.equal((await createMealEntry(db, userId, normalizeMealInput({ ...requestInput, entrySource: 'photo_estimate' }).input)).status, 403)
  globalThis.mealTestClient = db
  assert.equal((await recurring.GET()).status, 200)
})
