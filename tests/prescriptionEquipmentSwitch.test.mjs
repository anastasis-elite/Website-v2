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
  assert.equal(cable.recommended_weight, 70)
  assert.equal(cable.sets, source.sets); assert.equal(cable.recommended_reps, source.recommended_reps)
  assert.equal(cable.prescription_calculation.base_weight, 100)
  assert.equal(cable.prescription_calculation.equipment_weight, 100)
  const machine = changePrescriptionVariant(cable, 'machine_row')
  assert.equal(machine.calculated_weight, 110)
  assert.equal(machine.cycle_adjusted_weight, 95)
  assert.equal(machine.recommended_weight, 75)
  const restored = changePrescriptionVariant(machine, 'single_arm_dumbbell_row')
  assert.equal(restored.recommended_weight, 30)
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


test('rounded policy validates exact final load without relaxing legacy validation', () => {
  assert.equal(canChangePrescriptionVariant(prescription({ recommended_weight: 30 })), false)
  assert.equal(canChangePrescriptionVariant(prescription({ recommended_weight: 30, suggested_load_rounding: 'equipment-v1' })), true)
  assert.equal(canChangePrescriptionVariant(prescription({ recommended_weight: 31, suggested_load_rounding: 'equipment-v1' })), false)
  assert.equal(canChangePrescriptionVariant(prescription({ suggested_load_rounding: 'unknown' })), false)
})

test('bilateral hip thrust variants clear load rather than transfer equipment estimates', () => {
  const group = groups.find(group => group.pattern === 'hip_thrust')
  const { resolveFounderExerciseReference } = load('lib/program/founderReference.ts')
  assert.equal(group.variants.length, 4)
  for (const variant of group.variants) {
    const resolved = resolveFounderExerciseReference(variant.name)
    assert.equal(resolved.status, 'resolved')
    assert.equal(resolved.reference.assessment_key, 'RDL')
    assert.equal(resolved.reference.bodyweight_factor, 0)
    assert.equal(variant.equipment_modifier, 1)
    assert.equal(variant.load_type, 'total_load')
  }
  for (const name of ['B-Stance Hip Thrust', 'Single-Leg Hip Thrust', 'Hip Thrust Holds']) {
    assert.equal(resolveFounderExerciseReference(name).group, null)
  }
  const source = prescription({ exercise: 'Smith Machine Hip Thrust', session_key: 'hip-thrust-card',
    selected_variant_id: 'smith_hip_thrust', selected_equipment: 'smith', load_type: 'total_load',
    calculated_weight: 100, cycle_adjusted_weight: 85, recommended_weight: 68,
    available_variants: clone(group.variants), prescription_calculation: {
      version: 'founder-load-v3', reference_exercise: 'Smith Machine Hip Thrust', assessment_key: 'RDL',
      bodyweight_factor: 0, body_mass_lb: 180, estimated_1rm: 125, rep_multiplier: .8,
      base_weight: 100, equipment_weight: 100, equipment_modifier: 1, selected_variant_id: 'smith_hip_thrust' } })
  let current = source
  for (const variant of group.variants) {
    current = changePrescriptionVariant(current, variant.id)
    assert.ok(current)
    assert.equal(current.session_key, source.session_key)
    assert.equal(current.exercise, source.exercise)
    assert.equal(current.selected_variant_name, variant.name)
    assert.equal(current.calculated_weight, null)
    assert.equal(current.recommended_weight, null)
    assert.equal(canChangePrescriptionVariant(current), true)
  }
  assert.equal(changePrescriptionVariant({ ...current, set_logs: [{ weight: 70, reps: 8 }] }, 'barbell_hip_thrust'), null)
  assert.equal(changePrescriptionVariant({ ...current, prescription_calculation: undefined }, 'barbell_hip_thrust').recommended_weight, null)
  const fabricated = clone(current); fabricated.available_variants[0].name = 'Unverified movement'
  assert.equal(changePrescriptionVariant(fabricated, 'barbell_hip_thrust'), null)
})

test('unstarted catalog hip thrust can gain choices from its exact saved exercise; started work is not refreshed', () => {
  const { projectSavedExercisePrescription } = loader({ 'server-only': {} })('lib/program/savedPrescription.ts')
  const source = { exercise: 'Smith Machine Hip Thrust', sets: 3, reps: 8, load_type: 'total_load', recommended_weight: 65 }
  const updated = projectSavedExercisePrescription(source, 'ember', { current_weight: 180 }, { data: { romanian_deadlift_weight: 95, romanian_deadlift_reps: 10 } })
  assert.equal(updated.selected_variant_id, 'smith_hip_thrust')
  assert.equal(updated.available_variants.length, 4)
  assert.equal(updated.prescription_calculation.reference_exercise, 'Smith Machine Hip Thrust')
  assert.ok(updated.recommended_weight > 0)
  const substituted = projectSavedExercisePrescription({ ...updated, selected_variant_id: 'dumbbell_hip_thrust', selected_equipment: 'dumbbell' }, 'ember', { current_weight: 180 }, { data: { romanian_deadlift_weight: 95, romanian_deadlift_reps: 10 } })
  assert.equal(substituted.recommended_weight, null)
  assert.equal(substituted.load_guidance_status, 'not_calculated')
  const started = { ...source, set_logs: [{ weight: 65, reps: 8 }] }
  const retained = projectSavedExercisePrescription(started, 'ember', { current_weight: 180 }, { data: { romanian_deadlift_weight: 95, romanian_deadlift_reps: 10 } })
  assert.equal(retained.recommended_weight, 65)
  assert.deepEqual(retained.set_logs, started.set_logs)
  assert.equal(retained.selected_variant_id, undefined)
})
