import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServerClient } from '@supabase/ssr'

// Use isolated, temporary QA identities. Never use a customer's meal history.
const fixture = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const origin = process.argv[3] || 'https://anastasiselite.com'
const sessions = new Map()
const checks = []
const createdEntries = []
const pass = (name) => { checks.push(name); console.log(`PASS ${name}`) }

for (const account of fixture.accounts) {
  const jar = new Map()
  const client = createServerClient(fixture.supabaseUrl, fixture.publishableKey, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (cookies) => cookies.forEach(({ name, value }) => jar.set(name, value)),
    },
  })
  const { error } = await client.auth.signInWithPassword({ email: account.email, password: account.password })
  assert.equal(error, null, `QA ${account.tier} authentication failed`)
  sessions.set(account.tier, { account, client, jar })
}

async function api(tier, path, body, expectedStatus = 200) {
  const { jar } = sessions.get(tier)
  const headers = { Cookie: [...jar].map(([name, value]) => `${name}=${value}`).join('; ') }
  const isForm = body instanceof FormData
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json'
  const response = await fetch(new URL(path, origin), {
    method: body === undefined ? 'GET' : 'POST', headers,
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    redirect: 'manual', signal: AbortSignal.timeout(30000),
  })
  const data = await response.json().catch(() => null)
  assert.equal(response.status, expectedStatus, `${tier} ${path}: ${response.status}, ${data?.error || 'unexpected response'}`)
  return data
}

async function remaining(tier) {
  const { account, client } = sessions.get(tier)
  const { data, error } = await client.from('nutrition_log_remaining').select('*').eq('nutrition_log_id', account.logId).single()
  assert.equal(error, null)
  return data
}

async function add(tier, foodId, servingOptionId, entrySource = 'manual', servingAmount = 1.5) {
  const { account } = sessions.get(tier)
  const data = await api(tier, '/api/nutrition/add-meal', { nutritionLogId: account.logId, foodId, servingOptionId, servingAmount, mealPeriod: 'Lunch', entrySource, entryState: 'confirmed' })
  assert.equal(data.success, true)
  assert.equal(data.refreshStatus, 'success')
  createdEntries.push({ tier, id: data.mealEntryId })
  return data
}

