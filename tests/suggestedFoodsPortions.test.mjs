import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

const output = ts.transpileModule(readFileSync('lib/nutrition/suggestedFoods.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ES2020, target: ts.ScriptTarget.ES2022 },
}).outputText
const { buildSuggestedFoods } = await import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`)

const remaining = {
  calories_remaining: 1000, protein_remaining_g: 80, carbs_remaining_g: 100,
  fat_remaining_g: 40, fiber_remaining_g: 20,
}

function food(id, name, extra = {}) {
  return {
    id, name, calories: 200, protein_g: 20, carbs_g: 20, fat_g: 4,
    food_serving_options: [{ label: '100 grams', grams: 100, is_default: true }],
    ...extra,
  }
}

function suggest(candidates, options = {}) {
  return buildSuggestedFoods({ remaining, candidates, ...options })
}

test('screenshot dry egg and zero-moisture beans cannot become standalone suggestions', () => {
  const names = [
    'Egg, white, dried', 'Egg, whole, dried', 'Egg, yolk, powdered',
    'Beans, Dry, Tan (0% moisture)', 'Beans, Dry, Medium Red (0% moisture)',
    'Beans, Dry, Brown (0% moisture)',
  ]
  const candidates = names.map((name, index) => food(`dry-${index}`, name, {
    protein_g: 80,
    food_serving_options: [{ label: '1 large egg / equivalent', grams: 50 }],
  }))
  for (const snapshot of [remaining, null]) {
    assert.deepEqual(suggest(candidates, { remaining: snapshot }), [])
  }
})

test('explicit preparation ingredients are filtered before ranking, without blocking ready-to-eat foods', () => {
  for (const name of [
    'Lentils, raw', 'Chickpeas, dried', 'Beans, kidney, mature seeds, raw',
    'Rice, white, uncooked', 'Pasta, dry', 'Chicken breast, raw',
    'Egg, whole, raw', 'Wheat flour', 'Pancake mix, dry',
    'Venison, raw', 'Bison, ground, raw', 'Pancake mix, dry, with almonds',
  ]) {
    assert.deepEqual(suggest([food(name, name)]), [], name)
  }
  const candidates = [
    food('cooked-beans', 'Beans, kidney, mature seeds, cooked, boiled'),
    food('canned-beans', 'Beans, black, canned, drained'),
    food('dried-fruit', 'Apricots, dried'),
    food('raw-nuts', 'Almonds, raw'),
    food('roasted-nuts', 'Cashews, dry roasted'),
  ]
  assert.deepEqual(new Set(suggest(candidates).map(item => item.foodId)), new Set(candidates.map(item => item.id)))
  for (const name of [
    'Apricots, dried, sulfured, uncooked', 'Prunes, dried, uncooked',
    'Fruit and nut mix, dried', 'Trail mix, dry roasted',
  ]) {
    assert.equal(suggest([food(name, name)])[0]?.name, name, name)
  }
  assert.equal(suggest([food('cooked-from-dry', 'Beans, dry, pinto, cooked')])[0].name, 'Beans, dry, pinto, cooked')
})

test('a verified 50g serving displays half the per-100g nutrients and protein contribution', () => {
  const candidate = food('cooked-egg', 'Egg white, cooked', {
    calories: 250, protein_g: 30, carbs_g: 20, fat_g: 6,
    food_serving_options: [{ label: 'Half cup', grams: 50, is_default: true }],
  })
  const before = structuredClone(candidate)
  const [suggestion] = suggest([candidate])
  assert.equal(suggestion.servingGrams, 50)
  assert.match(suggestion.serving, /Half cup/)
  assert.equal(suggestion.calories, 125)
  assert.equal(suggestion.protein, 15)
  assert.equal(suggestion.carbs, 10)
  assert.equal(suggestion.fats, 3)
  assert.equal(suggestion.contribution, '+15g protein')
  assert.deepEqual(candidate, before, 'Recommendation scaling must not mutate the logging catalog')
})

test('portion-equivalent foods receive identical macro ranking and general-food scores', () => {
  const concentrated = food('half', 'Cooked option A', {
    calories: 360, protein_g: 40, carbs_g: 44, fat_g: 12, fiber_g: 8,
    food_serving_options: [{ label: 'Half portion', grams: 50 }],
  })
  const equivalent = food('whole', 'Cooked option B', {
    calories: 180, protein_g: 20, carbs_g: 22, fat_g: 6, fiber_g: 4,
  })
  for (const snapshot of [remaining, null]) {
    const [a] = suggest([concentrated], { remaining: snapshot })
    const [b] = suggest([equivalent], { remaining: snapshot })
    for (const key of ['calories', 'protein', 'carbs', 'fats', 'score', 'contribution', 'reason']) {
      assert.equal(a[key], b[key], `${key} must use the selected portion`)
    }
  }
})

test('every micronutrient gap and physiology effect ranks the selected grams consistently', () => {
  const gapFields = [
    ['fiber_g', 'fiber_remaining_g'], ['potassium_mg', 'potassium_remaining_mg'],
    ['magnesium_mg', 'magnesium_remaining_mg'], ['calcium_mg', 'calcium_remaining_mg'],
    ['iron_mg', 'iron_remaining_mg'], ['vitamin_d_mcg', 'vitamin_d_remaining_mcg'],
    ['vitamin_c_mg', 'vitamin_c_remaining_mg'], ['choline_mg', 'choline_remaining_mg'],
    ['zinc_mg', 'zinc_remaining_mg'], ['selenium_mcg', 'selenium_remaining_mcg'],
    ['vitamin_a_mcg', 'vitamin_a_remaining_mcg'], ['vitamin_e_mg', 'vitamin_e_remaining_mg'],
    ['vitamin_k_mcg', 'vitamin_k_remaining_mcg'], ['b12_mcg', 'b12_remaining_mcg'],
  ]
  for (const [field, gap] of gapFields) {
    const a = food('a', 'Cooked option A', { [field]: 20, food_serving_options: [{ grams: 50 }] })
    const b = food('b', 'Cooked option B', { calories: 100, protein_g: 10, carbs_g: 10, fat_g: 2, [field]: 10 })
    const options = { remaining: { ...remaining, [gap]: 30 } }
    assert.equal(suggest([a], options)[0].score, suggest([b], options)[0].score, field)
  }
  for (const [effect, field] of [
    ['protein', 'protein_g'], ['fiber', 'fiber_g'], ['iron', 'iron_mg'],
    ['vitamin_c', 'vitamin_c_mg'], ['potassium', 'potassium_mg'],
    ['magnesium', 'magnesium_mg'], ['sodium', 'sodium_mg'], ['zinc', 'zinc_mg'], ['b6', 'b6_mg'],
  ]) {
    const a = food('a', 'Cooked option A', { [field]: 10, food_serving_options: [{ grams: 50 }] })
    const b = food('b', 'Cooked option B', { calories: 100, protein_g: 10, carbs_g: 10, fat_g: 2, [field]: 5 })
    const options = { recommendationEffects: [{ key: 'support', nutrients: [effect], priorityBoost: 2, reason: 'Current support' }] }
    assert.equal(suggest([a], options)[0].score, suggest([b], options)[0].score, effect)
  }
})

test('serving selection keeps valid defaults, skips invalid weights and uses only substantiated fallback grams', () => {
  const candidate = food('serving', 'Cooked beans', {
    food_serving_options: [
      { label: 'Earlier alternative', grams: 100, sort_order: 0 },
      { label: 'Preferred half cup', grams: 50, is_default: true, sort_order: 5 },
    ],
  })
  assert.equal(suggest([candidate])[0].servingGrams, 50)
  candidate.food_serving_options[1].grams = 0
  assert.equal(suggest([candidate])[0].servingGrams, 100)
  candidate.food_serving_options = [{ label: '1 large egg / equivalent', grams: null }]
  candidate.grams_per_serving = 75
  const [fallback] = suggest([candidate])
  assert.equal(fallback.servingGrams, 75)
  assert.match(fallback.serving, /75\s*g/)
  assert.doesNotMatch(fallback.serving, /egg|equivalent/)
  candidate.food_serving_options = [{ label: 'Half portion', grams: '50' }]
  assert.equal(suggest([candidate])[0].servingGrams, 50, 'Numeric catalog weights can arrive as strings')
})

test('unknown, zero, negative, infinite and malformed serving weights yield an honest empty result', () => {
  for (const grams of [undefined, null, 0, -1, NaN, Infinity, 'unknown', true, false]) {
    const candidate = food('unknown', 'Cooked beans', { food_serving_options: [{ label: '100 grams', grams }] })
    for (const snapshot of [remaining, null]) {
      assert.deepEqual(suggest([candidate], { remaining: snapshot }), [], String(grams))
    }
  }
  assert.deepEqual(suggest([food('none', 'Cooked beans', { food_serving_options: [] })]), [])
})

test('equivalent duplicate names collapse before taking five results and logged equivalents stay excluded', () => {
  const duplicates = Array.from({ length: 6 }, (_, index) => food(`duplicate-${index}`, index % 2 ? 'Cooked BLACK-beans' : ' cooked black beans '))
  const unique = ['A', 'B', 'C', 'D'].map(name => food(name, `Prepared food ${name}`))
  const results = suggest([...duplicates, ...unique])
  assert.equal(results.length, 5)
  assert.equal(results.filter(item => item.foodId.startsWith('duplicate')).length, 1)
  assert.deepEqual(suggest(duplicates, { loggedFoodIds: ['duplicate-2'] }), [])
})

test('duplicate allergen metadata cannot bypass exclusions and avoid terms remain effective', () => {
  const candidates = [
    food('a', 'Greek yogurt', { allergens: ['milk'] }),
    food('b', 'GREEK-YOGURT'),
    food('c', 'Cooked lentils'),
  ]
  assert.deepEqual(suggest(candidates, { avoidTerms: ['milk'] }).map(item => item.foodId), ['c'])
  assert.deepEqual(suggest(candidates, { avoidTerms: ['yogurt'], loggedFoodIds: ['c'] }), [])
})
