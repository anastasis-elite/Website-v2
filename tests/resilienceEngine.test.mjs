import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

function loadCommonJsTypescript(path, localModules = {}) {
  const source = readFileSync(path, 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText
  const module = { exports: {} }
  const require = (id) => localModules[id] || {}
  vm.runInNewContext(compiled, { exports: module.exports, module, require })
  return module.exports
}

const { evaluateResilience } = loadCommonJsTypescript('lib/dashboard/resilienceEngine.ts')

test('overreaching prioritizes recovery over more intensity', () => {
  const result = evaluateResilience({
    sleepHours: 5.2,
    hrv: 28,
    soreness: 8,
    energy: 3,
    workoutMinutes: 85,
    recoveryStatus: 'modify_workout',
    fuelStatus: 'well_fueled',
  })

  assert.match(result.overallState, /strained|depleted/)
  assert.equal(result.primaryCapacity.capacity, 'diligence')
  assert.equal(result.primaryCapacity.state, 'excessive')
  assert.equal(result.priority, 'recovery')
})

test('ready but inactive prioritizes movement or training', () => {
  const result = evaluateResilience({
    sleepHours: 8,
    hrv: 62,
    soreness: 2,
    energy: 8,
    steps: 1800,
    workoutMinutes: 0,
    recoveryStatus: 'normal_training_day',
    fuelStatus: 'well_fueled',
  })

  assert.match(result.overallState, /stable|thriving/)
  assert.equal(result.primaryCapacity.capacity, 'diligence')
  assert.equal(result.primaryCapacity.state, 'deficient')
  assert.equal(result.priority, 'training')
})

test('underfueled athlete prioritizes fueling and suppresses added intensity', () => {
  const result = evaluateResilience({
    sleepHours: 6.1,
    hrv: 32,
    soreness: 6,
    workoutMinutes: 80,
    activeEnergy: 820,
    recoveryStatus: 'modify_workout',
    fuelStatus: 'under_fueled',
    calories: { target: 2200, consumed: 1200 },
    protein: { target: 140, consumed: 72 },
    carbs: { target: 230, consumed: 90 },
  })

  assert.equal(result.overallState, 'strained')
  assert.equal(result.priority, 'fueling')
  assert.equal(result.primaryCapacity.capacity, 'temperance')
  assert.equal(result.primaryCapacity.state, 'excessive')
})

test('missed workout with normal physiology returns to plan without compensation', () => {
  const result = evaluateResilience({
    sleepHours: 7.5,
    hrv: 55,
    soreness: 2,
    energy: 7,
    recoveryStatus: 'normal_training_day',
    fuelStatus: 'well_fueled',
    missedWorkoutYesterday: true,
    steps: 5000,
    workoutMinutes: 0,
  })

  assert.match(result.overallState, /stable|thriving/)
  assert.equal(result.priority, 'normal_return')
  assert.equal(result.primaryCapacity.capacity, 'kindness')
  assert.equal(result.primaryCapacity.state, 'balanced')
})

test('schedule overload protects capacity instead of adding tasks', () => {
  const result = evaluateResilience({
    sleepHours: 5.8,
    stress: 9,
    energy: 4,
    scheduleDensity: 'packed',
    openWindowMinutes: 20,
    recoveryStatus: 'normal_training_day',
  })

  assert.equal(result.overallState, 'strained')
  assert.equal(result.priority, 'schedule_protection')
  assert.equal(result.primaryCapacity.capacity, 'generosity')
  assert.equal(result.primaryCapacity.state, 'excessive')
})

test('rested and recovered after strain allows return to progression', () => {
  const result = evaluateResilience({
    sleepHours: 8,
    hrv: 58,
    soreness: 1,
    energy: 8,
    recoveryRequired: false,
    recoveryStatus: 'push_day',
    fuelStatus: 'well_fueled',
    hydrationPercent: 90,
    allowLoadProgression: true,
    steps: 6500,
  })

  assert.equal(result.overallState, 'thriving')
  assert.equal(result.priority, 'optimization')
  assert.notEqual(result.priority, 'recovery')
})

test('missing activity data is not treated as low output by default', () => {
  const result = evaluateResilience({
    sleepHours: 8,
    hrv: 62,
    soreness: 2,
    energy: 8,
    steps: 2600,
    recoveryStatus: 'normal_training_day',
    fuelStatus: 'well_fueled',
  })

  assert.equal(result.priority, 'optimization')
  assert.notEqual(result.primaryCapacity?.capacity, 'diligence')
})

test('single very low steps signal can still support normal movement when ready', () => {
  const result = evaluateResilience({
    sleepHours: 8,
    hrv: 62,
    soreness: 2,
    energy: 8,
    steps: 1200,
    recoveryStatus: 'normal_training_day',
    fuelStatus: 'well_fueled',
  })

  assert.equal(result.priority, 'training')
  assert.equal(result.primaryCapacity.capacity, 'diligence')
  assert.equal(result.primaryCapacity.state, 'deficient')
})

test('physiological fueling evidence outranks schedule generosity inference', () => {
  const result = evaluateResilience({
    sleepHours: 7.1,
    energy: 6,
    stress: 9,
    scheduleDensity: 'packed',
    workoutMinutes: 75,
    activeEnergy: 760,
    fuelStatus: 'under_fueled',
    calories: { target: 2300, consumed: 1300 },
    protein: { target: 140, consumed: 70 },
    carbs: { target: 240, consumed: 90 },
  })

  assert.equal(result.priority, 'fueling')
  assert.equal(result.primaryCapacity.capacity, 'temperance')
  assert.equal(result.primaryCapacity.state, 'excessive')
})

test('humility outranks diligence when direct body signals block training', () => {
  const result = evaluateResilience({
    sleepHours: 7,
    energy: 6,
    symptomSeverity: 'moderate',
    hasWorkoutToday: true,
    canTrain: false,
  })

  assert.equal(result.priority, 'recovery')
  assert.equal(result.primaryCapacity.capacity, 'humility')
  assert.equal(result.primaryCapacity.state, 'deficient')
})

test('insufficient data returns uncertain and conservative output', () => {
  const result = evaluateResilience({})

  assert.equal(result.overallState, 'uncertain')
  assert.equal(result.priority, 'conservative')
  assert.equal(result.primaryCapacity, undefined)
})