try {
  const foods = await api('ignite', '/api/nutrition/search-foods?q=egg')
  assert.ok(foods.foods.length > 0)
  const food = foods.foods.find((item) => item.calories > 0 && item.protein_g > 0 && item.carbs_g > 0 && item.fat_g > 0) || foods.foods[0]
  const servings = await api('ignite', `/api/nutrition/serving-options?foodId=${food.id}`)
  assert.ok(servings.servingOptions.length > 0)
  const serving = servings.servingOptions[0]
  const before = await remaining('ignite')
  const added = await add('ignite', food.id, serving.id)
  const grams = Number(serving.grams) * 1.5
  for (const [column, nutrient] of [['calories_remaining', 'calories'], ['protein_remaining_g', 'protein_g'], ['carbs_remaining_g', 'carbs_g'], ['fat_remaining_g', 'fat_g'], ['fiber_remaining_g', 'fiber_g'], ['iron_remaining_mg', 'iron_mg']]) {
    const expected = Number(before[column]) - Number(food[nutrient] || 0) * grams / 100
    assert.ok(Math.abs(Number(added.remaining[column]) - expected) < 0.001, `${column} failed to recalculate`)
  }
  pass('manual catalog search, serving, quantity, macros and micronutrients')
  const logId = sessions.get('ignite').account.logId
  for (let refresh = 0; refresh < 2; refresh++) {
    const loaded = await api('ignite', `/api/today-meals?nutritionLogId=${logId}`)
    const row = loaded.meals.find((entry) => entry.id === added.mealEntryId)
    assert.equal(row.entry_source, 'manual')
    assert.equal(Number(row.grams), grams)
    assert.equal(row.meal_period, 'Lunch')
    assert.equal('barcode' in row, false)
  }
  pass('today meals readback and refresh persistence without barcode/image columns')

  const custom = { name: 'Temporary Meal Logging QA Food', servingSize: 1, servingUnit: 'slice', servingGrams: 50, calories: 70, protein: 10, carbs: 5, fats: 2, fiber: 1 }
  const manualFood = await api('ignite', '/api/nutrition/custom-food', custom)
  assert.ok(manualFood.food.id)
  assert.equal(Number(manualFood.food.calories), 140)
  const manualServings = await api('ignite', `/api/nutrition/serving-options?foodId=${manualFood.food.id}`)
  await add('ignite', manualFood.food.id, manualServings.servingOptions[0].id)
  pass('custom manual food atomic creation, serving normalization and meal creation')

  const code = `990${Date.now().toString().slice(-10)}`
  const packaged = await api('ignite', '/api/nutrition/custom-food', { ...custom, name: 'Temporary QA Packaged Food', barcode: code })
  const resolved = await api('ignite', `/api/nutrition/barcode?barcode=${code}`)
  assert.equal(resolved.found, true)
  assert.equal(resolved.food.id, packaged.food.id)
  assert.equal(Number(resolved.food.protein_g), 20)
  const packagedServings = await api('ignite', `/api/nutrition/serving-options?foodId=${resolved.food.id}`)
  await add('ignite', resolved.food.id, packagedServings.servingOptions[0].id, 'barcode')
  pass('barcode catalog lookup, normalization and standard confirmed meal creation')
  const missed = await api('ignite', '/api/nutrition/barcode?barcode=0000000000000')
  assert.equal(missed.found, false)
  await add('ignite', food.id, serving.id)
  pass('barcode failure followed by successful manual entry')

  const form = new FormData()
  form.append('photo', new File([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5WQAAAAASUVORK5CYII=', 'base64')], 'qa.png', { type: 'image/png' }))
  const outage = await api('phoenix', '/api/nutrition/photo-estimate', form, 501)
  assert.match(outage.error, /manually instead/)
  await add('phoenix', food.id, serving.id, 'photo_estimate')
  await add('phoenix', food.id, serving.id, 'manual')
  await api('ignite', `/api/nutrition/barcode?barcode=${code}`)
  pass('image outage isolated; reviewed resolved food uses shared creation; manual/barcode remain available')
  console.log('BLOCKED actual image analysis: no provider configured')

  for (const tier of ['ignite', 'phoenix']) {
    const result = await api(tier, '/api/nutrition/recurring-foods')
    assert.ok(Array.isArray(result.suggestions))
    assert.ok(Array.isArray(result.active))
  }
  const recurring = await api('ignite', '/api/nutrition/recurring-foods', { action: 'prelog', foodId: food.id, servingOptionId: serving.id, servingAmount: 1, servingUnit: serving.label, mealPeriod: 'Lunch', daysOfWeek: [1, 2, 3] })
  assert.ok(recurring.pattern.id)
  await add('ignite', food.id, serving.id, 'recurring')
  await api('ignite', '/api/nutrition/recurring-foods', { action: 'stop', id: recurring.pattern.id })
  pass('recurring reads, preference creation, confirmation and stop without meal_period errors')

  const emberLogId = sessions.get('ember').account.logId
  for (const [path, body] of [
    ['/api/nutrition/add-meal', { nutritionLogId: emberLogId, foodId: food.id, servingAmount: 1 }],
    ['/api/nutrition/custom-food', custom], ['/api/nutrition/barcode?barcode=0000000000000', undefined],
    ['/api/nutrition/search-foods?q=egg', undefined], [`/api/nutrition/serving-options?foodId=${food.id}`, undefined],
    ['/api/nutrition/photo-estimate', form], ['/api/nutrition/recurring-foods', undefined],
    [`/api/today-meals?nutritionLogId=${emberLogId}`, undefined],
    ['/api/nutrition/delete-meal', { mealEntryId: added.mealEntryId, nutritionLogId: emberLogId }],
  ]) await api('ember', path, body, 403)
  await api('ignite', '/api/nutrition/photo-estimate', form, 403)
  pass('Ember rejected by every meal input API; Ignite image remains gated')

  await api('phoenix', '/api/nutrition/add-meal', { nutritionLogId: logId, foodId: food.id, servingAmount: 1 }, 404)
  const { error: crossUser } = await sessions.get('phoenix').client.from('meal_entries').insert({ nutrition_log_id: logId, food_id: food.id, serving_amount: 1, serving_unit: 'g', grams: 50 })
  assert.equal(crossUser?.code, '42501')
  const { error: directEmber } = await sessions.get('ember').client.from('meal_entries').insert({ nutrition_log_id: emberLogId, food_id: food.id, serving_amount: 1, serving_unit: 'g', grams: 50 })
  assert.equal(directEmber?.code, '42501')
  const { data: privateFoods, error: privacyError } = await sessions.get('phoenix').client.from('foods').select('id').eq('id', manualFood.food.id)
  assert.equal(privacyError, null)
  assert.equal(privateFoods.length, 0)
  pass('cross-user API/RLS rejection, direct Ember RLS rejection, and private food isolation')
} finally {
  for (const entry of createdEntries.reverse()) {
    await api(entry.tier, '/api/nutrition/delete-meal', { nutritionLogId: sessions.get(entry.tier).account.logId, mealEntryId: entry.id })
  }
  for (const tier of ['ignite', 'phoenix']) assert.equal(Number((await remaining(tier)).calories_remaining), 2000)
  pass('delete restores daily nutrition totals')
}
console.log(JSON.stringify({ passed: checks.length, imageAnalysis: 'BLOCKED' }))
