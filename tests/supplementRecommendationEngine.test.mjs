import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import ts from 'typescript'
import vm from 'node:vm'

const root = resolve(dirname(new URL(import.meta.url).pathname), '..')

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
    require: () => ({}),
    console,
    Date,
    Math,
    Number,
    String,
    Boolean,
    Array,
    Object,
    Set,
    Map,
  }
  vm.runInNewContext(output, context, { filename })
  return module.exports
}

const engine = loadTs('lib/nutrition/supplementRecommendationEngine.ts')

function coverageDays({
  days = 14,
  belowDays = 11,
  nutrientKey = 'magnesium',
  adequatelyLogged = true,
} = {}) {
  return Array.from({ length: days }, (_, index) => {
    const day = String(index + 1).padStart(2, '0')
    const below = index < belowDays
    return {
      date: `2026-09-${day}`,
      nutrientKey,
      nutrientName: nutrientKey === 'protein' ? 'Protein' : 'Magnesium',
      estimatedDailyIntake: below ? 180 : 330,
      referenceTarget: nutrientKey === 'protein' ? 120 : 320,
      unit: nutrientKey === 'protein' ? 'g' : 'mg',
      adequatelyLogged,
    }
  })
}

function sleepTrend(value = 4) {
  return Array.from({ length: 7 }, (_, index) => ({
    category: 'sleep_support',
    date: `2026-09-${String(index + 8).padStart(2, '0')}`,
    value,
    higherIsBetter: true,
  }))
}

const sleepFormulation = {
  productId: 'sleep-1',
  productName: 'Anastasis Sleep Support',
  active: true,
  productUrl: '/sleep',
  nutrients: ['magnesium'],
  supportCategories: ['sleep_support'],
  contraindicationMetadata: {
    suppressWhen: ['pregnancy_or_breastfeeding'],
    upperIntakeConcernNutrients: ['magnesium'],
  },
  minimumMatchingRequirements: {
    minRecurringNutrients: 1,
    minFunctionalCategories: 1,
  },
}

const recoveryFormulation = {
  productId: 'recovery-1',
  productName: 'Anastasis Recovery',
  active: true,
  nutrients: ['magnesium', 'protein'],
  supportCategories: ['recovery_support'],
}

test('positive sleep scenario requires recurring coverage and lower sleep trend', () => {
  const result = engine.evaluateSupplementRecommendation({
    coverageDays: coverageDays(),
    functionalInputs: sleepTrend(4),
    formulations: [sleepFormulation],
    now: new Date('2026-09-25T12:00:00.000Z'),
  })

  assert.equal(result.recommendation?.productId, 'sleep-1')
  assert.equal(result.debug.recommendationGenerated, true)
  assert.match(result.recommendation.recommendationCopy, /food logs show/i)
  assert.doesNotMatch(result.recommendation.recommendationCopy, /deficient|deficiency|caused by|need this|fix your sleep/i)
})

test('recurring nutrient pattern alone does not recommend a product', () => {
  const result = engine.evaluateSupplementRecommendation({
    coverageDays: coverageDays(),
    functionalInputs: [],
    formulations: [sleepFormulation],
  })

  assert.equal(result.recommendation, null)
  assert.ok(result.debug.reasonCodes.includes('no_corresponding_functional_issue'))
})

test('insufficient observation time blocks recommendations', () => {
  const result = engine.evaluateSupplementRecommendation({
    coverageDays: coverageDays({ days: 9, belowDays: 9 }),
    functionalInputs: sleepTrend(3),
    formulations: [sleepFormulation],
  })

  assert.equal(result.recommendation, null)
  assert.ok(result.debug.reasonCodes.includes('insufficient_observation_time'))
})

test('sparse logging blocks recommendations', () => {
  const sparse = coverageDays({ days: 14, belowDays: 14 }).map((day, index) => ({
    ...day,
    adequatelyLogged: index < 4,
  }))

  const result = engine.evaluateSupplementRecommendation({
    coverageDays: sparse,
    functionalInputs: sleepTrend(4),
    formulations: [sleepFormulation],
  })

  assert.equal(result.recommendation, null)
  assert.ok(result.debug.reasonCodes.includes('insufficient_logging_completeness'))
})

test('normal sleep prevents sleep product even with recurring magnesium pattern', () => {
  const result = engine.evaluateSupplementRecommendation({
    coverageDays: coverageDays(),
    functionalInputs: sleepTrend(8),
    formulations: [sleepFormulation],
  })

  assert.equal(result.recommendation, null)
  assert.ok(result.debug.reasonCodes.includes('no_corresponding_functional_issue'))
})

test('poor recovery evaluates recovery formulation instead of sleep when sleep is normal', () => {
  const recoveryTrend = Array.from({ length: 7 }, (_, index) => ({
    category: 'recovery_support',
    date: `2026-09-${String(index + 8).padStart(2, '0')}`,
    value: 8,
    higherIsBetter: false,
  }))

  const result = engine.evaluateSupplementRecommendation({
    coverageDays: coverageDays(),
    functionalInputs: [...sleepTrend(8), ...recoveryTrend],
    formulations: [sleepFormulation, recoveryFormulation],
  })

  assert.equal(result.recommendation?.productId, 'recovery-1')
})

test('safety context suppresses automated product recommendation', () => {
  const result = engine.evaluateSupplementRecommendation({
    coverageDays: coverageDays(),
    functionalInputs: sleepTrend(4),
    formulations: [sleepFormulation],
    safetyContext: { pregnancyOrBreastfeeding: true },
  })

  assert.equal(result.recommendation, null)
  assert.ok(result.debug.reasonCodes.includes('safety_suppressed'))
})

test('resolution-like improved patterns do not become permanent ads', () => {
  const result = engine.evaluateSupplementRecommendation({
    coverageDays: coverageDays({ belowDays: 3 }),
    functionalInputs: sleepTrend(8),
    formulations: [sleepFormulation],
  })

  assert.equal(result.recommendation, null)
  assert.ok(result.debug.reasonCodes.includes('nutritional_pattern_not_recurrent'))
})

test('user-facing recommendation language stays non-diagnostic', () => {
  const result = engine.evaluateSupplementRecommendation({
    coverageDays: coverageDays(),
    functionalInputs: sleepTrend(4),
    formulations: [sleepFormulation],
  })

  const text = [
    result.recommendation?.recommendationCopy,
    result.recommendation?.disclaimerCopy,
    result.recommendation?.why.nutrition,
    result.recommendation?.why.trend,
    result.recommendation?.why.reason,
    result.recommendation?.why.disclaimer,
  ].join(' ')

  assert.doesNotMatch(text, /you are deficient|you have low|caused by|will fix|you need|take this to treat|based on your symptoms, you have/i)
})
