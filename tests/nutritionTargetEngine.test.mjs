import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

async function importTypescriptModule(path) {
  const source = readFileSync(path, 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2020,
      target: ts.ScriptTarget.ES2022,
    },
  })
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)
}

const {
  calculateNutritionTargets,
  inchesToCm,
  poundsToKg,
  NUTRITION_FORMULA_VERSION,
} = await importTypescriptModule('lib/nutrition/targetEngine.ts')

function femaleFixture(overrides = {}) {
  return {
    age: 35,
    metabolicSex: 'female',
    heightCm: inchesToCm(67),
    weightKg: poundsToKg(185),
    bodyFatPercent: 27,
    goalValue: 'recomposition',
    assessedActivityLevel: 'moderately_active',
    calculatedAt: new Date('2026-08-25T12:00:00.000Z'),
    ...overrides,
  }
}

function wearableDays(count, overrides = {}) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date('2026-08-10T00:00:00.000Z')
    date.setUTCDate(date.getUTCDate() + index)
    return {
      date: date.toISOString().slice(0, 10),
      activeEnergyKcal: 520 + index,
      restingEnergyKcal: 1680,
      workoutEnergyKcal: 250,
      steps: 8500,
      dataSource: 'apple_health',
      ...overrides,
    }
  })
}

test('female recomp fixture uses BMI, lean mass, and Katch-McArdle BMR', () => {
  const target = calculateNutritionTargets(femaleFixture())

  assert.equal(target.calculationMode, 'assessment')
  assert.equal(target.calculationStatus, 'estimated')
  assert.ok(Math.abs(target.bmi - 29) <= 0.2)
  assert.ok(Math.abs(target.leanBodyMassKg - 61.2) <= 0.3)
  assert.ok(Math.abs(target.bmr - 1691) <= 5)
})

test('14 usable wearable days control the target with rolling energy', () => {
  const target = calculateNutritionTargets(
    femaleFixture({
      wearableConnected: true,
      wearableDays: wearableDays(14),
    }),
  )

  assert.equal(target.calculationMode, 'wearable')
  assert.equal(target.calculationStatus, 'personalized')
  assert.equal(target.rollingRestingEnergy, 1680)
  assert.ok(target.rollingActiveEnergy > 520)
  assert.equal(target.rollingWearableTdee, target.estimatedTdee)
})

test('3 usable wearable days keep assessment active while calibrating', () => {
  const target = calculateNutritionTargets(
    femaleFixture({
      wearableConnected: true,
      wearableDays: wearableDays(3),
    }),
  )

  assert.equal(target.calculationMode, 'assessment')
  assert.equal(target.calculationStatus, 'calibrating')
  assert.equal(target.statusLabel, 'Calibrating to your activity')
})

test('weight-loss macro allocation is protein-forward and lower carbohydrate', () => {
  const target = calculateNutritionTargets(femaleFixture({ goalValue: 'fat-loss' }))

  assert.equal(target.normalizedGoal, 'weight_loss')
  assert.equal(target.defaultMacroPercentages.protein, 40)
  assert.equal(target.defaultMacroPercentages.carbs, 30)
  assert.equal(target.defaultMacroPercentages.fats, 30)
  assert.ok(target.protein > target.carbs)
})

test('recomposition macro allocation uses the recomp template when safeguards do not bind', () => {
  const target = calculateNutritionTargets(femaleFixture())

  assert.equal(target.normalizedGoal, 'recomp')
  assert.equal(target.defaultMacroPercentages.carbs, 45)
  assert.equal(target.defaultMacroPercentages.protein, 30)
  assert.equal(target.defaultMacroPercentages.fats, 25)
})

test('bulk macro allocation uses the bulk template', () => {
  const target = calculateNutritionTargets(femaleFixture({ goalValue: 'muscle-building' }))

  assert.equal(target.normalizedGoal, 'bulk')
  assert.equal(target.defaultMacroPercentages.carbs, 50)
  assert.equal(target.defaultMacroPercentages.protein, 25)
  assert.equal(target.defaultMacroPercentages.fats, 25)
})

