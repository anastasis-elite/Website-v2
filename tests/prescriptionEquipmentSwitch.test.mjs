import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
function loader(mocks = {}) {
  const cache = new Map()
  function load(path) {
    path = resolve(path)
    if (cache.has(path)) return cache.get(path).exports
    if (path.endsWith('.json')) return JSON.parse(readFileSync(path, 'utf8'))
    const module = { exports: {} }; cache.set(path, module)
    const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
    } }).outputText
    runInNewContext(code, { module, exports: module.exports, Date, Intl, require(name) {
      if (Object.hasOwn(mocks, name)) return mocks[name]
      const base = name.startsWith('@/') ? resolve(name.slice(2)) : name.startsWith('.') ? resolve(dirname(path), name) : null
      if (!base) return require(name)
      return load(/\.(?:json|tsx?)$/.test(base) ? base : existsSync(base + '.ts') ? base + '.ts' : base + '.tsx')
    } }, { filename: path })
    return module.exports
  }
  return load
}
const load = loader()
const { changePrescriptionVariant, canChangePrescriptionVariant } = load('lib/workout/changePrescriptionVariant.ts')
const groups = load('data/reference/exerciseVariants.json')
const variants = groups.find(group => group.pattern === 'row').variants
const clone = value => JSON.parse(JSON.stringify(value))
function prescription(patch = {}) {
  return { id: 'synthetic-row', exercise: 'Seated Cable Row', sets: 3, recommended_reps: 8,
    selected_variant_id: 'single_arm_dumbbell_row', selected_equipment: 'dumbbell', load_type: 'single_side',
    calculated_weight: 40, cycle_adjusted_weight: 35, recommended_weight: 28,
    cycle_weight_multiplier: .85, cycle_rep_adjustment: -2, prescription_safety_multiplier: .8,
    available_variants: clone(variants), set_logs: [],
    prescription_calculation: { version: 'founder-load-v3', reference_exercise: 'Seated Cable Row', assessment_key: 'Row',
      bodyweight_factor: 0, body_mass_lb: 180, estimated_1rm: 100, rep_multiplier: 1,
      base_weight: 100, equipment_weight: 40, equipment_modifier: .42, selected_variant_id: 'single_arm_dumbbell_row' }, ...patch }
}

test('variant switches convert the original base then apply saved cycle and daily safety once', () => {
  const source = prescription(), before = clone(source)
  assert.equal(canChangePrescriptionVariant(source), true)
  const cable = changePrescriptionVariant(source, 'seated_cable_row')
  assert.equal(cable.calculated_weight, 100)
  assert.equal(cable.cycle_adjusted_weight, 85)
  assert.equal(cable.recommended_weight, 68)
  assert.equal(cable.sets, source.sets); assert.equal(cable.recommended_reps, source.recommended_reps)
  assert.equal(cable.prescription_calculation.base_weight, 100)
  assert.equal(cable.prescription_calculation.equipment_weight, 100)
  const machine = changePrescriptionVariant(cable, 'machine_row')
  assert.equal(machine.calculated_weight, 110)
  assert.equal(machine.cycle_adjusted_weight, 95)
  assert.equal(machine.recommended_weight, 76)
  const restored = changePrescriptionVariant(machine, 'single_arm_dumbbell_row')
  assert.equal(restored.recommended_weight, 28)
  assert.equal(restored.calculated_weight, 40)
  assert.deepEqual(source, before)
})

test('the already selected variant preserves the adjusted recommendation exactly', () => {
  const source = prescription()
  assert.equal(changePrescriptionVariant(source, source.selected_variant_id), source)
})

test('legacy, missing, zero, ambiguous and mismatched calculation metadata cannot manufacture a conversion', () => {
  for (const patch of [
    { prescription_calculation: undefined }, { cycle_weight_multiplier: undefined },
    { prescription_safety_multiplier: undefined }, { cycle_weight_multiplier: 0 },
    { recommended_weight: 0 }, { recommended_weight: 27 }, { prescription_status: 'unavailable' },
    { exercise: 'Dumbbell Press' }, { selected_variant_id: 'missing' },
  ]) {
    const source = prescription(patch), before = clone(source)
    assert.equal(canChangePrescriptionVariant(source), false)
    assert.equal(changePrescriptionVariant(source, 'seated_cable_row'), null)
    assert.deepEqual(clone(source), before)
  }
  for (const field of ['base_weight', 'equipment_weight', 'equipment_modifier', 'estimated_1rm']) {
    const source = prescription(); source.prescription_calculation[field] = 0
    assert.equal(changePrescriptionVariant(source, 'seated_cable_row'), null)
  }
  const legacy = prescription(); legacy.prescription_calculation.version = 'founder-load-v2'
  assert.equal(changePrescriptionVariant(legacy, 'seated_cable_row'), null)
  const duplicated = prescription(); duplicated.available_variants.push(duplicated.available_variants.find(item => item.id === 'seated_cable_row'))
  assert.equal(changePrescriptionVariant(duplicated, 'seated_cable_row'), null)
  const fabricated = prescription(); fabricated.available_variants.find(item => item.id === 'seated_cable_row').equipment_modifier = 2
  assert.equal(changePrescriptionVariant(fabricated, 'seated_cable_row'), null)
})

test('partial and completed exercises retain actual set records and session identity', () => {
  for (const patch of [{ set_logs: [{ set_number: 1, weight: 31, reps: 7, completed_at: '2026-11-04T12:00:00Z' }] }, { completed: true }]) {
    const source = prescription({ session_key: 'synthetic-occurrence-2', ...patch }), before = clone(source)
    assert.equal(canChangePrescriptionVariant(source), false)
    assert.equal(changePrescriptionVariant(source, 'seated_cable_row'), null)
    assert.equal(changePrescriptionVariant(source, source.selected_variant_id), source)
    assert.deepEqual(source, before)
  }
})

test('duplicate exact reference rows are unavailable instead of selecting the first match', () => {
  const rows = load('data/reference/masterKey.json'), row = rows.find(item => item.exercise === 'Seated Cable Row')
  const altered = loader({ '@/data/reference/masterKey.json': [...rows, { ...row }] })('lib/workout/changePrescriptionVariant.ts')
  assert.equal(altered.canChangePrescriptionVariant(prescription()), false)
  assert.equal(altered.changePrescriptionVariant(prescription(), 'seated_cable_row'), null)
})
