import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

function loadEvaluateCapacityHistory() {
  const source = readFileSync(
    new URL('../lib/workout-os/evaluateCapacityHistory.ts', import.meta.url),
    'utf8'
  )
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText
  const module = { exports: {} }
  vm.runInNewContext(compiled, { exports: module.exports, module })
  return module.exports.evaluateCapacityHistory
}

const evaluateCapacityHistory = loadEvaluateCapacityHistory()

function signal(date, overrides = {}) {
  return {
    date,
    checkInCompleted: true,
    sleepHours: 7,
    stress: 5,
    energy: 7,
    soreness: 5,
    sorenessRegions: [],
    ...overrides,
  }
}

test('three days sleep 4.5 is low capacity', () => {
  const result = evaluateCapacityHistory([
    signal('2026-07-26', { sleepHours: 4.5 }),
    signal('2026-07-27', { sleepHours: 4.5 }),
    signal('2026-07-25', { sleepHours: 4.5 }),
  ])
  assert.equal(result.level, 'low')
  assert.equal(result.exerciseTarget, 3)
  assert.equal(result.recoveryTarget, 3)
  assert.deepEqual(Array.from(result.triggers), ['three_days_low_sleep'])
})

test('sleep exactly 5 does not trigger low capacity', () => {
  const result = evaluateCapacityHistory([
    signal('2026-07-27', { sleepHours: 4.5 }),
    signal('2026-07-26', { sleepHours: 5 }),
    signal('2026-07-25', { sleepHours: 4.5 }),
  ])
  assert.equal(result.level, 'standard')
  assert.equal(result.historyComplete, true)
})

test('three days stress 9 is low capacity', () => {
  const result = evaluateCapacityHistory([
    signal('2026-07-27', { stress: 9 }),
    signal('2026-07-26', { stress: 9 }),
    signal('2026-07-25', { stress: 9 }),
  ])
  assert.equal(result.level, 'low')
  assert.deepEqual(Array.from(result.triggers), ['three_days_high_stress'])
})

test('stress exactly 8 does not trigger low capacity', () => {
  const result = evaluateCapacityHistory([
    signal('2026-07-27', { stress: 9 }),
    signal('2026-07-26', { stress: 8 }),
    signal('2026-07-25', { stress: 9 }),
  ])
  assert.equal(result.level, 'standard')
})

test('three days energy 4 is low capacity', () => {
  const result = evaluateCapacityHistory([
    signal('2026-07-27', { energy: 4 }),
    signal('2026-07-26', { energy: 4 }),
    signal('2026-07-25', { energy: 4 }),
  ])
  assert.equal(result.level, 'low')
  assert.deepEqual(Array.from(result.triggers), ['three_days_low_energy'])
})

test('energy exactly 5 does not trigger low capacity', () => {
  const result = evaluateCapacityHistory([
    signal('2026-07-27', { energy: 4 }),
    signal('2026-07-26', { energy: 5 }),
    signal('2026-07-25', { energy: 4 }),
  ])
  assert.equal(result.level, 'standard')
})

test('multiple capacity triggers can be returned together', () => {
  const result = evaluateCapacityHistory([
    signal('2026-07-27', { sleepHours: 4, stress: 9, energy: 4 }),
    signal('2026-07-26', { sleepHours: 4, stress: 9, energy: 4 }),
    signal('2026-07-25', { sleepHours: 4, stress: 9, energy: 4 }),
  ])
  assert.deepEqual(Array.from(result.triggers), [
    'three_days_low_sleep',
    'three_days_high_stress',
    'three_days_low_energy',
  ])
})

test('missing yesterday is incomplete and standard', () => {
  const result = evaluateCapacityHistory([
    signal('2026-07-27', { checkInCompleted: false }),
    signal('2026-07-26', { sleepHours: 4 }),
    signal('2026-07-25', { sleepHours: 4 }),
    signal('2026-07-24', { sleepHours: 4 }),
  ])
  assert.equal(result.level, 'standard')
  assert.equal(result.historyComplete, false)
})

test('three rows with one incomplete check-in is incomplete', () => {
  const result = evaluateCapacityHistory([
    signal('2026-07-27'),
    signal('2026-07-26', { checkInCompleted: false }),
    signal('2026-07-25'),
  ])
  assert.equal(result.level, 'standard')
  assert.equal(result.historyComplete, false)
  assert.equal(result.completeDays, 2)
})

test('empty history is standard and incomplete', () => {
  const result = evaluateCapacityHistory([])
  assert.equal(result.level, 'standard')
  assert.equal(result.historyComplete, false)
  assert.equal(result.exerciseTarget, 12)
  assert.equal(result.recoveryTarget, 1)
})
