import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import ts from 'typescript'
import vm from 'node:vm'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const nativeRequire = createRequire(import.meta.url)
function loadModule(path, mocks = {}) {
  const output = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  const module = { exports: {} }
  vm.runInNewContext(output, { module, exports: module.exports, console, Intl, require: specifier => mocks[specifier] || nativeRequire(specifier) })
  return module.exports
}
const progress = loadModule('lib/nutrition/micronutrientProgress.ts')
const Ring = loadModule('components/nutrition/MicronutrientProgressRing.tsx').default
const meal = (amount, grams = 100, state = 'confirmed') => ({ grams, entry_state: state, foods: { food_nutrients: { iron_mg: amount } } })
const iron = options => progress.calculateMicronutrientProgress(options).find(row => row.key === 'iron')
const reference = overrides => ({ amount: 45, unit: 'mg', applies_to_intake_source: 'total', sex: 'any', pregnancy_status: 'not_applicable', nutrients: { nutrient_key: 'iron' }, ...overrides })

test('micronutrient intake uses only confirmed persisted food amounts and serving weights', () => {
  const result = iron({ targets: { iron_target_mg: 18 }, meals: [meal(10), meal(8, 50), meal(100, 100, 'pre_logged')] })
  assert.equal(result.consumed, 14)
  assert.equal(result.target, 18)
  assert.equal(result.mealCount, 2)
  assert.equal(result.percent, 14 / 18 * 100)
  assert.equal(result.state, 'known')
  assert.equal(iron({ targets: { iron_target_mg: 28 }, meals: [meal(10)] }).percent, 10 / 28 * 100)
})

test('no foods means no invented percentage, even with a saved daily target', () => {
  const result = iron({ targets: { iron_target_mg: 18 }, meals: [] })
  assert.equal(result.consumed, 0)
  assert.equal(result.percent, null)
  assert.equal(result.ringPercent, 0)
  assert.equal(result.state, 'empty')
  const html = renderToStaticMarkup(React.createElement(Ring, { progress: result }))
  assert.match(html, /No food logged today/)
  assert.match(html, /percentage unavailable/)
  assert.doesNotMatch(html, /100%|0%/)
})

test('missing or invalid targets and nutrient data remain unknown rather than zero', () => {
  for (const target of [null, undefined, '', ' ', 0, -1, 'bad', Number.NaN]) {
    const result = iron({ targets: { iron_target_mg: target }, meals: [meal(10)] })
    assert.equal(result.target, null)
    assert.equal(result.percent, null)
    assert.equal(result.consumed, 10)
  }
  const missing = iron({ targets: { iron_target_mg: 18 }, meals: [meal(null), meal(8, null)] })
  assert.equal(missing.consumed, null)
  assert.equal(missing.missingMealCount, 2)
  const html = renderToStaticMarkup(React.createElement(Ring, { progress: missing }))
  assert.match(html, /Unknown/)
  assert.match(html, /Nutrient data is missing for all logged foods/)
})

test('partial food data shows the known lower bound and explicitly identifies incomplete coverage', () => {
  const result = iron({ targets: { iron_target_mg: 20 }, meals: [meal(10), meal(null)] })
  assert.equal(result.consumed, 10)
  assert.equal(result.percent, 50)
  assert.equal(result.state, 'incomplete')
  const html = renderToStaticMarkup(React.createElement(Ring, { progress: result }))
  assert.match(html, /≥50%/)
  assert.match(html, /At least 10 mg/)
  assert.match(html, /1 of 2 foods lack/)
  // An explicitly recorded zero is known nutrition data.
  assert.equal(iron({ targets: { iron_target_mg: 18 }, meals: [meal(0)] }).state, 'known')
})

test('percentages above 100 remain visible while the ring caps at 100 and never celebrates excess', () => {
  const result = iron({ targets: { iron_target_mg: 20 }, meals: [meal(30)] })
  assert.equal(result.percent, 150)
  assert.equal(result.ringPercent, 100)
  const html = renderToStaticMarkup(React.createElement(Ring, { progress: result }))
  assert.match(html, /150%/)
  assert.match(html, /stroke-dasharray="100 100"/)
  assert.match(html, /More is not necessarily better/)
  assert.doesNotMatch(html, /achievement|complete|great|success/i)
})