test('missing body-fat percentage falls back to Mifflin-St Jeor', () => {
  const target = calculateNutritionTargets(femaleFixture({ bodyFatPercent: null }))

  assert.equal(target.bodyFatPercentUsed, null)
  assert.equal(target.leanBodyMassKg, null)
  assert.ok(target.bmr < 1691)
})

test('invalid body-fat percentage falls back to Mifflin-St Jeor', () => {
  const target = calculateNutritionTargets(femaleFixture({ bodyFatPercent: 0 }))

  assert.equal(target.bodyFatPercentUsed, null)
  assert.equal(target.leanBodyMassKg, null)
  assert.ok(target.bmr < 1691)
})

test('wearable mode uses calculated BMR when resting energy is missing', () => {
  const target = calculateNutritionTargets(
    femaleFixture({
      wearableConnected: true,
      wearableDays: wearableDays(14, { restingEnergyKcal: null, activeEnergyKcal: 500 }),
    }),
  )

  assert.equal(target.calculationMode, 'wearable')
  assert.equal(target.rollingRestingEnergy, null)
  assert.equal(target.estimatedTdee, target.bmr + 500)
})

test('workout energy is not double counted into wearable TDEE', () => {
  const withWorkout = calculateNutritionTargets(
    femaleFixture({
      wearableConnected: true,
      wearableDays: wearableDays(14, { activeEnergyKcal: 500, workoutEnergyKcal: 700 }),
    }),
  )
  const withoutWorkout = calculateNutritionTargets(
    femaleFixture({
      wearableConnected: true,
      wearableDays: wearableDays(14, { activeEnergyKcal: 500, workoutEnergyKcal: 0 }),
    }),
  )

  assert.equal(withWorkout.estimatedTdee, withoutWorkout.estimatedTdee)
})

test('fat-floor safeguard raises low fat templates', () => {
  const target = calculateNutritionTargets(
    femaleFixture({
      goalValue: 'recomposition',
      assessedActivityLevel: 'sedentary',
      weightKg: poundsToKg(110),
      bodyFatPercent: null,
    }),
  )

  assert.ok(target.fats >= 50)
  assert.ok(target.safeguardsApplied.includes('fat_floor'))
})

test('protein safeguard raises inadequate protein templates', () => {
  const target = calculateNutritionTargets(
    femaleFixture({
      goalValue: 'bulk',
      wearableConnected: true,
      wearableDays: wearableDays(14, {
        activeEnergyKcal: 200,
        restingEnergyKcal: 800,
      }),
      weightKg: poundsToKg(230),
      bodyFatPercent: 12,
    }),
  )

  assert.ok(target.safeguardsApplied.includes('protein_floor'))
})

test('manual override takes precedence over calculated targets', () => {
  const target = calculateNutritionTargets(
    femaleFixture({
      manualOverride: {
        calories: 2100,
        protein: 160,
        carbs: 220,
        fats: 64,
      },
    }),
  )

  assert.equal(target.calculationStatus, 'manual_override')
  assert.equal(target.calories, 2100)
  assert.equal(target.protein, 160)
})

test('imperial to metric conversion supports canonical calculations', () => {
  assert.ok(Math.abs(inchesToCm(67) - 170.18) < 0.01)
  assert.ok(Math.abs(poundsToKg(185) - 83.91) < 0.01)
})

test('final rounded macro calories match the calorie target within tolerance', () => {
  const target = calculateNutritionTargets(femaleFixture({ goalValue: 'fat-loss' }))
  const macroCalories = target.protein * 4 + target.carbs * 4 + target.fats * 9

  assert.ok(Math.abs(macroCalories - target.calories) <= 8)
})

test('historical calculations retain the formula version on the result', () => {
  const target = calculateNutritionTargets(femaleFixture())

  assert.equal(target.formulaVersion, NUTRITION_FORMULA_VERSION)
})
