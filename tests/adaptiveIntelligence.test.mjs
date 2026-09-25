import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import ts from 'typescript'
import vm from 'node:vm'

const root = resolve(dirname(new URL(import.meta.url).pathname), '..')
const config = {
  NUTRITION_INTELLIGENCE_CONFIG: {
    nutrientGap: {
      lookbackDays: 14,
      minimumEligibleDays: 10,
      lowIntakeRatio: 0.75,
      minimumLowDays: 7,
      minimumCompleteness: 0.68,
    },
    recurringMeals: {
      suggestionMinimumDays: 4,
      automaticPrelogMinimumDays: 14,
      weekdayPatternMinimumOccurrences: 3,
      weekdayDominanceRatio: 0.7,
    },
    hydration: {
      defaultWakeTime: '07:00',
      defaultBedTime: '22:30',
      aheadTolerance: 12,
      onPaceTolerance: 10,
      slightlyBehindTolerance: 25,
    },
  },
}

function loadTs(relativePath) {
  const filename = resolve(root, relativePath)
  const source = readFileSync(filename, 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText
  const module = { exports: {} }
  const context = {
    module,
    exports: module.exports,
    require: (id) => {
      if (id === '@/lib/nutrition/intelligenceConfig') return config
      return {}
    },
    Date,
    Math,
    Number,
    String,
    Boolean,
    Array,
    Object,
    Set,
    Map,
    RegExp,
  }
  vm.runInNewContext(output, context, { filename })
  return module.exports
}

const { calculateHydrationPacing } = loadTs('lib/hydration/pacing.ts')
const { classifyRecurringMealPattern } = loadTs('lib/nutrition/recurringMealIntelligence.ts')
const { evaluateSupplementEligibility } = loadTs('lib/nutrition/supplementEligibility.ts')

const sleepSupplement = {
  id: 'sleep',
  name: 'Anastasis Sleep Support',
  nutrients: [{ nutrientKey: 'magnesium' }],
  supportedFunctions: ['sleep'],
}

function exposures(days, nutrientKey = 'magnesium', lowDays = days) {
  return Array.from({ length: days }, (_, index) => ({
    date: `2026-09-${String(index + 1).padStart(2, '0')}`,
    nutrientKey,
    amount: index < lowDays ? 120 : 310,
    target: 320,
    complete: true,
  }))
}

test('short nutrient gap does not trigger supplement recommendation', () => {
  const result = evaluateSupplementEligibility({
    nutrientKey: 'magnesium',
    exposures: exposures(4),
    functionSignals: [{ functionKey: 'sleep', days: 4, trend: 'poor' }],
    nutrientFunctions: ['sleep'],
    supplements: [sleepSupplement],
  })

  assert.equal(result.eligible, false)
  assert.equal(result.reason, 'insufficient_longitudinal_data')
})

test('persistent nutrient gap can become supplement eligible when experience and formula match', () => {
  const result = evaluateSupplementEligibility({
    nutrientKey: 'magnesium',
    exposures: exposures(14),
    functionSignals: [{ functionKey: 'sleep', days: 8, trend: 'declining' }],
    nutrientFunctions: ['sleep', 'muscle_function'],
    supplements: [sleepSupplement],
  })

  assert.equal(result.eligible, true)
  assert.equal(result.supplement.name, 'Anastasis Sleep Support')
  assert.equal(result.reason, 'persistent_nutrient_gap_with_matching_experience_and_formula')
  assert.doesNotMatch(result.message, /deficient|treat|cure|diagnos/i)
})

test('nutrient gap without matching symptom or function does not select unrelated supplement', () => {
  const result = evaluateSupplementEligibility({
    nutrientKey: 'magnesium',
    exposures: exposures(14),
    functionSignals: [{ functionKey: 'energy', days: 8, trend: 'poor' }],
    nutrientFunctions: ['sleep'],
    supplements: [sleepSupplement],
  })

  assert.equal(result.eligible, false)
  assert.equal(result.reason, 'no_matching_experience_signal')
})

test('partial nutrition data does not create overconfident supplement recommendation', () => {
  const partial = exposures(14).map((row, index) => index % 2 === 0 ? { ...row, complete: false } : row)
  const result = evaluateSupplementEligibility({
    nutrientKey: 'magnesium',
    exposures: partial,
    functionSignals: [{ functionKey: 'sleep', days: 8, trend: 'poor' }],
    nutrientFunctions: ['sleep'],
    supplements: [sleepSupplement],
  })

  assert.equal(result.eligible, false)
  assert.match(result.message, /still learning|recurring enough/i)
})

test('hydration pacing compares consumed percent against waking-day elapsed percent', () => {
  const behind = calculateHydrationPacing({
    consumed: 20,
    target: 100,
    wakeTime: '07:00',
    bedTime: '23:00',
    localTimeMinutes: 15 * 60,
  })
  assert.equal(behind.dayElapsedPercent, 50)
  assert.equal(behind.consumedPercent, 20)
  assert.equal(behind.state, 'behind')

  const onPace = calculateHydrationPacing({
    consumed: 46,
    target: 100,
    wakeTime: '07:00',
    bedTime: '23:00',
    localTimeMinutes: 15 * 60,
  })
  assert.equal(onPace.state, 'on_pace')
})

test('recurring meals distinguish daily and weekday-specific patterns', () => {
  const daily = classifyRecurringMealPattern([
    { date: '2026-09-01', weekday: 2 },
    { date: '2026-09-02', weekday: 3 },
    { date: '2026-09-03', weekday: 4 },
    { date: '2026-09-04', weekday: 5 },
  ])
  assert.equal(daily.eligibleForSuggestion, true)
  assert.equal(daily.patternType, 'daily')

  const monday = classifyRecurringMealPattern([
    { date: '2026-09-07', weekday: 1 },
    { date: '2026-09-14', weekday: 1 },
    { date: '2026-09-21', weekday: 1 },
    { date: '2026-09-28', weekday: 1 },
  ])
  assert.equal(monday.patternType, 'weekday_specific')
  assert.equal(JSON.stringify(monday.daysOfWeek), JSON.stringify([1]))
})

test('recurring meal automatic prelogging waits for about two weeks of repetition', () => {
  const thirteen = Array.from({ length: 13 }, (_, index) => ({ date: `2026-09-${String(index + 1).padStart(2, '0')}`, weekday: index % 7 }))
  const fourteen = Array.from({ length: 14 }, (_, index) => ({ date: `2026-09-${String(index + 1).padStart(2, '0')}`, weekday: index % 7 }))

  assert.equal(classifyRecurringMealPattern(thirteen).eligibleForAutomaticPrelog, false)
  assert.equal(classifyRecurringMealPattern(fourteen).eligibleForAutomaticPrelog, true)
})