test('upper-limit breaches override target progress with a warning', () => {
  const result = iron({ targets: { iron_target_mg: 100 }, meals: [meal(50)], upperLimits: [reference()] })
  assert.equal(result.percent, 50)
  assert.equal(result.upperLimitExceeded, true)
  assert.equal(result.state, 'warning')
  const html = renderToStaticMarkup(React.createElement(Ring, { progress: result }))
  assert.match(html, /data-state="warning"/)
  assert.match(html, /Above the recorded upper limit of 45 mg/)
  assert.doesNotMatch(html, /achievement|complete|great|success/i)
})

test('UL comparisons respect source, units, forms, and known demographic context', () => {
  const options = { targets: { iron_target_mg: 18 }, meals: [meal(50)] }
  for (const invalid of [
    { applies_to_intake_source: 'supplemental' }, { applies_to_intake_source: 'specific_form' },
    { nutrient_form: 'specific-form' }, { unit: 'mcg' }, { sex: 'female' },
    { pregnancy_status: 'pregnant' }, { min_age_years: 19 },
  ]) assert.equal(iron({ ...options, upperLimits: [reference(invalid)] }).upperLimitExceeded, false)
  assert.equal(iron({ ...options, age: 30, upperLimits: [reference({ min_age_years: 19 })] }).upperLimitExceeded, true)
  assert.equal(iron({ ...options, age: 15, upperLimits: [reference({ min_age_years: 19 })] }).upperLimitExceeded, false)
})

test('persisted read scopes meal data to the log and confirms saved entries; reference failure is isolated', async () => {
  const queries = []
  const db = {
    from(table) {
      const filters = []
      const query = { select() { return query }, eq(key, value) { filters.push([key, value]); return query },
        then(resolve) { queries.push({ table, filters }); return Promise.resolve(table === 'meal_entries' ? { data: [meal(10)], error: null } : table === 'macro_entries' ? { data: [], error: null } : { data: null, error: { message: 'Unavailable' } }).then(resolve) },
      }
      return query
    },
  }
  const saved = await progress.loadMicronutrientProgress(db, 'own-log')
  assert.equal(saved.meals.length, 1)
  assert.equal(saved.upperLimitsAvailable, false)
  assert.deepEqual(JSON.parse(JSON.stringify(queries.find(query => query.table === 'meal_entries').filters)), [['nutrition_log_id', 'own-log'], ['entry_state', 'confirmed']])
  const failed = { from() { const query = { select() { return query }, eq() { return query }, then(resolve) { return Promise.resolve({ data: null, error: { message: 'Failed' } }).then(resolve) } }; return query } }
  await assert.rejects(progress.loadMicronutrientProgress(failed, 'own-log'), /Saved micronutrient intake could not be loaded/)
})


test('persisted macro-only entries remain unknown micronutrient coverage after a tier upgrade', () => {
  const macroOnly = iron({ targets: { iron_target_mg: 20 }, meals: [], macroEntryCount: 1 })
  assert.equal(macroOnly.consumed, null)
  assert.equal(macroOnly.percent, null)
  const unknownHtml = renderToStaticMarkup(React.createElement(Ring, { progress: macroOnly }))
  assert.match(unknownHtml, /Macro-only intake is logged/)
  assert.doesNotMatch(unknownHtml, /No food logged/)
  const partial = iron({ targets: { iron_target_mg: 20 }, meals: [meal(10)], macroEntryCount: 1 })
  assert.equal(partial.state, 'incomplete')
  assert.equal(partial.percent, 50)
  const html = renderToStaticMarkup(React.createElement(Ring, { progress: partial }))
  assert.match(html, /≥50%/)
  assert.match(html, /macro-only entries have unknown/)
})

test('unmatched legacy upper-limit insights cannot override safe ring reference matching', () => {
  assert.equal(progress.confirmedToxicityWarning('iron', [{nutrientKey:'iron',patternState:'possible_excess',safetyEscalationReason:'intake_above_established_ul',message:'Invalid infant limit'}]), undefined)
  assert.equal(progress.confirmedToxicityWarning('iron', [{nutrientKey:'iron',patternState:'confirmed_toxicity',message:'Recorded toxicity'}]), 'Recorded toxicity')
})
